// setup-admin.js — Khởi tạo toàn bộ hồ sơ tài khoản Admin tối cao
const bcrypt = require('bcryptjs');
const { sql, getPool, closePool } = require('./src/db');

const ADMIN_DATA = {
  user_id: 'USR-001',
  username: 'usr-001',
  password: '123456789',
  full_name: 'Quản trị viên',
  rank_name: 'Đại tá',
  position: 'Quản trị viên Hệ thống',
  unit_id: 'U-BGH', // Có thể sửa lại theo mã đơn vị trong DB của đồng chí
  clearance_level_id: 5, // Tuyệt mật
  role_id: 'ROL-01' // Vai trò Admin
};

(async () => {
  try {
    const pool = await getPool();
    const hash = await bcrypt.hash(ADMIN_DATA.password, 10);
    
    console.log(`[Admin Setup] Đang xử lý tài khoản ${ADMIN_DATA.user_id}...`);

    // 1. Khởi tạo hoặc Cập nhật thông tin User
    await pool.request()
      .input('user_id', sql.VarChar(50), ADMIN_DATA.user_id)
      .input('username', sql.VarChar(50), ADMIN_DATA.username)
      .input('hash', sql.VarChar(255), hash)
      .input('full_name', sql.NVarChar(100), ADMIN_DATA.full_name)
      .input('rank', sql.NVarChar(50), ADMIN_DATA.rank_name)
      .input('position', sql.NVarChar(100), ADMIN_DATA.position)
      .input('unit_id', sql.VarChar(50), ADMIN_DATA.unit_id)
      .input('clearance_level_id', sql.Int, ADMIN_DATA.clearance_level_id)
      .query(`
        MERGE [USER] AS target
        USING (SELECT @user_id AS user_id) AS source
        ON target.user_id = source.user_id
        WHEN MATCHED THEN
          UPDATE SET 
            username = @username,
            password_hash = @hash,
            full_name = @full_name,
            [rank] = @rank,
            [position] = @position,
            unit_id = @unit_id,
            clearance_level_id = @clearance_level_id,
            status = 'active',
            failed_attempts = 0,
            locked_at = NULL
        WHEN NOT MATCHED THEN
          INSERT (user_id, username, password_hash, full_name, [rank], [position], unit_id, clearance_level_id, status)
          VALUES (@user_id, @username, @hash, @full_name, @rank, @position, @unit_id, @clearance_level_id, 'active');
      `);

    // 2. Gán vai trò Admin (ROL-01)
    await pool.request()
      .input('uid', sql.VarChar(50), ADMIN_DATA.user_id)
      .input('rid', sql.VarChar(50), ADMIN_DATA.role_id)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM USER_ROLE WHERE user_id = @uid AND role_id = @rid)
        BEGIN
            INSERT INTO USER_ROLE (user_id, role_id) VALUES (@uid, @rid)
        END
      `);

    console.log('');
    console.log('════════════════════════════════════════════');
    console.log(`✅ Đã khởi tạo/Cập nhật thành công tài khoản Admin`);
    console.log(`   - Username : ${ADMIN_DATA.username}`);
    console.log(`   - Password : ${ADMIN_DATA.password}`);
    console.log(`   - Vai trò  : ${ADMIN_DATA.role_id} (Quản trị viên)`);
    console.log(`   - Cấp bậc  : ${ADMIN_DATA.clearance_level_id} (Tuyệt mật)`);
    console.log('════════════════════════════════════════════');
    
    await closePool();
    process.exit(0);
  } catch (err) {
    console.error('[Admin Setup] Lỗi:', err.message);
    process.exit(1);
  }
})();