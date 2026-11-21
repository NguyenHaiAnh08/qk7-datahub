// backend/migrations/add_approval_validate_permission.cjs
// ═══════════════════════════════════════════════════════════════════════
// Tạo quyền APPROVAL_VALIDATE ("Duyệt yêu cầu") và gán cho Chỉ huy (ROL-02)
// + Trưởng bộ môn (ROL-06).
//
// Lý do: trang "Hàng chờ phê duyệt" + thông báo/số đếm ở thanh trên dùng quyền này,
// nhưng quyền chưa tồn tại → Chỉ huy bị 403 và không có thông báo, mọi yêu cầu chỉ
// Admin thấy. Phạm vi duyệt vẫn do backend giới hạn theo đơn vị (canUserApproveRequest).
//
// Chạy:  node backend/migrations/add_approval_validate_permission.cjs
// IDEMPOTENT: chạy nhiều lần an toàn. Sau khi chạy phải KHỞI ĐỘNG LẠI backend
// và người dùng đăng nhập lại (hoặc tải lại trang) để nhận quyền mới.
// ═══════════════════════════════════════════════════════════════════════
const path = require('path');
require('dotenv').config({
  path: [path.join(__dirname, '..', '..', '.env'), path.join(__dirname, '..', '.env')],
});
const { getPool, closePool, sql } = require('../src/db');

const PERM_ID = 'PERM-APR-01';
const CODE = 'APPROVAL_VALIDATE';
const ROLES = ['ROL-02', 'ROL-06'];

(async () => {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const ex = await new sql.Request(tx).input('c', sql.VarChar(100), CODE)
      .query(`SELECT permission_id FROM PERMISSION WHERE code = @c`);
    let id = ex.recordset[0]?.permission_id;
    if (!id) {
      id = PERM_ID;
      await new sql.Request(tx)
        .input('id', sql.VarChar(50), id).input('c', sql.VarChar(100), CODE)
        .query(`INSERT INTO PERMISSION (permission_id, code, description, group_code, is_system, sort_order)
                VALUES (@id, @c, N'Duyệt yêu cầu (trong phạm vi đơn vị của mình)', 'AUDIT', 1, 910)`);
      console.log(`+ Tạo quyền ${CODE} (${id})`);
    } else {
      console.log(`= Quyền ${CODE} đã có (${id})`);
    }
    for (const role of ROLES) {
      const r = await new sql.Request(tx)
        .input('r', sql.VarChar(50), role).input('p', sql.VarChar(50), id)
        .query(`IF NOT EXISTS (SELECT 1 FROM ROLE_PERMISSION WHERE role_id=@r AND permission_id=@p)
                  INSERT INTO ROLE_PERMISSION (role_id, permission_id) VALUES (@r, @p)`);
      console.log(`${r.rowsAffected[0] ? '+ Gán' : '= Đã gán'} ${CODE} cho ${role}`);
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    console.error('LỖI, đã hoàn tác:', e.message);
    process.exitCode = 1;
  }
  await closePool();
})();
