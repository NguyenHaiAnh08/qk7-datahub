// backend/migrations/add_delegated_approval.cjs
// ═══════════════════════════════════════════════════════════════════════
// Duyệt theo BẢNG QUYỀN + "thẩm định" chờ Chỉ huy cấp trên xác nhận
//
//   - Quyền duyệt do bảng quyền quyết định: APPROVAL_VALIDATE (yêu cầu / đề xuất sửa văn bản)
//     và LECTURE_APPROVE (bài giảng). Mặc định Admin (ROL-01, bỏ qua mọi kiểm tra) và Chỉ huy (ROL-02)
//     có đủ; Admin có thể cấp thêm cho vai trò khác trong trang Vai trò.
//   - Người KHÔNG phải Admin/Chỉ huy mà có quyền duyệt chỉ "thẩm định": yêu cầu vẫn ở trạng thái chờ,
//     ghi người thẩm định + ý kiến; chỉ khi Chỉ huy cấp trên xác nhận mới chính thức thành công.
//
// Migration: thêm cột validated_by / validated_at / validate_decision / validate_note cho
// APPROVAL_REQUEST, DOCUMENT_REVISION_PROPOSAL, DIGITAL_LECTURE và cấp APPROVAL_VALIDATE cho ROL-02.
//
// Chạy:  node backend/migrations/add_delegated_approval.cjs      (IDEMPOTENT)
// ═══════════════════════════════════════════════════════════════════════
const path = require('path');
require('dotenv').config({
  path: [path.join(__dirname, '..', '..', '.env'), path.join(__dirname, '..', '.env')],
});
const { getPool, closePool, sql } = require('../src/db');

const TABLES = ['APPROVAL_REQUEST', 'DOCUMENT_REVISION_PROPOSAL', 'DIGITAL_LECTURE'];

(async () => {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    for (const t of TABLES) {
      await new sql.Request(tx).query(`
        IF COL_LENGTH('${t}', 'validated_by') IS NULL ALTER TABLE ${t} ADD validated_by VARCHAR(50) NULL;
        IF COL_LENGTH('${t}', 'validated_at') IS NULL ALTER TABLE ${t} ADD validated_at DATETIME NULL;
        IF COL_LENGTH('${t}', 'validate_decision') IS NULL ALTER TABLE ${t} ADD validate_decision VARCHAR(10) NULL;
        IF COL_LENGTH('${t}', 'validate_note') IS NULL ALTER TABLE ${t} ADD validate_note NVARCHAR(500) NULL;
      `);
      console.log(`= ${t}: cột thẩm định sẵn sàng`);
    }

    // Mặc định Chỉ huy (ROL-02) có quyền duyệt yêu cầu / đề xuất (Admin bỏ qua kiểm tra quyền)
    const perm = await new sql.Request(tx).query(`SELECT permission_id FROM PERMISSION WHERE code = 'APPROVAL_VALIDATE'`);
    const roleOk = await new sql.Request(tx).query(`SELECT 1 AS ok FROM [ROLE] WHERE role_id = 'ROL-02'`);
    if (perm.recordset.length && roleOk.recordset.length) {
      const pid = perm.recordset[0].permission_id;
      const r = await new sql.Request(tx).input('p', sql.VarChar(50), pid).query(`
        IF NOT EXISTS (SELECT 1 FROM ROLE_PERMISSION WHERE role_id = 'ROL-02' AND permission_id = @p)
          INSERT INTO ROLE_PERMISSION (role_id, permission_id) VALUES ('ROL-02', @p)`);
      console.log(`${r.rowsAffected[0] ? '+ Cấp' : '= Đã có'} APPROVAL_VALIDATE → ROL-02`);
    } else {
      console.log('! Bỏ qua cấp quyền: thiếu quyền APPROVAL_VALIDATE hoặc vai trò ROL-02');
    }

    await new sql.Request(tx).query(`
      UPDATE PERMISSION SET description = N'Duyệt yêu cầu / đề xuất trong phạm vi đơn vị (Chỉ huy duyệt chính thức; người khác chỉ thẩm định, cần Chỉ huy cấp trên xác nhận)'
      WHERE code = 'APPROVAL_VALIDATE';
      UPDATE PERMISSION SET description = N'Phê duyệt bài giảng 2 cấp (Chỉ huy duyệt chính thức; người khác chỉ thẩm định, cần Chỉ huy cấp trên xác nhận)'
      WHERE code = 'LECTURE_APPROVE';
    `);

    await tx.commit();
    console.log('Hoàn tất.');
  } catch (e) {
    await tx.rollback();
    console.error('LỖI, đã hoàn tác:', e.message);
    process.exitCode = 1;
  }
  await closePool();
})();
