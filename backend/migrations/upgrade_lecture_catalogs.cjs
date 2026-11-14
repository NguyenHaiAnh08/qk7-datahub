// backend/migrations/upgrade_lecture_catalogs.cjs
// Chạy: node backend/migrations/upgrade_lecture_catalogs.cjs
const { getPool, sql, closePool } = require('../src/db');

async function hasTable(pool, table) {
  const r = await pool.request()
    .input('t', sql.VarChar(100), table)
    .query(`SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME=@t`);
  return r.recordset.length > 0;
}

async function hasColumn(pool, table, column) {
  const r = await pool.request()
    .input('t', sql.VarChar(100), table)
    .input('c', sql.VarChar(100), column)
    .query(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME=@t AND COLUMN_NAME=@c`);
  return r.recordset.length > 0;
}

async function migrate() {
  const pool = await getPool();
  console.log('[Upgrade Lecture Catalogs] Bắt đầu...');

  // 1. TRAINING_CLASS: add student_total, course_year, description
  if (await hasTable(pool, 'TRAINING_CLASS')) {
    if (!(await hasColumn(pool, 'TRAINING_CLASS', 'student_total'))) {
      await pool.request().query(`ALTER TABLE TRAINING_CLASS ADD student_total INT NULL;`);
      console.log('   ✅ TRAINING_CLASS + student_total');
    }
    if (!(await hasColumn(pool, 'TRAINING_CLASS', 'course_year'))) {
      await pool.request().query(`ALTER TABLE TRAINING_CLASS ADD course_year INT NULL;`);
      console.log('   ✅ TRAINING_CLASS + course_year');
    }
    if (!(await hasColumn(pool, 'TRAINING_CLASS', 'description'))) {
      await pool.request().query(`ALTER TABLE TRAINING_CLASS ADD description NVARCHAR(500) NULL;`);
      console.log('   ✅ TRAINING_CLASS + description');
    }
  }

  // 2. SUBJECT: add description
  if (await hasTable(pool, 'SUBJECT')) {
    if (!(await hasColumn(pool, 'SUBJECT', 'description'))) {
      await pool.request().query(`ALTER TABLE SUBJECT ADD description NVARCHAR(500) NULL;`);
      console.log('   ✅ SUBJECT + description');
    }
  }

  // 3. CLASSROOM: add description
  if (await hasTable(pool, 'CLASSROOM')) {
    if (!(await hasColumn(pool, 'CLASSROOM', 'description'))) {
      await pool.request().query(`ALTER TABLE CLASSROOM ADD description NVARCHAR(500) NULL;`);
      console.log('   ✅ CLASSROOM + description');
    }
  }

  // 4. Tạo 6 permissions mới
  const NEW_PERMISSIONS = [
    { id: 'PERM-LEC-11', code: 'SUBJECT_VIEW',     name: 'Xem môn học',        sk: 'lec-subject',   sl: 'Môn học',      so: 60, st: 'read',  sort: 560 },
    { id: 'PERM-LEC-12', code: 'SUBJECT_MANAGE',   name: 'CRUD môn học',       sk: 'lec-subject',   sl: 'Môn học',      so: 60, st: 'write', sort: 565 },
    { id: 'PERM-LEC-13', code: 'CLASS_VIEW',       name: 'Xem lớp học',        sk: 'lec-class',     sl: 'Lớp học',      so: 70, st: 'read',  sort: 570 },
    { id: 'PERM-LEC-14', code: 'CLASS_MANAGE',     name: 'CRUD lớp học',       sk: 'lec-class',     sl: 'Lớp học',      so: 70, st: 'write', sort: 575 },
    { id: 'PERM-LEC-15', code: 'CLASSROOM_VIEW',   name: 'Xem giảng đường',    sk: 'lec-classroom', sl: 'Giảng đường',  so: 80, st: 'read',  sort: 580 },
    { id: 'PERM-LEC-16', code: 'CLASSROOM_MANAGE', name: 'CRUD giảng đường',   sk: 'lec-classroom', sl: 'Giảng đường',  so: 80, st: 'write', sort: 585 },
  ];

  for (const p of NEW_PERMISSIONS) {
    const exists = await pool.request()
      .input('id', sql.VarChar(50), p.id)
      .query(`SELECT 1 FROM [PERMISSION] WHERE permission_id = @id`);
    if (exists.recordset.length > 0) continue;

    await pool.request()
      .input('id', sql.VarChar(50), p.id)
      .input('code', sql.VarChar(50), p.code)
      .input('desc', sql.NVarChar(200), p.name)
      .input('grp', sql.VarChar(30), 'LECTURE')
      .input('so', sql.Int, p.sort)
      .input('sk', sql.VarChar(30), p.sk)
      .input('sl', sql.NVarChar(50), p.sl)
      .input('sor', sql.Int, p.so)
      .input('st', sql.VarChar(20), p.st)
      .query(`INSERT INTO [PERMISSION] (permission_id, code, description, group_code, is_system, sort_order, subgroup_key, subgroup_label, subgroup_order, subgroup_tone)
              VALUES (@id, @code, @desc, @grp, 1, @so, @sk, @sl, @sor, @st)`);
    console.log(`   ✅ PERMISSION ${p.id} (${p.code})`);
  }

  // 5. Gán cho các vai trò
  const GRANTS = [
    { role: 'ROL-01', perms: ['SUBJECT_VIEW','SUBJECT_MANAGE','CLASS_VIEW','CLASS_MANAGE','CLASSROOM_VIEW','CLASSROOM_MANAGE'] },
    { role: 'ROL-02', perms: ['SUBJECT_VIEW','CLASS_VIEW','CLASSROOM_VIEW'] },
    { role: 'ROL-06', perms: ['SUBJECT_VIEW','CLASS_VIEW','CLASSROOM_VIEW'] },
    { role: 'ROL-07', perms: ['SUBJECT_VIEW','CLASS_VIEW','CLASSROOM_VIEW'] },
  ];

  for (const g of GRANTS) {
    for (const code of g.perms) {
      const permRes = await pool.request()
        .input('code', sql.VarChar(50), code)
        .query(`SELECT permission_id FROM [PERMISSION] WHERE code = @code`);
      if (permRes.recordset.length === 0) continue;
      const pid = permRes.recordset[0].permission_id;

      const exists = await pool.request()
        .input('rid', sql.VarChar(50), g.role)
        .input('pid', sql.VarChar(50), pid)
        .query(`SELECT 1 FROM ROLE_PERMISSION WHERE role_id=@rid AND permission_id=@pid`);
      if (exists.recordset.length > 0) continue;

      await pool.request()
        .input('rid', sql.VarChar(50), g.role)
        .input('pid', sql.VarChar(50), pid)
        .query(`INSERT INTO ROLE_PERMISSION (role_id, permission_id) VALUES (@rid, @pid)`);
    }
  }
  console.log('   ✅ Đã gán quyền cho ROL-01, ROL-02, ROL-06, ROL-07');

  // 6. Cập nhật TRAINING_CLASS hiện có với student_total mẫu
  await pool.request().query(`
    UPDATE TRAINING_CLASS SET student_total = 45
    WHERE class_id = 'CLS-2026-01' AND student_total IS NULL;
    UPDATE TRAINING_CLASS SET student_total = 38
    WHERE class_id = 'CLS-2026-02' AND student_total IS NULL;
    UPDATE TRAINING_CLASS SET student_total = 32
    WHERE class_id = 'CLS-2026-03' AND student_total IS NULL;
  `);

  console.log('[Upgrade Lecture Catalogs] ✅ HOÀN TẤT.');
}

migrate().then(() => closePool().then(() => process.exit(0))).catch(e => { console.error(e); process.exit(1); });