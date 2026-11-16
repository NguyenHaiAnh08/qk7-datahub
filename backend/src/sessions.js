/**
 * sessions.js — JWT + Session Hybrid Validation
 * Cache 30 giây, IP binding chặt (LAN/WAN + subnet), revoke tức thì.
 */

const crypto = require('crypto');

const CACHE_TTL_MS = 30 * 1000;
const cache = new Map(); // tokenHash → { valid, user_id, ip, reason, cachedAt }

// ✅ Global invalidation timestamp — revoke có hiệu lực ngay
let lastGlobalInvalidation = 0;

function hashToken(rawJwt) {
  return crypto.createHash('sha256').update(rawJwt).digest('hex');
}

// ═══════════════════════════════════════════════════════════════
// ✅ IP CLASSIFICATION HELPERS (P1-1)
// ═══════════════════════════════════════════════════════════════

/**
 * Phân loại IP: 'localhost' | 'lan' | 'wan' | 'unknown'
 */
function ipType(ip) {
  if (!ip) return 'unknown';
  const s = String(ip).trim().toLowerCase();
  if (s === '127.0.0.1' || s === '::1' || s === 'localhost') return 'localhost';
  if (/^10\./.test(s)) return 'lan';
  if (/^192\.168\./.test(s)) return 'lan';
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(s)) return 'lan';
  if (/^169\.254\./.test(s)) return 'lan';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) return 'wan';
  if (s.includes(':')) return 'wan';
  return 'unknown';
}

/**
 * Kiểm tra 2 IP cùng subnet /24 (chỉ IPv4).
 */
function isSameSubnet24(ip1, ip2) {
  const a = String(ip1).split('.');
  const b = String(ip2).split('.');
  if (a.length !== 4 || b.length !== 4) return false;
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/**
 * Phân loại mức độ thay đổi IP:
 *  - 'SAME'            : không đổi
 *  - 'LAN_SAME_SUBNET' : cùng LAN, cùng /24 → chỉ log
 *  - 'LAN_DIFF_SUBNET' : cùng LAN, khác /24 → block + revoke
 *  - 'SUSPICIOUS'      : LAN ↔ WAN, hoặc WAN → WAN khác → block + revoke
 *  - 'UNKNOWN'         : thiếu dữ liệu
 */
function classifyIpChange(oldIp, newIp) {
  if (!oldIp || !newIp) return 'UNKNOWN';
  if (oldIp === newIp) return 'SAME';

  const oldType = ipType(oldIp);
  const newType = ipType(newIp);

  if (oldType === 'lan' && newType === 'lan') {
    return isSameSubnet24(oldIp, newIp) ? 'LAN_SAME_SUBNET' : 'LAN_DIFF_SUBNET';
  }

  if (oldType === 'localhost' || newType === 'localhost') {
    return 'LAN_SAME_SUBNET';
  }

  return 'SUSPICIOUS';
}

module.exports = function createSessionModule({
  sql, getPool, writeAccessLog, getClientIp,
}) {
  // ✅ Xác định session thuộc admin (bypass IP binding)
  // Điều chỉnh ngưỡng theo hệ thống của bạn. Ví dụ: clearance_level_id >= 4 = admin.
  function isAdminSession(session) {
    const level = Number(session?.clearance_level_id);
    return Number.isFinite(level) && level >= 4;
  }

  async function createSession({ userId, clearanceLevelId, token, ip, userAgent, expiresInMs }) {
    const pool = await getPool();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + expiresInMs);
    const sessionId = crypto.randomUUID();

    await pool.request()
      .input('sid', sql.UniqueIdentifier, sessionId)
      .input('tok', sql.Char(64), tokenHash)
      .input('uid', sql.VarChar(50), userId)
      .input('clr', sql.Int, clearanceLevelId)
      .input('ip', sql.VarChar(50), ip || null)
      .input('ua', sql.NVarChar(255), (userAgent || '').slice(0, 255))
      .input('exp', sql.DateTime, expiresAt)
      .query(`
        INSERT INTO USER_SESSION (session_id, token, user_id, clearance_level_id, ip, user_agent, expires_at)
        VALUES (@sid, @tok, @uid, @clr, @ip, @ua, @exp)
      `);

    return { sessionId, tokenHash };
  }

  async function validateSession({ token, ip }) {
    const tokenHash = hashToken(token);

    // ─── 1. Check cache ───
    const cached = cache.get(tokenHash);
        if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      if (cached.cachedAt < lastGlobalInvalidation) {
        cache.delete(tokenHash);
      } else if (!cached.valid) {
        return { valid: false, reason: cached.reason };
      } else {
        // ✅ Defense-in-depth: IP đổi loại (LAN↔WAN) trên cache → bỏ cache, query DB
        const cacheSuspicious = cached.ip && ip && cached.ip !== ip
          && ipType(cached.ip) !== ipType(ip);
        if (cacheSuspicious) {
          cache.delete(tokenHash);
        } else {
          return { valid: true, user_id: cached.user_id };
        }
      }
    }

    // ─── 2. Query DB ───
    try {
      const pool = await getPool();
      const r = await pool.request()
        .input('tok', sql.Char(64), tokenHash)
        .query(`
          SELECT session_id, user_id, clearance_level_id, ip, expires_at, revoked, revoked_reason,
                 last_seen_at, created_at
          FROM USER_SESSION WITH (READCOMMITTED)   -- ✅ Bỏ NOLOCK
          WHERE token = @tok
        `);

      if (r.recordset.length === 0) {
        cache.set(tokenHash, { valid: false, reason: 'SESSION_NOT_FOUND', cachedAt: Date.now() });
        return { valid: false, reason: 'SESSION_NOT_FOUND' };
      }

      const s = r.recordset[0];

      // ─── 3. Check revoked ───
      if (s.revoked) {
        const reason = s.revoked_reason || 'REVOKED';
        cache.set(tokenHash, { valid: false, reason, cachedAt: Date.now() });
        return { valid: false, reason };
      }

      // ─── 4. Check expired ───
      if (new Date(s.expires_at) < new Date()) {
        cache.set(tokenHash, { valid: false, reason: 'EXPIRED', cachedAt: Date.now() });
        return { valid: false, reason: 'EXPIRED' };
      }

      // ─── 5. ✅ IP CHANGE DETECTION (P1-1) ───
      const logIpChange = (action, note) => {
        if (typeof writeAccessLog === 'function') {
          writeAccessLog({
            userId: s.user_id, fileId: null, action, ip, note,
          }).catch(() => {});
        }
      };
      const ipChange = classifyIpChange(s.ip, ip);

      if (s.ip && ip && s.ip !== ip) {
        const suspicious = ipType(s.ip) !== ipType(ip); // LAN ↔ WAN
        const isAdmin = isAdminSession(s);

        if (suspicious && !isAdmin) {
          // 🔴 IP nhảy LAN ↔ WAN → revoke + block + buộc re-auth
          await revokeSession({
            token,
            revokedBy: 'SYSTEM',
            reason: 'IP_CHANGED_SUSPICIOUS',
          }).catch((e) => console.error('[revokeSession]', e.message));

          logIpChange(
            'SESSION_IP_BLOCKED',
            `TỪ CHỐI: IP thay đổi bất thường ${s.ip} (${ipType(s.ip)}) → ${ip} (${ipType(ip)})`
          );

          return {
            valid: false,
            reason: 'IP_CHANGED',
            requires_reauth: true,
          };
        }

        // 🟢 Cùng loại IP (LAN→LAN hoặc WAN→WAN), hoặc admin → chỉ log
        logIpChange(
          'SESSION_IP_CHANGED',
          `IP thay đổi từ ${s.ip} (${ipType(s.ip)}) → ${ip} (${ipType(ip)})`
            + (isAdmin ? ' [admin bypass]' : '')
        );

        // Cập nhật IP mới vào DB (await + log lỗi thay vì fire-and-forget)
        try {
          await pool.request()
            .input('tok', sql.Char(64), tokenHash)
            .input('ip', sql.VarChar(50), ip)
            .query(`UPDATE USER_SESSION SET ip = @ip WHERE token = @tok AND revoked = 0`);
        } catch (e) {
          console.error('[validateSession] update ip failed:', e.message);
        }
      }

      // ─── 6. Update last_seen (async, mỗi 30s) ───
      const shouldUpdateLastSeen = !s.last_seen_at
        || (Date.now() - new Date(s.last_seen_at).getTime() > 30_000);
      if (shouldUpdateLastSeen) {
        pool.request()
          .input('tok', sql.Char(64), tokenHash)
          .query(`UPDATE USER_SESSION SET last_seen_at = GETDATE() WHERE token = @tok`)
          .catch(() => {});
      }

      // ─── 7. Cache ───
      cache.set(tokenHash, {
        valid: true,
        user_id: s.user_id,
        ip: (ipChange === 'LAN_SAME_SUBNET') ? ip : s.ip,
        cachedAt: Date.now(),
      });
      return { valid: true, user_id: s.user_id };

    } catch (err) {
      console.error('[validateSession]', err.message);
      return { valid: false, reason: 'SESSION_ERROR' };
    }
  }

  async function revokeSession({ token, revokedBy, reason }) {
    const tokenHash = hashToken(token);
    const pool = await getPool();
    const r = await pool.request()
      .input('tok', sql.Char(64), tokenHash)
      .input('rby', sql.VarChar(50), revokedBy || null)
      .input('rsn', sql.NVarChar(200), reason || 'LOGOUT')
      .query(`
        UPDATE USER_SESSION
        SET revoked = 1, revoked_at = GETDATE(),
            revoked_by = @rby, revoked_reason = @rsn
        WHERE token = @tok AND revoked = 0;
        SELECT @@ROWCOUNT AS n;
      `);
    cache.delete(tokenHash);
    lastGlobalInvalidation = Date.now();   // ✅ invalidate toàn bộ cache cũ
    return r.recordset[0]?.n || 0;
  }

  async function revokeAllUserSessions(userId, revokedBy, reason) {
    const pool = await getPool();
    const r = await pool.request()
      .input('uid', sql.VarChar(50), userId)
      .input('rby', sql.VarChar(50), revokedBy || null)
      .input('rsn', sql.NVarChar(200), reason || 'ADMIN_KILL')
      .query(`
        UPDATE USER_SESSION
        SET revoked = 1, revoked_at = GETDATE(),
            revoked_by = @rby, revoked_reason = @rsn
        WHERE user_id = @uid AND revoked = 0;
        SELECT @@ROWCOUNT AS n;
      `);

    // Clear cache entries của user
    for (const [tok, val] of cache.entries()) {
      if (val.user_id === userId) cache.delete(tok);
    }
    return r.recordset[0]?.n || 0;
  }

   async function killSessionById(sessionId, revokedBy, reason) {
    const pool = await getPool();
    const r = await pool.request()
      .input('sid', sql.UniqueIdentifier, sessionId)
      .input('rby', sql.VarChar(50), revokedBy || null)
      .input('rsn', sql.NVarChar(200), reason || 'ADMIN_KILL')
      .query(`
        UPDATE USER_SESSION
        SET revoked = 1, revoked_at = GETDATE(),
            revoked_by = @rby, revoked_reason = @rsn
        WHERE session_id = @sid AND revoked = 0;
      `);
    cache.clear();
    return r.rowsAffected[0] || 0;
  }

    async function listActiveSessions(userId = null, idleTimeoutMinutes = 15) {
    const pool = await getPool();
    const req = pool.request();
    
    // Mặc định coi là "offline" nếu không hoạt động trong 30 phút
    const timeout = parseInt(idleTimeoutMinutes, 10) || 30;
    req.input('idleTimeout', sql.Int, timeout);

    let q = `
      SELECT s.session_id, s.user_id, u.full_name, u.[rank], u.[position],
             s.ip, s.user_agent, s.created_at, s.last_seen_at, s.expires_at,
             DATEDIFF(MINUTE, s.last_seen_at, GETDATE()) AS minutes_idle
      FROM USER_SESSION s WITH (NOLOCK)
      JOIN [USER] u WITH (NOLOCK) ON u.user_id = s.user_id
      WHERE s.revoked = 0 
        AND s.expires_at > GETDATE()
        AND s.last_seen_at > DATEADD(MINUTE, -@idleTimeout, GETDATE())
    `;
    if (userId) {
      q += ` AND s.user_id = @uid`;
      req.input('uid', sql.VarChar(50), userId);
    }
    q += ` ORDER BY s.last_seen_at DESC`;
    return (await req.query(q)).recordset;
  }


    // ⏰ Tự động revoke các session idle quá lâu
  async function revokeIdleSessions(idleTimeoutMinutes = 30, reason = 'IDLE_TIMEOUT') {
    const pool = await getPool();
    const r = await pool.request()
      .input('timeout', sql.Int, idleTimeoutMinutes)
      .input('reason', sql.NVarChar(200), reason)
      .query(`
        UPDATE USER_SESSION
        SET revoked = 1,
            revoked_at = GETDATE(),
            revoked_reason = @reason
        WHERE revoked = 0
          AND expires_at > GETDATE()
          AND last_seen_at < DATEADD(MINUTE, -@timeout, GETDATE());
        SELECT @@ROWCOUNT AS n;
      `);
    const count = r.recordset[0]?.n || 0;
    if (count > 0) {
      console.log(`[Session] 🔒 Auto-revoked ${count} session(s) idle > ${idleTimeoutMinutes} phút`);
      cache.clear();
    }
    return count;
  }


  function invalidateTokenCache(token) {
    cache.delete(hashToken(token));
  }

  return {
    hashToken,
    createSession,
    validateSession,
    revokeSession,
    revokeAllUserSessions,
    killSessionById,
    listActiveSessions,
    revokeIdleSessions,
    invalidateTokenCache,
    // ✅ Export helpers để test
    _helpers: { ipType, isSameSubnet24 },
  };
};