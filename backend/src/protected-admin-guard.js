// src/protected-admin-guard.js
// ─────────────────────────────────────────────────────────────────────────────
// BẤT KHẢ XÂM PHẠM cho tài khoản Quản trị tối cao (mặc định USR-001).
//
// Vì sao cần: vai trò ROL-01 bypass mọi kiểm tra quyền → nếu chỉ dựa vào "có ROL-01", một admin khác
// (hoặc tài khoản admin bị chiếm) có thể xóa/khóa USR-001, đổi mật khẩu, thay vân tay, gỡ vai trò
// hoặc đá phiên của USR-001 → chiếm quyền tối cao. Guard này chạy SAU xác thực, TRƯỚC mọi route.
//
// Quy tắc:
//   • Người KHÁC USR-001: không được thực hiện BẤT KỲ thao tác ghi nào nhắm vào USR-001
//     (sửa/xóa user, đổi tài khoản/mật khẩu, vai trò, quyền, vân tay, PIN, mở khóa, kill phiên) và
//     không được sửa vai trò ROL-01 (tên, quyền).
//   • Chính USR-001: được đổi mật khẩu/vân tay/PIN của mình, nhưng KHÔNG được tự xóa, tự khóa
//     hay tự gỡ vai trò ROL-01 (chống thao tác nhầm làm mất quyền tối cao).
// ─────────────────────────────────────────────────────────────────────────────

module.exports = function createProtectedAdminGuard({ sql, getPool, writeAccessLog, getClientIp }) {
  const PROTECTED_ID = String(process.env.PROTECTED_ADMIN_USER_ID || 'USR-001').trim().toUpperCase();
  const ADMIN_ROLE = String(process.env.PROTECTED_ADMIN_ROLE_ID || 'ROL-01').trim().toUpperCase();

  const norm = (v) => {
    let s = String(v ?? '');
    try { s = decodeURIComponent(s); } catch (_) { /* giữ nguyên */ }
    return s.trim().toUpperCase(); // SQL Server so khớp không phân biệt hoa/thường và bỏ khoảng trắng cuối
  };

  // Thao tác chỉ chính chủ USR-001 được làm lên chính mình
  const SELF_ONLY_OK = [
    /^\/api\/admin\/users\/[^/]+\/credentials$/,
    /^\/api\/admin\/users\/[^/]+\/pin\/generate$/,
    /^\/api\/admin\/fingerprint\/enroll\/[^/]+$/,
  ];

  async function deny(req, res, reason) {
    try {
      await writeAccessLog({
        userId: req.user?.user_id || null, fileId: null, action: 'PROTECTED_ADMIN_BLOCKED',
        ip: getClientIp ? getClientIp(req) : null,
        note: `${req.method} ${String(req.originalUrl).split('?')[0]} — ${reason}`,
      });
    } catch (_) { /* không để log lỗi làm hỏng phản hồi */ }
    console.warn(`[SECURITY] PROTECTED_ADMIN_BLOCKED by=${req.user?.user_id} ${req.method} ${req.originalUrl} (${reason})`);
    return res.status(403).json({
      error: 'Tài khoản Quản trị tối cao được bảo vệ tuyệt đối: thao tác này bị từ chối.',
      code: 'PROTECTED_ADMIN_TARGET',
    });
  }

  return async function protectedAdminGuard(req, res, next) {
    try {
      const method = req.method.toUpperCase();
      if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();
      if (!req.user || !req.user.is_authenticated) return next(); // route tự xử lý 401

      const path = String(req.originalUrl || req.url).split('?')[0].replace(/\/+$/, '');
      const caller = norm(req.user.user_id);
      const callerIsOwner = caller === PROTECTED_ID;

      // 1) Vai trò Admin (ROL-01): chỉ USR-001 được sửa tên/quyền của vai trò này
      let m = path.match(/^\/api\/admin\/roles\/([^/]+)(\/.*)?$/i);
      if (m && norm(m[1]) === ADMIN_ROLE && !callerIsOwner) {
        return deny(req, res, `sửa vai trò ${ADMIN_ROLE}`);
      }

      // 2) Thao tác nhắm vào user
      let target = null;
      m = path.match(/^\/api\/admin\/users\/([^/]+)(\/.*)?$/i);
      if (m) target = norm(m[1]);
      if (!target) { m = path.match(/^\/api\/admin\/fingerprint\/enroll\/([^/]+)$/i); if (m) target = norm(m[1]); }
      if (!target) { m = path.match(/^\/api\/admin\/sessions\/user\/([^/]+)$/i); if (m) target = norm(m[1]); }

      // 3) Kill phiên theo session_id → tra user sở hữu phiên
      if (!target) {
        m = path.match(/^\/api\/admin\/sessions\/([^/]+)$/i);
        if (m && method === 'DELETE') {
          const pool = await getPool();
          const r = await pool.request()
            .input('s', sql.VarChar(100), decodeURIComponent(m[1]))
            .query(`SELECT user_id FROM USER_SESSION WHERE session_id = @s`);
          if (r.recordset.length > 0) target = norm(r.recordset[0].user_id);
        }
      }

      if (target !== PROTECTED_ID) return next();

      // Nhắm vào USR-001
      if (!callerIsOwner) return deny(req, res, `người khác tác động lên ${PROTECTED_ID}`);

      // Chính chủ: chỉ cho phép nhóm thao tác an toàn lên bản thân
      if (SELF_ONLY_OK.some((rx) => rx.test(path))) return next();
      if (/^\/api\/admin\/sessions\//i.test(path)) return next(); // tự đăng xuất phiên của mình
      return deny(req, res, `${PROTECTED_ID} không được tự xóa/khóa/gỡ vai trò của chính mình`);
    } catch (err) {
      // Lỗi nội bộ: TỪ CHỐI (fail-closed) thay vì để lọt thao tác nhắm vào tài khoản tối cao
      console.error('[protected-admin-guard]', err.message);
      return res.status(500).json({ error: 'Không thể xác minh đối tượng thao tác', code: 'GUARD_ERROR' });
    }
  };
};
