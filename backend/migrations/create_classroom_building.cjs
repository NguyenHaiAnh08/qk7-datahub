// backend/migrations/create_classroom_building.cjs
// ═══════════════════════════════════════════════════════════════════════
// TẠO BẢNG KHU GIẢNG ĐƯỜNG (CLASSROOM_BUILDING) để quản lý (CRUD) thay vì viết cứng trong code.
// Chạy thử:  node backend/migrations/create_classroom_building.cjs --dry-run
// Chạy thật: node backend/migrations/create_classroom_building.cjs
//
//   1. Tạo bảng CLASSROOM_BUILDING nếu chưa có
//   2. Nạp dữ liệu từ các khu đang dùng trong CLASSROOM (building_code),
//      lấy tên hiển thị hiện tại (H1/H2/HT/PM) để giao diện không đổi
//
// IDEMPOTENT: chạy nhiều lần không tạo bản trùng.
// ═══════════════════════════════════════════════════════════════════════
const path = require('path');
require('dotenv').config({
  path: [path.join(__dirname, '..', '..', '.env'), path.join(__dirname, '..', '.env')],
});
const { getPool, closePool, sql } = require('../src/db');

const DRY = process.argv.includes('--dry-run');

// Tên hiển thị hiện tại (trước đây viết cứng trong lecture-routes.js)
const KNOWN = {
  H1: { name: 'Khu Giảng đường H1', order: 10 },
  H2: { name: 'Khu Giảng đường H2', order: 20 },
  HT: { name: 'Khu Hội trường Quân sự', order: 30 },
  PM: { name: 'Khu Công nghệ / Phòng máy', order: 40 },
};

(async () => {
  const pool = await getPool();
  console.log(DRY ? '=== DRY-RUN: không ghi vào DB ===' : '=== CHẠY THẬT ===');
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).query(`
      IF OBJECT_ID('dbo.CLASSROOM_BUILDING', 'U') IS NULL
      CREATE TABLE dbo.CLASSROOM_BUILDING (
        building_code  VARCHAR(20)   NOT NULL CONSTRAINT PK_CLASSROOM_BUILDING PRIMARY KEY,
        building_name  NVARCHAR(100) NOT NULL,
        display_order  INT           NOT NULL CONSTRAINT DF_CLASSROOM_BUILDING_ORDER DEFAULT 0,
        active         BIT           NOT NULL CONSTRAINT DF_CLASSROOM_BUILDING_ACTIVE DEFAULT 1,
        created_at     DATETIME      NOT NULL CONSTRAINT DF_CLASSROOM_BUILDING_CREATED DEFAULT GETDATE()
      )`);
    console.log('✔ Bảng CLASSROOM_BUILDING sẵn sàng');

    const used = await new sql.Request(tx).query(`
      SELECT building_code, MAX(building_name) AS building_name
      FROM CLASSROOM WHERE building_code IS NOT NULL GROUP BY building_code`);

    let order = 100;
    for (const row of used.recordset) {
      const code = row.building_code;
      const exists = await new sql.Request(tx).input('c', sql.VarChar(20), code)
        .query(`SELECT 1 FROM CLASSROOM_BUILDING WHERE building_code = @c`);
      if (exists.recordset.length) { console.log(`⏭️  ${code} đã có`); continue; }
      const known = KNOWN[code];
      const name = known?.name || row.building_name || `Khu ${code}`;
      const ord = known?.order ?? (order += 10);
      await new sql.Request(tx)
        .input('c', sql.VarChar(20), code)
        .input('n', sql.NVarChar(100), name)
        .input('o', sql.Int, ord)
        .query(`INSERT INTO CLASSROOM_BUILDING (building_code, building_name, display_order, active)
                VALUES (@c, @n, @o, 1)`);
      console.log(`✅ Thêm khu ${code} — ${name}`);
    }

    if (DRY) { await tx.rollback(); console.log('↩️  DRY-RUN: đã rollback.'); }
    else { await tx.commit(); console.log('✔ Hoàn tất.'); }
  } catch (e) {
    try { await tx.rollback(); } catch (_) {}
    console.error('❌ Lỗi, đã rollback:', e.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
})();
