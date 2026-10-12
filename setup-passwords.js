// setup-passwords.js
// Chạy 1 lần: node setup-passwords.js
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
                SET pin_hash = @hash
                WHERE pin_hash IS NULL OR pin_hash = ''
            `);

        console.log(`[setup] Đã set password cho ${result.rowsAffected[0]} user`);
        console.log(`[setup] Mật khẩu: ${DEFAULT_PASSWORD}`);
        console.log('[setup] user_id: USR-001, USR-002, USR-003, USR-004');

        await closePool();
        process.exit(0);
    } catch (err) {
        console.error('[setup] Lỗi:', err.message);
        process.exit(1);
    }
})();