// backend/src/lecture-scope.js
// Phạm vi nhìn thấy Bài giảng số theo cây đơn vị (UNIT.parent_id)
//   - ROL-01 (Admin): thấy tất cả
//   - ROL-02 (Chỉ huy) và Trưởng/Chủ nhiệm (isDeptHead): thấy đơn vị mình + toàn bộ cấp dưới
//     (Chỉ huy cấp Trường có unit_id ở gốc cây → subtree phủ toàn trường)
//   - Còn lại (giảng viên): chỉ thấy đơn vị của mình (+ bài do chính mình đăng)
const { sql } = require('./db');
const { getSubtreeUnits, resolveUserUnitId } = require('./unit-scope');

async function getLectureScope({ userId, roles, deptHead }) {
  if (roles.includes('ROL-01')) {
    return { all: true, unitId: null, unitIds: [] };
  }
  const unitId = await resolveUserUnitId({ user_id: userId });
  if (!unitId) return { all: false, unitId: null, unitIds: [] };
  const useSubtree = deptHead || roles.includes('ROL-02');
  const unitIds = useSubtree ? await getSubtreeUnits(unitId) : [unitId];
  return { all: false, unitId, unitIds };
}

// Gắn danh sách unit vào request, trả về "@su0,@su1,..." dùng trong IN (...)
function bindUnitIn(request, ids, prefix = 'su') {
  if (!ids || ids.length === 0) return 'NULL';
  ids.forEach((id, i) => request.input(`${prefix}${i}`, sql.NVarChar(50), id));
  return ids.map((_, i) => `@${prefix}${i}`).join(',');
}

const inScope = (scope, unitId) => scope.all || scope.unitIds.includes(unitId);

module.exports = { getLectureScope, bindUnitIn, inScope };