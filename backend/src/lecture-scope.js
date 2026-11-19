// backend/src/lecture-scope.js
// Phạm vi nhìn thấy Bài giảng số theo cây đơn vị (UNIT.parent_id)
//   - ROL-01 (Admin): thấy tất cả
//   - ROL-02 (Chỉ huy) và Trưởng/Chủ nhiệm (isDeptHead): thấy đơn vị mình + toàn bộ cấp dưới
//     (Chỉ huy cấp Trường có unit_id ở gốc cây → subtree phủ toàn trường)
//   - Còn lại (giảng viên): chỉ thấy đơn vị của mình (+ bài do chính mình đăng)
const { sql, getPool } = require('./db');
const { getSubtreeUnits, resolveUserUnitId } = require('./unit-scope');

async function getSiblingUnits(unitId) {
  const pool = await getPool();
  const r = await pool.request()
    .input('uid', sql.NVarChar(50), unitId)
    .query(`SELECT u.unit_id FROM UNIT u
            WHERE u.unit_id <> @uid
              AND u.parent_id IS NOT NULL
              AND (u.parent_id = (SELECT parent_id FROM UNIT WHERE unit_id = @uid)  -- bộ môn cùng khoa
                   OR u.unit_id  = (SELECT parent_id FROM UNIT WHERE unit_id = @uid))  -- chính khoa cha`);
  return r.recordset.map((x) => x.unit_id);
}

async function getLectureScope({ userId, roles, deptHead, includeSiblings = false }) {
  if (roles.includes('ROL-01')) {
    return { all: true, unitId: null, unitIds: [] };
  }
  const unitId = await resolveUserUnitId({ user_id: userId });
  if (!unitId) return { all: false, unitId: null, unitIds: [] };
  const useSubtree = deptHead || roles.includes('ROL-02');
  const unitIds = useSubtree ? await getSubtreeUnits(unitId) : [unitId];
  // Đơn vị ngang cấp (cùng đơn vị cha): được xem và dùng bài giảng của nhau.
  // Chỉ bật ở các route xem/mở ca, KHÔNG dùng cho duyệt/xóa.
  let siblingIds = [];
  if (includeSiblings) {
    siblingIds = await getSiblingUnits(unitId);
    for (const sid of siblingIds) if (!unitIds.includes(sid)) unitIds.push(sid);
  }
  return { all: false, unitId, unitIds, siblingIds };
}

// Gắn danh sách unit vào request, trả về "@su0,@su1,..." dùng trong IN (...)
function bindUnitIn(request, ids, prefix = 'su') {
  if (!ids || ids.length === 0) return 'NULL';
  ids.forEach((id, i) => request.input(`${prefix}${i}`, sql.NVarChar(50), id));
  return ids.map((_, i) => `@${prefix}${i}`).join(',');
}

const inScope = (scope, unitId) => scope.all || scope.unitIds.includes(unitId);
const isPeerUnit = (scope, unitId) => !scope.all && (scope.siblingIds || []).includes(unitId);

module.exports = { getLectureScope, bindUnitIn, inScope, isPeerUnit };