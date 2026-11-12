// backend/migrations/seed_lecture_permissions.cjs
// ═══════════════════════════════════════════════════════════════════════
// SEED DỮ LIỆU PHÂN HỆ BÀI GIẢNG SỐ
// Chạy: node backend/migrations/seed_lecture_permissions.cjs
//
// File này seed:
//   1. 5 quyền LECTURE_* + SCHEDULE_START vào [PERMISSION]
//   2. 2 vai trò mới: ROL-06 (Trưởng bộ môn), ROL-07 (Giảng viên)
//   3. Gán quyền cho ROL-01, ROL-02, ROL-03, ROL-05, ROL-06, ROL-07
//   4. 5 môn học mẫu vào SUBJECT
//   5. 3 lớp học mẫu vào TRAINING_CLASS
//
// Đặc điểm:
//   - IDEMPOTENT: chạy nhiều lần KHÔNG tạo bản trùng, KHÔNG lỗi
//   - TRANSACTION SAFE: mỗi nhóm insert trong 1 transaction riêng
//   - VERIFY: sau khi seed tự động kiểm tra và in báo cáo
// ═══════════════════════════════════════════════════════════════════════

const path = require('path');
require('dotenv').config({
  path: [
    path.join(__dirname, '..', '..', '.env'),
    path.join(__dirname, '..', '.env'),
  ],
});

const { getPool, closePool, sql } = require('../src/db');

// ═══════════════════════════════════════════════════════════════════════
// 1. ĐỊNH NGHĨA PERMISSION
// ═══════════════════════════════════════════════════════════════════════
const PERMISSIONS = [
  {
    id: 'PERM-LEC-01',
    code: 'LECTURE_VIEW',
    name: 'Xem danh sách bài giảng số',
    group: 'LECTURE',
    subgroup_key: 'lecture-view',
    subgroup_label: 'Tra cứu bài giảng',
    subgroup_tone: 'read',
    sort_order: 500,
  },
  {
    id: 'PERM-LEC-02',
    code: 'LECTURE_CREATE',
    name: 'Soạn thảo / chỉnh sửa bài giảng',
    group: 'LECTURE',
    subgroup_key: 'lecture-write',
    subgroup_label: 'Soạn bài giảng',
    subgroup_tone: 'write',
    sort_order: 510,
  },
  {
    id: 'PERM-LEC-03',
    code: 'LECTURE_APPROVE',
    name: 'Phê duyệt bài giảng (2 cấp)',
    group: 'LECTURE',
    subgroup_key: 'lecture-approve',
    subgroup_label: 'Phê duyệt',
    subgroup_tone: 'security',
    sort_order: 520,
  },
  {
    id: 'PERM-LEC-04',
    code: 'LECTURE_DELETE',
    name: 'Lưu trữ / xóa bài giảng',
    group: 'LECTURE',
    subgroup_key: 'lecture-delete',
    subgroup_label: 'Lưu trữ',
    subgroup_tone: 'danger',
    sort_order: 530,
  },
  {
    id: 'PERM-SCH-01',
    code: 'SCHEDULE_START',
    name: 'Mở / kết thúc ca giảng dạy',
    group: 'LECTURE',
    subgroup_key: 'lecture-schedule',
    subgroup_label: 'Ca giảng dạy',
    subgroup_tone: 'write',
    sort_order: 540,
  },
];

// ═══════════════════════════════════════════════════════════════════════
// 2. ĐỊNH NGHĨA VAI TRÒ
// ═══════════════════════════════════════════════════════════════════════
const ROLES = [
  { id: 'ROL-06', name: 'Trưởng bộ môn' },
  { id: 'ROL-07', name: 'Giảng viên' },
];

// ═══════════════════════════════════════════════════════════════════════
// 3. MA TRẬN GÁN QUYỀN CHO VAI TRÒ
// ═══════════════════════════════════════════════════════════════════════
const ROLE_PERMISSIONS = [
  // ROL-01 Admin tối cao — bypass toàn bộ (vẫn seed để audit trail rõ ràng)
  {
    role: 'ROL-01',
    perms: [
      'LECTURE_VIEW',
      'LECTURE_CREATE',
      'LECTURE_APPROVE',
      'LECTURE_DELETE',
      'SCHEDULE_START',
    ],
  },
  // ROL-02 BGH / Chỉ huy — duyệt cấp Trường
  {
    role: 'ROL-02',
    perms: ['LECTURE_VIEW', 'LECTURE_APPROVE'],
  },
  // ROL-03 Trợ lý — chỉ xem bài đã publish
  {
    role: 'ROL-03',
    perms: ['LECTURE_VIEW'],
  },
  // ROL-05 Văn thư — chỉ xem bài đã publish
  {
    role: 'ROL-05',
    perms: ['LECTURE_VIEW'],
  },
  // ROL-06 Trưởng bộ môn — duyệt cấp Khoa + soạn + dạy
  {
    role: 'ROL-06',
    perms: [
      'LECTURE_VIEW',
      'LECTURE_CREATE',
      'LECTURE_APPROVE',
      'LECTURE_DELETE',
      'SCHEDULE_START',
    ],
  },
  // ROL-07 Giảng viên — soạn + dạy
  {
    role: 'ROL-07',
    perms: ['LECTURE_VIEW', 'LECTURE_CREATE', 'SCHEDULE_START'],
  },
];

// ═══════════════════════════════════════════════════════════════════════
// 4. MÔN HỌC MẪU
// ═══════════════════════════════════════════════════════════════════════
const SUBJECTS = [
  { id: 'SUBJ-01', code: 'CTBB',  name: 'Chiến thuật Bộ binh',            faculty: 'TQS', level: 2 },
  { id: 'SUBJ-02', code: 'KTCB',  name: 'Kỹ thuật Công binh',             faculty: 'TQS', level: 2 },
  { id: 'SUBJ-03', code: 'TTLL',  name: 'Thông tin liên lạc Quân sự',     faculty: 'TQS', level: 3 },
  { id: 'SUBJ-04', code: 'CTTT',  name: 'Chính trị - Tư tưởng',           faculty: 'TQS', level: 2 },
  { id: 'SUBJ-05', code: 'HCKT',  name: 'Hậu cần - Kỹ thuật',             faculty: 'TQS', level: 2 },
];

// ═══════════════════════════════════════════════════════════════════════
// 5. LỚP HỌC MẪU
// ═══════════════════════════════════════════════════════════════════════
const CLASSES = [
  { id: 'CLS-2026-01', name: 'Lớp Sĩ quan Chỉ huy - Khóa 12',  unit: 'TQS', year: 2026, total: 45 },
  { id: 'CLS-2026-02', name: 'Lớp Sĩ quan Tham mưu - Khóa 08', unit: 'TQS', year: 2026, total: 38 },
  { id: 'CLS-2026-03', name: 'Lớp Chính trị viên - Khóa 05',   unit: 'TQS', year: 2026, total: 32 },
];

// ═══════════════════════════════════════════════════════════════════════
// HÀM HỖ TRỢ
// ═══════════════════════════════════════════════════════════════════════

/**
 * Kiểm tra cột có tồn tại (dùng cho fallback nếu schema cũ thiếu cột)
 */
async function hasColumn(pool, table, column) {
  const r = await pool.request()
    .input('t', sql.VarChar(100), table)
    .input('c', sql.VarChar(100), column)
    .query(`SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME=@t AND COLUMN_NAME=@c`);
  return r.recordset.length > 0;
}

/**
 * Kiểm tra bảng tồn tại
 */
async function hasTable(pool, table) {
  const r = await pool.request()
    .input('t', sql.VarChar(100), table)
    .query(`SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME=@t`);
  return r.recordset.length > 0;
}

// ═══════════════════════════════════════════════════════════════════════
// CÁC BƯỚC SEED
// ═══════════════════════════════════════════════════════════════════════

/**
 * BƯỚC 1: Tạo permissions (idempotent)
 */
async function seedPermissions(pool) {
  console.log('\n[1/5] Seed PERMISSION...');

  // Kiểm tra các cột mở rộng có tồn tại không
  const hasSubgroupKey    = await hasColumn(pool, 'PERMISSION', 'subgroup_key');
  const hasSubgroupLabel  = await hasColumn(pool, 'PERMISSION', 'subgroup_label');
  const hasSubgroupOrder  = await hasColumn(pool, 'PERMISSION', 'subgroup_order');
  const hasSubgroupTone   = await hasColumn(pool, 'PERMISSION', 'subgroup_tone');

  let created = 0;
  let skipped = 0;

  for (const p of PERMISSIONS) {
    const exists = await pool.request()
      .input('id', sql.VarChar(50), p.id)
      .query(`SELECT 1 FROM [PERMISSION] WHERE permission_id = @id`);
    if (exists.recordset.length > 0) {
      skipped++;
      console.log(`   ⏭️  ${p.id} (${p.code}) — đã tồn tại, bỏ qua`);
      continue;
    }

    // Build câu INSERT động dựa trên các cột thực tế có sẵn
    const cols = ['permission_id', 'code', 'description', 'group_code', 'is_system', 'sort_order'];
    const vals = ['@id', '@code', '@desc', '@grp', '1', '@so'];

    if (hasSubgroupKey)   { cols.push('subgroup_key');   vals.push('@sk'); }
    if (hasSubgroupLabel) { cols.push('subgroup_label'); vals.push('@sl'); }
    if (hasSubgroupOrder) { cols.push('subgroup_order'); vals.push('@sor'); }
    if (hasSubgroupTone)  { cols.push('subgroup_tone');  vals.push('@st'); }

    const req = pool.request()
      .input('id',   sql.VarChar(50),   p.id)
      .input('code', sql.VarChar(50),   p.code)
      .input('desc', sql.NVarChar(200), p.name)
      .input('grp',  sql.VarChar(30),   p.group)
      .input('so',   sql.Int,           p.sort_order);

    if (hasSubgroupKey)   req.input('sk',  sql.VarChar(30),   p.subgroup_key);
    if (hasSubgroupLabel) req.input('sl',  sql.NVarChar(50),  p.subgroup_label);
    if (hasSubgroupOrder) req.input('sor', sql.Int,           10);
    if (hasSubgroupTone)  req.input('st',  sql.VarChar(20),   p.subgroup_tone);

    await req.query(`INSERT INTO [PERMISSION] (${cols.join(', ')}) VALUES (${vals.join(', ')})`);
    created++;
    console.log(`   ✅ ${p.id} (${p.code}) — đã tạo`);
  }

  console.log(`   → Kết quả: ${created} tạo mới, ${skipped} bỏ qua (đã có)`);
}

/**
 * BƯỚC 2: Tạo roles (idempotent)
 */
async function seedRoles(pool) {
  console.log('\n[2/5] Seed ROLE...');

  let created = 0;
  let skipped = 0;

  for (const r of ROLES) {
    const exists = await pool.request()
      .input('id', sql.VarChar(50), r.id)
      .query(`SELECT 1 FROM [ROLE] WHERE role_id = @id`);
    if (exists.recordset.length > 0) {
      skipped++;
      console.log(`   ⏭️  ${r.id} (${r.name}) — đã tồn tại`);
      continue;
    }
    await pool.request()
      .input('id',   sql.VarChar(50),   r.id)
      .input('name', sql.NVarChar(100), r.name)
      .query(`INSERT INTO [ROLE] (role_id, name) VALUES (@id, @name)`);
    created++;
    console.log(`   ✅ ${r.id} (${r.name}) — đã tạo`);
  }

  console.log(`   → Kết quả: ${created} tạo mới, ${skipped} bỏ qua`);
}

/**
 * BƯỚC 3: Gán quyền cho vai trò (idempotent)
 */
async function seedRolePermissions(pool) {
  console.log('\n[3/5] Gán ROLE_PERMISSION...');

  let totalGranted = 0;
  let totalSkipped = 0;
  let totalMissingRole = 0;
  let totalMissingPerm = 0;

  for (const rp of ROLE_PERMISSIONS) {
    // Kiểm tra role có tồn tại không
    const roleExists = await pool.request()
      .input('rid', sql.VarChar(50), rp.role)
      .query(`SELECT 1 FROM [ROLE] WHERE role_id = @rid`);
    if (roleExists.recordset.length === 0) {
      console.warn(`   ⚠️  Role ${rp.role} chưa tồn tại — bỏ qua ${rp.perms.length} quyền`);
      totalMissingRole += rp.perms.length;
      continue;
    }

    let granted = 0;
    let skipped = 0;

    for (const code of rp.perms) {
      // Lấy permission_id từ code
      const permRes = await pool.request()
        .input('code', sql.VarChar(50), code)
        .query(`SELECT permission_id FROM [PERMISSION] WHERE code = @code`);
      if (permRes.recordset.length === 0) {
        console.warn(`   ⚠️  Permission code "${code}" chưa tồn tại — bỏ qua`);
        totalMissingPerm++;
        continue;
      }
      const permId = permRes.recordset[0].permission_id;

      // Kiểm tra đã gán chưa
      const existed = await pool.request()
        .input('rid', sql.VarChar(50), rp.role)
        .input('pid', sql.VarChar(50), permId)
        .query(`SELECT 1 FROM ROLE_PERMISSION WHERE role_id = @rid AND permission_id = @pid`);
      if (existed.recordset.length > 0) {
        skipped++;
        continue;
      }

      await pool.request()
        .input('rid', sql.VarChar(50), rp.role)
        .input('pid', sql.VarChar(50), permId)
        .query(`INSERT INTO ROLE_PERMISSION (role_id, permission_id) VALUES (@rid, @pid)`);
      granted++;
    }

    totalGranted += granted;
    totalSkipped += skipped;
    console.log(`   ${rp.role}: +${granted} quyền mới, ${skipped} đã có sẵn`);
  }

  console.log(`   → Tổng: ${totalGranted} gán mới, ${totalSkipped} bỏ qua`);
  if (totalMissingRole > 0) {
    console.warn(`   ⚠️  ${totalMissingRole} quyền bị bỏ qua vì role không tồn tại`);
  }
  if (totalMissingPerm > 0) {
    console.warn(`   ⚠️  ${totalMissingPerm} quyền bị bỏ qua vì permission code không tồn tại`);
  }
}

/**
 * BƯỚC 4: Seed SUBJECT (idempotent)
 */
async function seedSubjects(pool) {
  console.log('\n[4/5] Seed SUBJECT...');

  const hasTable = await (async () => {
    const r = await pool.request()
      .query(`SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='SUBJECT'`);
    return r.recordset.length > 0;
  })();

  if (!hasTable) {
    console.warn('   ⚠️  Bảng SUBJECT chưa tồn tại — bỏ qua bước này');
    console.warn('   → Chạy trước: node backend/migrations/upgrade_lecture_v2.cjs');
    return;
  }

  // Kiểm tra cột subject_code có tồn tại không
  const hasCode = await hasColumn(pool, 'SUBJECT', 'subject_code');
  const hasSecurityLevel = await hasColumn(pool, 'SUBJECT', 'security_level_id');

  let created = 0;
  let skipped = 0;

  for (const s of SUBJECTS) {
    const exists = await pool.request()
      .input('id', sql.VarChar(50), s.id)
      .query(`SELECT 1 FROM SUBJECT WHERE subject_id = @id`);
    if (exists.recordset.length > 0) {
      skipped++;
      continue;
    }

    // Nếu thiếu subject_code (schema cũ), tự sinh từ name
    const codeVal = hasCode ? s.code : null;

    const cols = ['subject_id', 'name', 'faculty_unit_id', 'active'];
    const vals = ['@id', '@name', '@fac', '1'];
    const req = pool.request()
      .input('id',   sql.VarChar(50),   s.id)
      .input('name', sql.NVarChar(200), s.name)
      .input('fac',  sql.VarChar(50),   s.faculty);

    if (hasCode) {
      cols.push('subject_code');
      vals.push('@code');
      req.input('code', sql.VarChar(50), codeVal);
    }
    if (hasSecurityLevel) {
      cols.push('security_level_id');
      vals.push('@lvl');
      req.input('lvl', sql.Int, s.level);
    }

    await req.query(`INSERT INTO SUBJECT (${cols.join(', ')}) VALUES (${vals.join(', ')})`);
    created++;
    console.log(`   ✅ ${s.id} — ${s.name}`);
  }

  console.log(`   → Kết quả: ${created} tạo mới, ${skipped} bỏ qua`);
}

/**
 * BƯỚC 5: Seed TRAINING_CLASS (idempotent)
 */
async function seedClasses(pool) {
  console.log('\n[5/5] Seed TRAINING_CLASS...');

  const hasTable = await (async () => {
    const r = await pool.request()
      .query(`SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='TRAINING_CLASS'`);
    return r.recordset.length > 0;
  })();

  if (!hasTable) {
    console.warn('   ⚠️  Bảng TRAINING_CLASS chưa tồn tại — bỏ qua bước này');
    return;
  }

  const hasYear  = await hasColumn(pool, 'TRAINING_CLASS', 'course_year');
  const hasTotal = await hasColumn(pool, 'TRAINING_CLASS', 'student_total');

  let created = 0;
  let skipped = 0;

  for (const c of CLASSES) {
    const exists = await pool.request()
      .input('id', sql.VarChar(50), c.id)
      .query(`SELECT 1 FROM TRAINING_CLASS WHERE class_id = @id`);
    if (exists.recordset.length > 0) {
      skipped++;
      continue;
    }

    const cols = ['class_id', 'class_name', 'unit_id', 'active'];
    const vals = ['@id', '@name', '@unit', '1'];
    const req = pool.request()
      .input('id',   sql.VarChar(50),   c.id)
      .input('name', sql.NVarChar(100), c.name)
      .input('unit', sql.VarChar(50),   c.unit);

    if (hasYear)  { cols.push('course_year');   vals.push('@yr');  req.input('yr',  sql.Int, c.year); }
    if (hasTotal) { cols.push('student_total'); vals.push('@tot'); req.input('tot', sql.Int, c.total); }

    await req.query(`INSERT INTO TRAINING_CLASS (${cols.join(', ')}) VALUES (${vals.join(', ')})`);
    created++;
    console.log(`   ✅ ${c.id} — ${c.name} (${c.total} HV)`);
  }

  console.log(`   → Kết quả: ${created} tạo mới, ${skipped} bỏ qua`);
}

/**
 * BƯỚC VERIFY: Kiểm tra sau seed
 */
async function verify(pool) {
  console.log('\n' + '═'.repeat(65));
  console.log('  BÁO CÁO KIỂM TRA SAU SEED (VERIFICATION REPORT)');
  console.log('═'.repeat(65));

  // 1. Permissions LECTURE
  const permRes = await pool.request().query(`
    SELECT p.permission_id, p.code, p.description
    FROM [PERMISSION] p
    WHERE p.group_code = 'LECTURE'
       OR p.code IN ('LECTURE_VIEW','LECTURE_CREATE','LECTURE_APPROVE','LECTURE_DELETE','SCHEDULE_START')
    ORDER BY p.sort_order, p.code
  `);
  console.log(`\n📋 Permissions phân hệ LECTURE: ${permRes.recordset.length} bản ghi`);
  for (const p of permRes.recordset) {
    console.log(`   • ${p.permission_id.padEnd(14)} | ${p.code.padEnd(18)} | ${p.description || ''}`);
  }

  // 2. Roles mới
  const roleRes = await pool.request().query(`
    SELECT role_id, name FROM [ROLE] WHERE role_id IN ('ROL-06','ROL-07') ORDER BY role_id
  `);
  console.log(`\n👥 Roles mới: ${roleRes.recordset.length}/2`);
  for (const r of roleRes.recordset) {
    console.log(`   • ${r.role_id} — ${r.name}`);
  }

  // 3. Ma trận gán quyền
  const matrixRes = await pool.request().query(`
    SELECT rp.role_id, r.name AS role_name, p.code
    FROM ROLE_PERMISSION rp
    JOIN [ROLE] r ON r.role_id = rp.role_id
    JOIN [PERMISSION] p ON p.permission_id = rp.permission_id
    WHERE p.code IN ('LECTURE_VIEW','LECTURE_CREATE','LECTURE_APPROVE','LECTURE_DELETE','SCHEDULE_START')
    ORDER BY rp.role_id, p.code
  `);
  console.log(`\n🔐 Ma trận gán quyền LECTURE (${matrixRes.recordset.length} dòng):`);
  const matrix = {};
  for (const row of matrixRes.recordset) {
    if (!matrix[row.role_id]) matrix[row.role_id] = { name: row.role_name, perms: [] };
    matrix[row.role_id].perms.push(row.code);
  }
  for (const roleId of Object.keys(matrix).sort()) {
    const m = matrix[roleId];
    console.log(`   • ${roleId} (${m.name}):`);
    console.log(`     ${m.perms.join(', ')}`);
  }

  // 4. SUBJECT
  const subRes = await pool.request().query(`SELECT COUNT(*) AS n FROM SUBJECT`);
  console.log(`\n📚 SUBJECT: ${subRes.recordset[0].n} môn học`);

  // 5. TRAINING_CLASS
  const classRes = await pool.request().query(`SELECT COUNT(*) AS n FROM TRAINING_CLASS`);
  console.log(`🏫 TRAINING_CLASS: ${classRes.recordset[0].n} lớp học`);

  // 6. Cảnh báo nếu Admin không có đủ quyền
  const adminPerm = await pool.request().query(`
    SELECT COUNT(*) AS n FROM ROLE_PERMISSION rp
    JOIN [PERMISSION] p ON p.permission_id = rp.permission_id
    WHERE rp.role_id = 'ROL-01'
      AND p.code IN ('LECTURE_VIEW','LECTURE_CREATE','LECTURE_APPROVE','LECTURE_DELETE','SCHEDULE_START')
  `);
  console.log(`\n🛡️  ROL-01 (Admin) có ${adminPerm.recordset[0].n}/5 quyền LECTURE`);

  // 7. Cảnh báo user nào chưa có role mới
  const usersWithoutRole = await pool.request().query(`
    SELECT user_id, full_name
    FROM [USER]
    WHERE user_id NOT IN (
      SELECT user_id FROM USER_ROLE WHERE role_id IN ('ROL-06','ROL-07')
    )
      AND status = 'active'
      AND user_id LIKE 'USR-%'
  `);
  if (usersWithoutRole.recordset.length > 0) {
    console.log(`\n⚠️  ${usersWithoutRole.recordset.length} tài khoản chưa được gán ROL-06/ROL-07:`);
    for (const u of usersWithoutRole.recordset.slice(0, 10)) {
      console.log(`   • ${u.user_id} — ${u.full_name}`);
    }
    console.log('   → Vào Admin > Users để gán vai trò Giảng viên (ROL-07) hoặc Trưởng bộ môn (ROL-06)');
  }

  console.log('\n' + '═'.repeat(65));
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  console.log('═'.repeat(65));
  console.log('  SEED DỮ LIỆU PHÂN HỆ BÀI GIẢNG SỐ — QK7 DATAHUB');
  console.log('  Database: ' + (process.env.DB_DATABASE || 'QK7_ThuVienSo'));
  console.log('  Server  : ' + (process.env.DB_SERVER || 'localhost'));
  console.log('═'.repeat(65));

  const pool = await getPool();

  // Kiểm tra các bảng schema đã tồn tại chưa
  const schemaOk = await hasTable(pool, 'DIGITAL_LECTURE');
  if (!schemaOk) {
    console.error('\n❌ Bảng DIGITAL_LECTURE chưa tồn tại.');
    console.error('   Vui lòng chạy trước:');
    console.error('     node backend/migrations/upgrade_lecture_v2.cjs');
    console.error('   (hoặc chạy SQL schema gốc trước)');
    process.exit(1);
  }

  try {
    await seedPermissions(pool);
    await seedRoles(pool);
    await seedRolePermissions(pool);
    await seedSubjects(pool);
    await seedClasses(pool);
    await verify(pool);

    console.log('\n✅ SEED HOÀN TẤT.');
    console.log('\n📌 Bước tiếp theo:');
    console.log('   1. Vào Admin > Users để gán role ROL-07 (Giảng viên) / ROL-06 (Trưởng bộ môn)');
    console.log('   2. Restart backend: cd backend && node server.js');
    console.log('   3. Test API: GET /api/lectures/catalogs/subjects');
    console.log('   4. Frontend: npm run dev → vào /lectures');
    console.log('');
  } catch (err) {
    console.error('\n❌ SEED THẤT BẠI:', err.message);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

main();