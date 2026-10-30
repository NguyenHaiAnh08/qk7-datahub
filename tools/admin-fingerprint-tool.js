/**
 * Công cụ Quản trị & Cứu hộ Vân tay QK7 DataHub
 * Sử dụng:
 *   node tools/admin-fingerprint-tool.js status
 *   node tools/admin-fingerprint-tool.js reset USR-001
 *   node tools/admin-fingerprint-tool.js fix-admin
 */
const crypto = require('crypto');
const path = require('path');
const sql = require('mssql');
require('dotenv').config({
  path: [path.join(__dirname, '..', '.env'), path.join(__dirname, '..', 'backend', '.env')],
});

const FP_ENC_KEY = process.env.FP_ENC_KEY
  ? crypto.scryptSync(process.env.FP_ENC_KEY, 'qk7-fp-salt', 32)
  : null;

const dbConfig = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '123456',
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_DATABASE || 'QK7_ThuVienSo',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

function testDecrypt(encoded) {
  if (!encoded) return { ok: false, reason: 'Empty template' };
  if (!FP_ENC_KEY) return { ok: false, reason: 'FP_ENC_KEY not configured' };
  if (!encoded.startsWith('enc:')) {
    try {
      const b = Buffer.from(encoded, 'base64');
      return { ok: true, length: b.length, plain: true };
    } catch (e) {
      return { ok: false, reason: 'Invalid base64: ' + e.message };
    }
  }
  try {
    const buf = Buffer.from(encoded.slice(4), 'base64');
    if (buf.length < 28) return { ok: false, reason: 'Buffer too short: ' + buf.length };
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const d = crypto.createDecipheriv('aes-256-gcm', FP_ENC_KEY, iv);
    d.setAuthTag(tag);
    const dec = Buffer.concat([d.update(enc), d.final()]);
    return { ok: true, length: dec.length };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

async function main() {
  const action = process.argv[2] || 'status';
  const targetUser = process.argv[3] || 'USR-001';

  const pool = await sql.connect(dbConfig);
  console.log('====================================================');
  console.log('  QK7 DATAHUB — CÔNG CỤ CHẨN ĐOÁN & CỨU HỘ VÂN TAY');
  console.log('====================================================');
  console.log('FP_ENC_KEY present:', Boolean(process.env.FP_ENC_KEY));
  console.log('Target action:', action, '| Target User:', targetUser);
  console.log('');

  if (action === 'status') {
    const res = await pool.request().query(`
      SELECT uf.user_id, u.full_name, u.username, uf.active, uf.enrolled_at, uf.template_enc
      FROM USER_FINGERPRINT uf
      LEFT JOIN [USER] u ON uf.user_id = u.user_id
    `);
    console.log(`Tìm thấy ${res.recordset.length} bản ghi vân tay:`);
    for (const r of res.recordset) {
      const dec = testDecrypt(r.template_enc);
      const statusIcon = dec.ok ? '✅ HỢP LỆ' : '❌ LỖI GIẢI MÃ (HỎNG / SAI KHÓA)';
      console.log(`- User: ${r.user_id} (${r.full_name || r.username}) | Trạng thái: ${r.active ? 'ACTIVE' : 'INACTIVE'}`);
      console.log(`  Thời điểm enroll: ${r.enrolled_at}`);
      console.log(`  Kết quả kiểm tra khóa: ${statusIcon}`);
      if (!dec.ok) {
        console.log(`  Nguyên nhân: ${dec.reason}`);
        console.log(`  -> Gợi ý: Chạy 'node tools/admin-fingerprint-tool.js reset ${r.user_id}' để reset và enroll lại.`);
      } else {
        console.log(`  Độ dài template: ${dec.length} bytes`);
      }
      console.log('');
    }
  } else if (action === 'reset') {
    console.log(`Đang reset dữ liệu vân tay cho user ${targetUser}...`);
    await pool.request()
      .input('uid', sql.VarChar(50), targetUser)
      .query(`UPDATE USER_FINGERPRINT SET active = 0 WHERE user_id = @uid`);
    
    // Ghi log kiểm toán
    const logId = 'LOG-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
    await pool.request()
      .input('log_id', sql.VarChar(50), logId)
      .input('user_id', sql.VarChar(50), targetUser)
      .input('action', sql.VarChar(50), 'FINGERPRINT_RESET')
      .input('ip', sql.VarChar(50), '127.0.0.1')
      .input('note', sql.NVarChar(500), `Admin reset dữ liệu vân tay bị hỏng cho ${targetUser} bằng CLI tool`)
      .query(`INSERT INTO ACCESS_LOG (log_id, user_id, file_id, [action], ip, note) VALUES (@log_id, @user_id, NULL, @action, @ip, @note)`);

    console.log(`✅ Đã đặt active = 0 cho user ${targetUser}. Đã ghi ACCESS_LOG (${logId}).`);
  } else if (action === 'delete') {
    console.log(`Đang xóa bản ghi vân tay hỏng của ${targetUser}...`);
    await pool.request()
      .input('uid', sql.VarChar(50), targetUser)
      .query(`DELETE FROM USER_FINGERPRINT WHERE user_id = @uid`);
    console.log(`✅ Đã xóa bản ghi vân tay của ${targetUser} khỏi USER_FINGERPRINT.`);
  }

  await pool.close();
}

main().catch(err => {
  console.error('Lỗi thực thi:', err);
  process.exit(1);
});

