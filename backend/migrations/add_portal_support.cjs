// backend/migrations/add_portal_support.cjs
// ═══════════════════════════════════════════════════════════════════════
// Hỗ trợ 2 cổng đăng nhập (Trung tâm dữ liệu số / Quản lý đào tạo):
//   1. Bảng ROLE_PORTAL(role_id, portal): vai trò nào được vào cổng nào.
//      Mặc định cổng 'training' (giám sát) chỉ có ROL-01 (Admin) và ROL-02 (Chỉ huy).
//      Cổng 'datahub' ai cũng vào được nên không cần dòng nào.
//   2. Cột USER_SESSION.portal: mỗi phiên gắn với 1 cổng (để 1 tài khoản có thể đăng nhập
//      đồng thời mỗi cổng 1 phiên — 2 tab). Phiên cũ (portal NULL) được coi là 'datahub'.
//
// Chạy:  node backend/migrations/add_portal_support.cjs
// IDEMPOTENT. Backend chạy được cả khi CHƯA chạy migration (tự dùng mặc định ROL-01/ROL-02 và
// bỏ qua cột portal), nhưng phải chạy migration thì mới có phiên riêng cho từng cổng.
//
// Thêm vai trò vào cổng giám sát sau này, ví dụ cho Trợ lý (ROL-03):
//   INSERT INTO ROLE_PORTAL (role_id, portal) VALUES ('ROL-03', 'training');
// (Tối đa 30 giây sau backend mới nhận thay đổi.)
// ═══════════════════════════════════════════════════════════════════════
const path = require('path');
require('dotenv').config({
  path: [path.join(__dirname, '..', '..', '.env'), path.join(__dirname, '..', '.env')],
});
const { getPool, closePool, sql } = require('../src/db');

(async () => {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).query(`
      IF OBJECT_ID('ROLE_PORTAL', 'U') IS NULL
        CREATE TABLE ROLE_PORTAL (
          role_id VARCHAR(50) NOT NULL,
          portal  VARCHAR(20) NOT NULL,
          CONSTRAINT PK_ROLE_PORTAL PRIMARY KEY (role_id, portal),
          CONSTRAINT CK_ROLE_PORTAL_PORTAL CHECK (portal IN ('datahub', 'training'))
        );
    `);
    console.log('= Bảng ROLE_PORTAL sẵn sàng');

    for (const role of ['ROL-01', 'ROL-02']) {
      const exists = await new sql.Request(tx).input('r', sql.VarChar(50), role)
        .query(`SELECT 1 AS ok FROM [ROLE] WHERE role_id = @r`);
      if (!exists.recordset.length) { console.log(`! Bỏ qua ${role}: không có trong bảng ROLE`); continue; }
      const r = await new sql.Request(tx).input('r', sql.VarChar(50), role)
        .query(`IF NOT EXISTS (SELECT 1 FROM ROLE_PORTAL WHERE role_id = @r AND portal = 'training')
                  INSERT INTO ROLE_PORTAL (role_id, portal) VALUES (@r, 'training')`);
      console.log(`${r.rowsAffected[0] ? '+ Thêm' : '= Đã có'} ${role} → training`);
    }

    await new sql.Request(tx).query(`
      IF COL_LENGTH('USER_SESSION', 'portal') IS NULL
        ALTER TABLE USER_SESSION ADD portal VARCHAR(20) NULL;
    `);
    console.log('= Cột USER_SESSION.portal sẵn sàng');

    await tx.commit();
  } catch (e) {
    await tx.rollback();
    console.error('LỖI, đã hoàn tác:', e.message);
    process.exitCode = 1;
  }
  await closePool();
})();
