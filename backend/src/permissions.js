/**
 * permissions.js — Permission-Based RBAC Engine
 * Cache 5 phút, admin ROL-01 bypass tự động.
 */

const CACHE_TTL_MS = 5 * 1000;   // ← đổi thành 5 * 1000
const cache = new Map(); // userId → { codes, loadedAt }

module.exports = function createPermissionsModule({
  sql, getPool, writeAccessLog, getClientIp,
}) {
  async function getUserPermissions(userId) {
    if (!userId) return [];

    const cached = cache.get(userId);
    if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
      return cached.codes;
    }

    try {
      const pool = await getPool();
      const r = await pool.request()
        .input('uid', sql.VarChar(50), userId)
        .query(`
          SELECT DISTINCT p.code
          FROM [PERMISSION] p
          WHERE p.permission_id IN (
            SELECT rp.permission_id
            FROM USER_ROLE ur
            JOIN ROLE_PERMISSION rp ON rp.role_id = ur.role_id
            WHERE ur.user_id = @uid
              AND (ur.expires_at IS NULL OR ur.expires_at > GETDATE())
            UNION
            SELECT up.permission_id
            FROM USER_PERMISSION up
            WHERE up.user_id = @uid
              AND (up.expires_at IS NULL OR up.expires_at > GETDATE())
          )
          ORDER BY p.code
        `);
      const codes = r.recordset.map((x) => x.code);
      cache.set(userId, { codes, loadedAt: Date.now() });
      return codes;
    } catch (err) {
      console.error('[getUserPermissions]', err.message);
      return [];
    }
  }

  function invalidateCache(userId) {
    if (userId) cache.delete(userId);
    else cache.clear();
  }

  function isAdminBypass(req) {
    return (req.user?.roles || []).includes('ROL-01');
  }

  function requirePermission(requiredCode) {
    return async (req, res, next) => {
      if (!req.user?.is_authenticated) {
        return res.status(401).json({
          error: 'Cần đăng nhập để thực hiện thao tác này',
          code: 'UNAUTHENTICATED',
        });
      }
      if (isAdminBypass(req)) return next();

      try {
        const codes = await getUserPermissions(req.user.user_id);
        if (!codes.includes(requiredCode)) {
          if (writeAccessLog) {
            const ip = getClientIp ? getClientIp(req) : 'unknown';
            writeAccessLog({
              userId: req.user.user_id, fileId: null,
              action: 'PERMISSION_DENIED', ip,
              note: `Thiếu quyền: ${requiredCode}`,
            }).catch(() => {});
          }
          return res.status(403).json({
            error: `Bạn không có quyền thực hiện thao tác này (thiếu: ${requiredCode})`,
            code: 'PERMISSION_DENIED',
            required_permission: requiredCode,
          });
        }
        next();
      } catch (err) {
        console.error('[requirePermission]', err);
        res.status(500).json({ error: 'Lỗi kiểm tra phân quyền' });
      }
    };
  }

  function requireAnyPermission(requiredCodes) {
    return async (req, res, next) => {
      if (!req.user?.is_authenticated) {
        return res.status(401).json({ error: 'Cần đăng nhập', code: 'UNAUTHENTICATED' });
      }
      if (isAdminBypass(req)) return next();

      try {
        const codes = await getUserPermissions(req.user.user_id);
        if (!requiredCodes.some((c) => codes.includes(c))) {
          return res.status(403).json({
            error: `Cần ít nhất 1 trong các quyền: ${requiredCodes.join(', ')}`,
            code: 'PERMISSION_DENIED',
            required_permissions: requiredCodes,
          });
        }
        next();
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    };
  }

  return { getUserPermissions, invalidateCache, requirePermission, requireAnyPermission };
};