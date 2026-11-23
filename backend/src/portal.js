// backend/src/portal.js
// ═══════════════════════════════════════════════════════════════════════════
// HAI CỔNG ĐĂNG NHẬP
//   datahub  — Trung tâm dữ liệu số (khu làm việc): MỌI vai trò được vào.
//   training — Quản lý đào tạo (khu giám sát): chỉ vai trò có trong bảng ROLE_PORTAL (mặc định ROL-01 Admin,
//              ROL-02 Chỉ huy). Muốn cho thêm vai trò nào vào cổng này sau này: thêm 1 dòng vào ROLE_PORTAL.
//
// Quy tắc đa vai trò: được vào cổng nếu ÍT NHẤT MỘT vai trò thuộc cổng đó (Chỉ huy/Admin + vai trò khác → vào cả 2).
// Mỗi phiên đăng nhập gắn với 1 cổng (claim `portal` trong JWT + cột USER_SESSION.portal). Muốn dùng cổng kia:
// đăng xuất rồi đăng nhập lại, hoặc mở tab khác đăng nhập (mỗi cổng có phiên riêng).
// ═══════════════════════════════════════════════════════════════════════════
const { memo } = require('./memo');

const PORTAL_DATAHUB = 'datahub';
const PORTAL_TRAINING = 'training';
const VALID_PORTALS = [PORTAL_DATAHUB, PORTAL_TRAINING];

// Dùng khi chưa chạy migration tạo bảng ROLE_PORTAL (không làm hỏng đăng nhập)
const DEFAULT_TRAINING_ROLES = ['ROL-01', 'ROL-02', 'ROL-07'];

// Các API chỉ nhận token cổng Đào tạo. HIỆN ĐỂ TRỐNG: cổng chỉ quyết định AI được đăng nhập vào đâu
// (giám sát = ROL-01/ROL-02, sử dụng = còn lại). Bên trong hệ thống, chức năng hiển thị/dùng được hay không
// chỉ theo QUYỀN như trước (admin đăng nhập cổng nào cũng thấy và dùng đầy đủ).
// Muốn khóa riêng 1 API cho cổng Đào tạo: thêm regex vào đây (không cần sửa chỗ khác).
const TRAINING_ONLY_PATHS = [];

function normalizePortal(input) {
  const p = String(input || '').trim().toLowerCase();
  return VALID_PORTALS.includes(p) ? p : PORTAL_DATAHUB;
}

function createPortalModule({ sql, getPool }) {
  async function trainingRoles() {
    return memo('portal:training-roles', 30 * 1000, async () => {
      try {
        const pool = await getPool();
        const r = await pool.request()
          .query(`SELECT role_id FROM ROLE_PORTAL WHERE portal = 'training'`);
        return r.recordset.map((x) => x.role_id);
      } catch {
        return DEFAULT_TRAINING_ROLES; // bảng chưa tồn tại
      }
    });
  }

  // roles: mảng role_id còn hiệu lực của người dùng
  async function canEnterPortal(roles, portal) {
    if (portal === PORTAL_DATAHUB) return true;
    if (portal === PORTAL_TRAINING) {
      const allowed = await trainingRoles();
      return (roles || []).some((r) => allowed.includes(r));
    }
    return false;
  }

  async function allowedPortals(roles) {
    const out = [PORTAL_DATAHUB];
    if (await canEnterPortal(roles, PORTAL_TRAINING)) out.push(PORTAL_TRAINING);
    return out;
  }

  return { canEnterPortal, allowedPortals };
}

function isTrainingOnlyPath(fullPath) {
  const p = String(fullPath || '').split('?')[0];
  return TRAINING_ONLY_PATHS.some((rx) => rx.test(p));
}

module.exports = {
  createPortalModule, normalizePortal, isTrainingOnlyPath,
  PORTAL_DATAHUB, PORTAL_TRAINING, VALID_PORTALS,
};
