// backend/migrations/seed_command_permission.cjs
// ═══════════════════════════════════════════════════════════════════════
// SEED QUYỀN KHÔNG GIAN CHỈ HUY (/command)
// Chạy thử (không ghi):  node backend/migrations/seed_command_permission.cjs --dry-run
// Chạy thật:             node backend/migrations/seed_command_permission.cjs
//
//   1. Tạo quyền COMMAND_VIEW (PERM-CMD-01) trong [PERMISSION]
//   2. Gán cho ROL-01 (Admin) và ROL-02 (Chỉ huy)
//
// IDEMPOTENT: chạy nhiều lần không tạo bản trùng, không lỗi.
// ═══════════════════════════════════════════════════════════════════════

const path = require('path');
require('dotenv').config({
  path: [path.join(__dirname, '..', '..', '.env'), path.join(__dirname, '..', '.env')],
});
const { getPool, closePool, sql } = require('../src/db');

const DRY = process.argv.includes('--dry-run');
const PERM = {
  id: 'PERM-CMD-01',
  code: 'COMMAND_VIEW',
  name: 'Xem không gian chỉ huy (tổng quan giám sát, chỉ đọc)',
  group: 'COMMAND',
  subgroup_key: 'command-view',
  subgroup_label: 'Giám sát chỉ huy',
  subgroup_tone: 'read',
  sort_order: 900,
};
const ROLES = ['ROL-01', 'ROL-02'];

async function hasColumn(pool, table, col) {
  const r = await pool.request()
    .input('t', sql.VarChar(128), table)
    .input('c', sql.VarChar(128), col)
    .query(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @t AND COLUMN_NAME = @c`);
  return r.recordset.length > 0;
}

(async () => {
  const pool = await getPool();
  console.log(DRY ? '=== DRY-RUN: không ghi vào DB ===' : '=== CHẠY THẬT ===');
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    // 1. PERMISSION
    const exists = await new sql.Request(tx).input('id', sql.VarChar(50), PERM.id)
      .query(`SELECT 1 FROM [PERMISSION] WHERE permission_id = @id OR code = '${PERM.code}'`);
    if (exists.recordset.length) {
      console.log(`⏭️  ${PERM.code} đã tồn tại, bỏ qua`);
    } else {
      const cols = ['permission_id', 'code', 'description', 'group_code', 'is_system', 'sort_order'];
      const vals = ['@id', '@code', '@desc', '@grp', '1', '@so'];
      const extra = [
        ['subgroup_key', 'sk', sql.VarChar(30), PERM.subgroup_key],
        ['subgroup_label', 'sl', sql.NVarChar(50), PERM.subgroup_label],
        ['subgroup_order', 'sor', sql.Int, 10],
        ['subgroup_tone', 'st', sql.VarChar(20), PERM.subgroup_tone],
      ];
      const req = new sql.Request(tx)
        .input('id', sql.VarChar(50), PERM.id)
        .input('code', sql.VarChar(50), PERM.code)
        .input('desc', sql.NVarChar(200), PERM.name)
        .input('grp', sql.VarChar(30), PERM.group)
        .input('so', sql.Int, PERM.sort_order);
      for (const [col, p, type, val] of extra) {
        if (await hasColumn(pool, 'PERMISSION', col)) {
          cols.push(col); vals.push('@' + p); req.input(p, type, val);
        }
      }
      await req.query(`INSERT INTO [PERMISSION] (${cols.join(', ')}) VALUES (${vals.join(', ')})`);
      console.log(`✅ Tạo quyền ${PERM.code} (${PERM.id})`);
    }

    // 2. ROLE_PERMISSION
    const perm = await new sql.Request(tx)
      .query(`SELECT permission_id FROM [PERMISSION] WHERE code = '${PERM.code}'`);
    const pid = perm.recordset[0]?.permission_id || PERM.id;
    for (const rid of ROLES) {
      const role = await new sql.Request(tx).input('r', sql.VarChar(50), rid)
        .query(`SELECT 1 FROM [ROLE] WHERE role_id = @r`);
      if (!role.recordset.length) { console.log(`⚠️  Không có vai trò ${rid}, bỏ qua`); continue; }
      const has = await new sql.Request(tx)
        .input('r', sql.VarChar(50), rid).input('p', sql.VarChar(50), pid)
        .query(`SELECT 1 FROM ROLE_PERMISSION WHERE role_id = @r AND permission_id = @p`);
      if (has.recordset.length) { console.log(`⏭️  ${rid} đã có ${PERM.code}`); continue; }
      await new sql.Request(tx)
        .input('r', sql.VarChar(50), rid).input('p', sql.VarChar(50), pid)
        .query(`INSERT INTO ROLE_PERMISSION (role_id, permission_id) VALUES (@r, @p)`);
      console.log(`✅ Gán ${PERM.code} cho ${rid}`);
    }

    if (DRY) { await tx.rollback(); console.log('↩️  DRY-RUN: đã rollback, không có gì được ghi.'); }
    else { await tx.commit(); console.log('✔ Hoàn tất. Khởi động lại backend để xóa cache quyền.'); }
  } catch (e) {
    try { await tx.rollback(); } catch (_) {}
    console.error('❌ Lỗi, đã rollback:', e.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
})();
