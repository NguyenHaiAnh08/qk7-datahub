// backend/src/approval-authority.js
// ═══════════════════════════════════════════════════════════════════════
// Thẩm quyền duyệt dựa trên BẢNG QUYỀN (không khóa cứng theo vai trò)
//
//   level 'FINAL'    — Admin (ROL-01) hoặc Chỉ huy (ROL-02) có quyền duyệt: duyệt là CHÍNH THỨC ngay.
//   level 'DELEGATE' — người khác được cấp quyền duyệt trong bảng quyền: chỉ "THẨM ĐỊNH".
//                      Yêu cầu vẫn chờ; Chỉ huy cấp trên xác nhận mới chính thức thành công.
//   level 'NONE'     — không có quyền duyệt (hoặc ngoài phạm vi / chưa chạy migration).
//
//   Admin bỏ qua mọi kiểm tra quyền (có toàn quyền). Chỉ huy phải được giữ quyền duyệt trong bảng quyền
//   (mặc định đã cấp; Admin có thể gỡ). Phạm vi: đơn vị của người duyệt và toàn bộ cấp dưới.
// ═══════════════════════════════════════════════════════════════════════
'use strict';
const { sql, getPool } = require('./db');
const { getSubtreeUnits, resolveUserUnitId } = require('./unit-scope');

const TARGETS = {
  APPROVAL_REQUEST:           { id: 'request_id',  pending: `status = 'PENDING'` },
  DOCUMENT_REVISION_PROPOSAL: { id: 'proposal_id', pending: `status = 'PENDING'` },
  DIGITAL_LECTURE:            { id: 'lecture_id',  pending: `status IN ('PENDING_FACULTY','PENDING_TRAINING')` },
};

let readyCache = { ok: false, at: 0 };
// Chưa chạy migration add_delegated_approval.cjs → KHÔNG mở rộng quyền (giữ hành vi cũ: chỉ Admin/Chỉ huy duyệt)
async function delegatedReady() {
  if (Date.now() - readyCache.at < 60 * 1000) return readyCache.ok;
  let ok = false;
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT COL_LENGTH('APPROVAL_REQUEST','validated_by') a,
             COL_LENGTH('DOCUMENT_REVISION_PROPOSAL','validated_by') b,
             COL_LENGTH('DIGITAL_LECTURE','validated_by') c`);
    const x = r.recordset[0];
    ok = Boolean(x.a && x.b && x.c);
  } catch (e) {
    console.warn('[approval-authority] kiểm tra migration lỗi:', e.message);
  }
  readyCache = { ok, at: Date.now() };
  return ok;
}

/**
 * Ghi nhận thẩm định của người không phải Chỉ huy/Admin. KHÔNG đổi trạng thái chính thức.
 * Trả về số dòng cập nhật (0 = yêu cầu không còn ở trạng thái chờ).
 */
async function recordValidation({ table, id, userId, decision, note }) {
  const t = TARGETS[table];
  if (!t) throw new Error('Bảng không hợp lệ');
  const pool = await getPool();
  const r = await pool.request()
    .input('id', sql.VarChar(50), id)
    .input('by', sql.VarChar(50), userId)
    .input('d', sql.VarChar(10), decision)
    .input('n', sql.NVarChar(500), note ? String(note).slice(0, 500) : null)
    .query(`UPDATE ${table}
            SET validated_by = @by, validated_at = GETDATE(), validate_decision = @d, validate_note = @n
            WHERE ${t.id} = @id AND ${t.pending};
            SELECT @@ROWCOUNT AS n;`);
  return r.recordset[0].n;
}

function createApprovalAuthority({ getUserPermissions, resolveUserRoles }) {
  /** @param permCode 'APPROVAL_VALIDATE' | 'LECTURE_APPROVE' */
  async function getAuthority(user, permCode) {
    if (!user?.user_id) return { level: 'NONE' };
    const roles = await resolveUserRoles(user);
    if (roles.includes('ROL-01') || user.user_id === 'USR-001') {
      return { level: 'FINAL', all: true, unitIds: [], roles };
    }
    const perms = await getUserPermissions(user.user_id);
    if (!perms.includes(permCode)) return { level: 'NONE', roles };
    const isCommander = roles.includes('ROL-02');
    if (!isCommander && !(await delegatedReady())) return { level: 'NONE', roles };
    const unitId = await resolveUserUnitId(user);
    if (!unitId) return { level: 'NONE', roles };
    const unitIds = await getSubtreeUnits(unitId);
    return { level: isCommander ? 'FINAL' : 'DELEGATE', all: false, unitId, unitIds, roles };
  }

  /** Người duyệt có phạm vi bao phủ ít nhất một trong các đơn vị này không */
  function covers(auth, unitIds, { strict = false } = {}) {
    if (!auth || auth.level === 'NONE') return false;
    if (auth.all) return true;
    const list = (unitIds || []).filter(Boolean);
    if (strict) return list.includes(auth.unitId);
    return list.some((u) => auth.unitIds.includes(u));
  }

  return { getAuthority, covers, recordValidation };
}

module.exports = { createApprovalAuthority, delegatedReady, recordValidation };
