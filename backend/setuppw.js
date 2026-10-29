

// // setup-passwords.js — Set mật khẩu ban đầu cho user seed (chỉ nếu password_hash NULL)
// const bcrypt = require('bcryptjs');
// const { sql, getPool, closePool } = require('./src/db');

// const DEFAULT_PASSWORD = '123456789';
// const SEED_USER_IDS = ['USR-001'];

// (async () => {
//   try {
//     const pool = await getPool();
//     const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
//     let updated = 0;
//     let skipped = 0;

//     for (const uid of SEED_USER_IDS) {
//       const r = await pool.request()
//         .input('hash', sql.VarChar(255), hash)
//         .input('uid', sql.VarChar(50), uid)
//         .query(`
//           UPDATE [USER]
//           SET password_hash = @hash
//           WHERE user_id = @uid AND password_hash IS NULL
//         `);
//       const n = r.rowsAffected[0];
//       if (n > 0) {
//         updated++;
//         console.log(`[setup] ${uid}: ✅ set password`);
//       } else {
//         skipped++;
//         console.log(`[setup] ${uid}: ⚠️  đã có password, bỏ qua`);
//       }
//     }

//     console.log('');
//     console.log('════════════════════════════════════════════');
//     console.log(`[setup] Đã set password cho ${updated} user (bỏ qua ${skipped})`);
//     console.log(`[setup] Mật khẩu chung: ${DEFAULT_PASSWORD}`);
//     console.log('════════════════════════════════════════════');
//     await closePool();
//     process.exit(0);
//   } catch (err) {
//     console.error('[setup] Lỗi:', err.message);
//     process.exit(1);
//   }
// })();
