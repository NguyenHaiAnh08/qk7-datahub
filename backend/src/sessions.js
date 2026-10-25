/**
 * sessions.js — JWT + Session Hybrid Validation
 * Cache 30 giây, IP binding, revoke tức thì.
 */

const crypto = require('crypto');

const CACHE_TTL_MS = 30 * 1000;
const cache = new Map(); // tokenHash → { valid, user_id, ip, reason, cachedAt }

function hashToken(rawJwt) {
  return crypto.createHash('sha256').update(rawJwt).digest('hex');
}

module.exports = function createSessionModule({
  sql, getPool, writeAccessLog, getClientIp,
}) {
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

    const cached = cache.get(tokenHash);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      if (!cached.valid) return { valid: false, reason: cached.reason };
      if (cached.ip && ip && cached.ip !== ip) {
        // Fire-and-forget audit — không block
        writeAccessLog({
          userId: cached.user_id, fileId: null,
          action: 'SESSION_IP_CHANGED', ip,
          note: `IP thay đổi từ ${cached.ip} → ${ip}`,
        }).catch(() => {});
      }
      return { valid: true, user_id: cached.user_id };
    }

    try {
      const pool = await getPool();
      const r = await pool.request()
        .input('tok', sql.Char(64), tokenHash)
        .query(`
          SELECT session_id, user_id, ip, expires_at, revoked, revoked_reason
          FROM USER_SESSION WHERE token = @tok
        `);

      if (r.recordset.length === 0) {
        cache.set(tokenHash, { valid: false, reason: 'SESSION_NOT_FOUND', cachedAt: Date.now() });
        return { valid: false, reason: 'SESSION_NOT_FOUND' };
      }

      const s = r.recordset[0];
      if (s.revoked) {
        const reason = s.revoked_reason || 'REVOKED';
        cache.set(tokenHash, { valid: false, reason, cachedAt: Date.now() });
        return { valid: false, reason };
      }
      if (new Date(s.expires_at) < new Date()) {
        cache.set(tokenHash, { valid: false, reason: 'EXPIRED', cachedAt: Date.now() });
        return { valid: false, reason: 'EXPIRED' };
      }
      if (s.ip && ip && s.ip !== ip) {
        writeAccessLog({
          userId: s.user_id, fileId: null,
          action: 'SESSION_IP_CHANGED', ip,
          note: `IP thay đổi từ ${s.ip} → ${ip}`,
        }).catch(() => {});
      }

      // Update last_seen (async)
      pool.request()
        .input('tok', sql.Char(64), tokenHash)
        .query(`UPDATE USER_SESSION SET last_seen_at = GETDATE() WHERE token = @tok`)
        .catch(() => {});

      cache.set(tokenHash, {
        valid: true, user_id: s.user_id, ip: s.ip, cachedAt: Date.now(),
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

  async function listActiveSessions(userId = null) {
    const pool = await getPool();
    const req = pool.request();
    let q = `
      SELECT s.session_id, s.user_id, u.full_name, u.[rank], u.[position],
             s.ip, s.user_agent, s.created_at, s.last_seen_at, s.expires_at,
             DATEDIFF(MINUTE, s.last_seen_at, GETDATE()) AS minutes_idle
      FROM USER_SESSION s
      JOIN [USER] u ON u.user_id = s.user_id
      WHERE s.revoked = 0 AND s.expires_at > GETDATE()
    `;
    if (userId) {
      q += ` AND s.user_id = @uid`;
      req.input('uid', sql.VarChar(50), userId);
    }
    q += ` ORDER BY s.last_seen_at DESC`;
    return (await req.query(q)).recordset;
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
    invalidateTokenCache,
  };
};