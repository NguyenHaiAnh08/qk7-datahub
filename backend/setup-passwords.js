// setup-passwords.js — FIXED v2.0
// Chỉ hash mật khẩu cho 1 user admin, không reset user khác
const bcrypt = require('bcryptjs');
const { sql, getPool, closePool } = require('./src/db');

const DEFAULT_PASSWORD = '123456789';
const SEED_USER_IDS = ['USR-001'];

(async () => {
    try {
        const pool = await getPool();
        const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

        // Chỉ cập nhật user seed và chỉ khi password_hash đang NULL
        // (tránh ghi đè mật khẩu user đã đổi)
        let totalUpdated = 0;
        for (const uid of SEED_USER_IDS) {
            const result = await pool.request()
                .input('hash', sql.VarChar(255), hash)
                .input('uid',  sql.VarChar(50), uid)
                .query(`
                    UPDATE [USER]
                    SET password_hash = @hash, pin_hash = @hash
                    WHERE user_id = @uid AND password_hash IS NULL
                `);
            const n = result.rowsAffected[0];
            totalUpdated += n;
            console.log(`[setup] ${uid}: ${n > 0 ? '✅ set password' : '⚠️  đã có password, bỏ qua'}`);
        }

        console.log('');
        console.log('════════════════════════════════════════════');
        console.log(`[setup] Đã set password cho ${totalUpdated} user`);
        console.log(`[setup] Mật khẩu chung: ${DEFAULT_PASSWORD}`);
        console.log('════════════════════════════════════════════');

        await closePool();
        process.exit(0);
    } catch (err) {
        console.error('[setup] Lỗi:', err.message);
        process.exit(1);
    }
})();