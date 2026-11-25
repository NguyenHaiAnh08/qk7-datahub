// backend/migrations/add_proposal_owner_review.cjs
// Bước "người đăng xem trước" cho đề xuất sửa văn bản của đơn vị khác:
//   người đề xuất → (PENDING_OWNER) người đăng A xem + chuyển lên → (PENDING) chỉ huy duyệt như cũ
// Thay đổi (chỉ thêm, không xóa dữ liệu):
//   1. DOCUMENT_REVISION_PROPOSAL: thêm owner_id, owner_decision, owner_decided_at, owner_note
//   2. Cho phép status = 'PENDING_OWNER' (thay CHECK constraint của cột status)
// Chạy:  node backend/migrations/add_proposal_owner_review.cjs [--dry-run]
// Chạy nhiều lần an toàn (idempotent). Chưa chạy migration thì tính năng tự tắt, luồng cũ giữ nguyên.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { getPool } = require('../src/db');

const DRY = process.argv.includes('--dry-run');
const TABLE = 'DOCUMENT_REVISION_PROPOSAL';

async function run(pool, label, query) {
  console.log(`${DRY ? '[dry-run] ' : ''}${label}`);
  if (!DRY) await pool.request().query(query);
}

(async () => {
  const pool = await getPool();

  const cols = [
    ['owner_id', 'VARCHAR(50) NULL'],
    ['owner_decision', 'VARCHAR(20) NULL'], // FORWARDED | REJECTED | AUTO
    ['owner_decided_at', 'DATETIME NULL'],
    ['owner_note', 'NVARCHAR(500) NULL'],
  ];
  for (const [name, type] of cols) {
    const has = (await pool.request().query(`SELECT COL_LENGTH('${TABLE}', '${name}') AS n`)).recordset[0].n;
    if (has) { console.log(`= cột ${name} đã có`); continue; }
    await run(pool, `+ thêm cột ${name}`, `ALTER TABLE ${TABLE} ADD ${name} ${type}`);
  }

  const cc = (await pool.request().query(`
    SELECT name, definition FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('${TABLE}') AND definition LIKE '%[[]status]%'
  `)).recordset;
  const already = cc.some((c) => c.definition.includes('PENDING_OWNER'));
  if (already) {
    console.log('= CHECK(status) đã cho phép PENDING_OWNER');
  } else {
    for (const c of cc) await run(pool, `- bỏ constraint ${c.name}`, `ALTER TABLE ${TABLE} DROP CONSTRAINT [${c.name}]`);
    await run(pool, '+ tạo CHECK(status) mới có PENDING_OWNER', `
      ALTER TABLE ${TABLE} ADD CONSTRAINT CK_PROPOSAL_STATUS
      CHECK (status IN ('PENDING_OWNER','PENDING','APPROVED','REJECTED','CANCELLED'))`);
  }
  console.log(DRY ? '\nDry-run xong, chưa thay đổi gì.' : '\nHoàn tất.');
  process.exit(0);
})().catch((e) => { console.error('Lỗi migration:', e.message); process.exit(1); });
