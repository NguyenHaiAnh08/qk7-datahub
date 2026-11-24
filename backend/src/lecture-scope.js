// backend/src/lecture-scope.js
// Phạm vi nhìn thấy / quản lý Bài giảng số theo cây đơn vị (UNIT.parent_id)
//   - ROL-01 (Admin): thấy và quản lý tất cả
//   - ROL-02 (Chỉ huy) và Trưởng/Chủ nhiệm (isDeptHead): đơn vị mình + toàn bộ cấp dưới (kế thừa từ dưới lên)
//   - Ban Giám hiệu (LECTURE_SCHOOL_WIDE_UNITS, mặc định BGH-TQSQK) có Chỉ huy: thấy toàn trường vì là cấp trên của mọi khoa/phòng
//   - Còn lại (giảng viên): đơn vị mình + đơn vị NGANG CẤP LIỀN KỀ (cùng đơn vị cha) + chính đơn vị cha
//     → tổ A và tổ B cùng thuộc Khoa CNTT thấy bài của nhau; nhưng KHOA/PHÒNG ngang cấp nhau (cha là Trường)
//       thì KHÔNG thấy của nhau — khoa nào khoa đấy lo, phòng nào phòng đấy lo.
const { sql, getPool } = require('./db');
const { memo } = require('./memo');
const { getSubtreeUnits, resolveUserUnitId } = require('./unit-scope');

// Đơn vị cha thuộc các loại này là cấp "gốc": các con của nó (khoa, phòng, tiểu đoàn...) KHÔNG chia sẻ bài cho nhau
const TOP_LEVEL_PARENT_TYPES = ['nha_truong', 'quan_khu', 'trung_uong'];

// Hằng số cố định trong mã nguồn (không nhận từ người dùng) nên nhúng thẳng vào SQL an toàn
const TOP_TYPES_SQL = TOP_LEVEL_PARENT_TYPES.map((t) => `'${t}'`).join(',');

const SCHOOL_WIDE_UNITS = String(process.env.LECTURE_SCHOOL_WIDE_UNITS || 'BGH-TQSQK')
  .split(',').map((s) => s.trim()).filter(Boolean);

async function getSiblingUnits(unitId) {
  const ids = await memo(`siblings:${unitId}`, 15 * 1000, async () => {
    const pool = await getPool();
    const r = await pool.request()
      .input('uid', sql.NVarChar(50), unitId)
      .query(`SELECT u.unit_id FROM UNIT u
              WHERE u.unit_id <> @uid
                AND u.parent_id IS NOT NULL
                -- chỉ chia sẻ khi đơn vị cha KHÔNG phải cấp gốc (Trường/Quân khu/Trung ương)
                AND EXISTS (SELECT 1 FROM UNIT me
                            JOIN UNIT par ON par.unit_id = me.parent_id
                            WHERE me.unit_id = @uid
                              AND par.unit_type NOT IN (${TOP_TYPES_SQL}))
                AND (u.parent_id = (SELECT parent_id FROM UNIT WHERE unit_id = @uid)   -- tổ/bộ môn/ban cùng khoa/phòng
                     OR u.unit_id  = (SELECT parent_id FROM UNIT WHERE unit_id = @uid)) -- chính khoa/phòng cha`);
    return r.recordset.map((x) => x.unit_id);
  });
  return ids.slice();
}

async function getLectureScope({ userId, roles, deptHead, includeSiblings = false }) {
  if (roles.includes('ROL-01')) {
    return { all: true, unitId: null, unitIds: [] };
  }
  const unitId = await resolveUserUnitId({ user_id: userId });
  if (!unitId) return { all: false, unitId: null, unitIds: [] };
  // Chỉ huy Ban Giám hiệu: cấp trên của mọi khoa/phòng → thấy toàn trường
  if (roles.includes('ROL-02') && SCHOOL_WIDE_UNITS.includes(unitId)) {
    return { all: true, unitId, unitIds: [], siblingIds: [] };
  }
  const useSubtree = deptHead || roles.includes('ROL-02');
  const unitIds = useSubtree ? await getSubtreeUnits(unitId) : [unitId];
  // Đơn vị ngang cấp liền kề (cùng đơn vị cha, cha không phải cấp gốc): xem/dùng/quản lý bài của nhau.
  // Chỉ bật ở các route xem/mở ca/sửa, KHÔNG dùng cho duyệt.
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

const isDeptHeadByPosition = (user) => {
  const pos = String(user?.position || '').toLowerCase();
  return pos.includes('trưởng bộ môn') || pos.includes('trưởng khoa')
      || pos.includes('chủ nhiệm khoa') || pos.includes('trưởng phòng');
};

// Ai được sửa/xóa mềm/thay tệp bài giảng này:
//   - Admin: mọi bài, mọi trạng thái
//   - Tác giả của bài
//   - Thành viên cùng khoa/phòng (và Chỉ huy cấp trên theo kế thừa) — "khoa nào khoa đấy lo"
// Việc có phải qua Chỉ huy duyệt hay không do quyền bị Admin khóa duyệt quyết định (cơ chế approval-workflow).
async function canManageLecture({ userId, roles, deptHead, lecture }) {
  if (roles.includes('ROL-01')) return { ok: true, admin: true };
  if (lecture.author_id === userId) return { ok: true, admin: false, author: true };
  const scope = await getLectureScope({ userId, roles, deptHead, includeSiblings: true });
  return { ok: inScope(scope, lecture.faculty_unit_id), admin: false, author: false };
}

module.exports = {
  getLectureScope, bindUnitIn, inScope, isPeerUnit, canManageLecture, isDeptHeadByPosition,
};
