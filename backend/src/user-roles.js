// backend/src/user-roles.js
// ═══════════════════════════════════════════════════════════════
// CẤU HÌNH PHÂN QUYỀN TẠO USER
// Chỉnh sửa DUY NHẤT file này khi muốn đổi role IDs
// ═══════════════════════════════════════════════════════════════

// Role Admin — toàn quyền tạo user với MỌI role
const ADMIN_ROLE_ID = 'ROL-01';

// Role ID của "Trợ lý"
const ASSISTANT_ROLE_ID = 'ROL-03';

// Role ID của "Chỉ huy"
const COMMANDER_ROLE_IDS = ['ROL-02']; // ← Có thể có nhiều

// Danh sách role mà user KHÔNG PHẢI Admin được phép tạo
// (chỉ gồm Trợ lý + Chỉ huy)
const NON_ADMIN_CREATABLE_ROLES = [
  ASSISTANT_ROLE_ID,
  ...COMMANDER_ROLE_IDS,
].filter(Boolean);

module.exports = {
  ADMIN_ROLE_ID,
  ASSISTANT_ROLE_ID,
  COMMANDER_ROLE_IDS,
  NON_ADMIN_CREATABLE_ROLES,
};