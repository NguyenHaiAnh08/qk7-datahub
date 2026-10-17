// setup-passwords.js
// Kịch bản này sẽ set password cho user_id = USR-001 có vai trò là admin
// Chạy: node setup-passwords.js
const bcrypt = require('bcryptjs');
const { sql, getPool, closePool } = require('./src/db');

const DEFAULT_PASSWORD = '123456789';

(async () => {
    try {
        const pool = await getPool();
        const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

        const result = await pool.request()
            .input('hash', sql.VarChar(255), hash)
            .query(`
                UPDATE [USER]
                SET password_hash = @hash, pin_hash = @hash
            `);

        console.log(`[setup] Đã set password cho ${result.rowsAffected[0]} user`);
        console.log(`[setup] Mật khẩu: ${DEFAULT_PASSWORD}`);
        console.log('[setup] user_id: USR-001');

        await closePool();
        process.exit(0);
    } catch (err) {
        console.error('[setup] Lỗi:', err.message);
        process.exit(1);
    }
})();