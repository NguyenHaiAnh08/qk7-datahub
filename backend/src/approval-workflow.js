/**
 * approval-workflow.js — Nguyên tắc 4 mắt cho hành động nguy hiểm
 */

const PROTECTED_ADMIN_USER_ID = process.env.PROTECTED_ADMIN_USER_ID || 'USR-001';
const PROTECTED_ADMIN_ROLE_ID = process.env.PROTECTED_ADMIN_ROLE_ID || 'ROL-01';

// Route KHÔNG áp dụng duyệt (auth, chính API approval)
const EXCLUDED_PATHS = [
  /^\/api\/admin\/approval-requests/,
  /^\/api\/admin\/protected-permissions/,
  /^\/api\/auth\//,
  /^\/api\/admin\/creatable-roles$/,
  /^\/api\/documents\/proposals\//,
];

module.exports = function createApprovalWorkflow({ 
  sql, getPool, writeAccessLog, getClientIp, getAutoRequiredPermission 
}) {
  let protectedSet = new Set();
  let cacheLoadedAt = 0;
  const CACHE_TTL_MS = 30 * 1000;

      async function loadProtectedPermissions(force = false) {
    if (!force && Date.now() - cacheLoadedAt < CACHE_TTL_MS) return protectedSet;
    try {
      const pool = await getPool();

      // ═══════════════════════════════════════════════════════════════
      // [FIX v4.3.2] JOIN PERMISSION để lấy `code` thay vì `permission_id`
      // ───────────────────────────────────────────────────────────────
      // admin-routes.js#getAutoRequiredPermission() trả về CODE ('USER_DELETE')
      // nhưng protectedSet cũ chứa ID ('PERM-USR-04') → luôn has() = false
      // → KHÔNG có yêu cầu phê duyệt nào được tạo.
      // ═══════════════════════════════════════════════════════════════
      const r = await pool.request().query(`
        SELECT p.code
        FROM PROTECTED_PERMISSION pp
        JOIN [PERMISSION] p ON p.permission_id = pp.permission_id
        WHERE p.code IS NOT NULL
      `);

      protectedSet = new Set(r.recordset.map(x => x.code));
      cacheLoadedAt = Date.now();

      if (protectedSet.size === 0) {
        console.warn('[approval] ⚠️  protectedSet rỗng — kiểm tra migration v4.3');
      } else {
        console.log(
          `[approval] 🔒 Loaded ${protectedSet.size} protected codes: ` +
          Array.from(protectedSet).sort().join(', ')
        );
      }
    } catch (err) {
      console.error('[approval] loadProtectedPermissions:', err.message);
    }
    return protectedSet;
  }

  function isProtectedAdmin(user) {
    if (!user) return false;
    if (user.user_id === PROTECTED_ADMIN_USER_ID) return true;
    if ((user.roles || []).includes(PROTECTED_ADMIN_ROLE_ID)) return true;
    return false;
  }

  async function approvalInterceptor(req, res, next) {
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) return next();

    const fullPath = (req.originalUrl || req.url || '').split('?')[0];
    if (EXCLUDED_PATHS.some(rx => rx.test(fullPath))) return next();
    if (isProtectedAdmin(req.user)) return next();

    // Admin đang thực thi 1 yêu cầu đã duyệt
    const overrideId = req.headers['x-approval-override'];
    if (overrideId) {
      try {
        const pool = await getPool();
        const r = await pool.request()
          .input('rid', sql.VarChar(50), overrideId)
          .query(`SELECT status FROM APPROVAL_REQUEST WHERE request_id = @rid`);
        if (r.recordset.length > 0 && r.recordset[0].status === 'APPROVED') {
          await pool.request()
            .input('rid', sql.VarChar(50), overrideId)
            .query(`UPDATE APPROVAL_REQUEST SET status='EXECUTING', executed_at=GETDATE() WHERE request_id=@rid`);
          return next();
        }
      } catch (err) { console.error('[approval] override:', err.message); }
      return res.status(403).json({ error: 'Mã phê duyệt không hợp lệ hoặc đã dùng' });
    }

    const requiredPerm = getAutoRequiredPermission(req.method, fullPath);
    if (!requiredPerm) return next();

    const protectedList = await loadProtectedPermissions();
    if (!protectedList.has(requiredPerm)) return next();

    // Tạo yêu cầu chờ duyệt
    const requestId = 'APV-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const bodyJson = (req.is('application/json') && req.body) ? JSON.stringify(req.body) : null;

    try {
      const pool = await getPool();
      await pool.request()
        .input('rid', sql.VarChar(50), requestId)
        .input('uid', sql.VarChar(50), req.user.user_id)
        .input('perm', sql.VarChar(50), requiredPerm)
        .input('method', sql.VarChar(10), req.method)
        .input('path', sql.VarChar(500), req.originalUrl || req.url)
        .input('body', sql.NVarChar(sql.MAX), bodyJson)
        .input('summary', sql.NVarChar(500), `${req.method} ${fullPath}`)
        .query(`
          INSERT INTO APPROVAL_REQUEST 
          (request_id, requester_id, required_permission, http_method, http_path, http_body, target_summary)
          VALUES (@rid, @uid, @perm, @method, @path, @body, @summary)
        `);

      await writeAccessLog({
        userId: req.user.user_id, fileId: null, action: 'APPROVAL_REQUESTED',
        ip: getClientIp(req),
        note: `[${requestId}] ${req.method} ${fullPath} — cần duyệt (perm=${requiredPerm})`,
      });

      return res.status(202).json({
        code: 'APPROVAL_REQUIRED',
        request_id: requestId,
        message: 'Thao tác cần được Quản trị viên phê duyệt trước khi thực thi.',
        required_permission: requiredPerm,
      });
    } catch (err) {
      console.error('[approval] create:', err.message);
      return res.status(500).json({ error: 'Không thể tạo yêu cầu phê duyệt' });
    }
  }

  return { approvalInterceptor, loadProtectedPermissions, isProtectedAdmin, PROTECTED_ADMIN_USER_ID };
};