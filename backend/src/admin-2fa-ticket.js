// ============================================================
// src/admin-2fa-ticket.js
// Opaque server-side ticket cho Admin 2FA Login (chống forge JWT)
//
// Thiết kế:
//  - Ticket là random 256-bit (hex 64 ký tự) — KHÔNG mang payload
//  - Lưu server-side trong bảng ADMIN_2FA_TICKET
//  - One-time use (used_at đánh dấu khi consume)
//  - TTL 2 phút (theo cấu hình)
//  - Bind user_id tại issue; bind device_id tại consume (linh hoạt)
//  - IP chỉ log warning khi mismatch, KHÔNG chặn cứng
//  - Không đếm failed_attempts khi quét vân tay sai (chỉ đếm khi consume fail)
// ============================================================

const crypto = require('crypto');
const { sql, getPool } = require('./db');

const TICKET_TTL_SECONDS = 120;          // 2 phút (theo yêu cầu)
const MAX_CLEANUP_AGE_MINUTES = 10;      // Dọn ticket cũ sau 10 phút

/**
 * Sinh ticket opaque 256-bit ngẫu nhiên (64 ký tự hex).
 */
function generateTicketId() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Phát hành ticket mới.
 * @param {Object} opts
 * @param {string} opts.userId    - user_id của admin (bắt buộc)
 * @param {string} [opts.deviceId]- device_id (KHÔNG bắt buộc ở bước 1)
 * @param {string} opts.ip        - IP client tại bước 1
 * @returns {Promise<{ ticket: string, expiresInSeconds: number }>}
 */
async function issueTicket({ userId, deviceId = null, ip }) {
  if (!userId || !ip) {
    throw new Error('issueTicket: thiếu userId hoặc ip');
  }
  const ticket = generateTicketId();
  const pool = await getPool();

  await pool.request()
    .input('tid', sql.VarChar(64), ticket)
    .input('uid', sql.VarChar(50), userId)
    .input('did', sql.VarChar(100), deviceId)
    .input('ip', sql.VarChar(50), ip)
    .input('ttl', sql.Int, TICKET_TTL_SECONDS)
    .query(`
      INSERT INTO ADMIN_2FA_TICKET (ticket_id, user_id, device_id, ip_address, expires_at)
      VALUES (@tid, @uid, @did, @ip, DATEADD(SECOND, @ttl, GETDATE()))
    `);

  return { ticket, expiresInSeconds: TICKET_TTL_SECONDS };
}

/**
 * Consume ticket (one-time use).
 * Trả về { valid, reason, userId, deviceId, ipMismatch }.
 *
 * LƯU Ý: Không throw nếu ticket invalid — trả object để caller xử lý.
 *
 * @param {Object} opts
 * @param {string} opts.ticket
 * @param {string} opts.deviceId - bắt buộc ở bước 2
 * @param {string} opts.ip
 * @returns {Promise<Object>}
 */
async function consumeTicket({ ticket, deviceId, ip }) {
  if (!ticket) return { valid: false, reason: 'TICKET_MISSING' };
  if (!deviceId) return { valid: false, reason: 'DEVICE_ID_MISSING' };

  const pool = await getPool();

  // 1. Lấy ticket kèm row lock để tránh race condition (2 request đồng thời)
  const r = await pool.request()
    .input('tid', sql.VarChar(64), ticket)
    .query(`
      SELECT ticket_id, user_id, device_id, ip_address,
             created_at, expires_at, used_at, failed_attempts
      FROM ADMIN_2FA_TICKET WITH (UPDLOCK, ROWLOCK)
      WHERE ticket_id = @tid
    `);

  if (r.recordset.length === 0) {
    return { valid: false, reason: 'TICKET_NOT_FOUND' };
  }
  const t = r.recordset[0];

  // 2. One-time use
  if (t.used_at) {
    return { valid: false, reason: 'TICKET_ALREADY_USED' };
  }

  // 3. Hết hạn
  if (new Date(t.expires_at) < new Date()) {
    return { valid: false, reason: 'TICKET_EXPIRED' };
  }

  // 4. Bind device_id TẠI CONSUME (nếu ticket được issue không có device_id)
  //    Nếu ticket đã có device_id từ bước 1 → phải khớp
  if (t.device_id && t.device_id !== deviceId) {
    await pool.request()
      .input('tid', sql.VarChar(64), ticket)
      .query(`UPDATE ADMIN_2FA_TICKET SET failed_attempts = failed_attempts + 1 WHERE ticket_id = @tid`);
    return { valid: false, reason: 'TICKET_DEVICE_MISMATCH' };
  }

  // 5. IP mismatch → chỉ log warning, KHÔNG chặn (theo yêu cầu)
  const ipMismatch = (t.ip_address || '') !== (ip || '');

  // 6. Đánh dấu đã dùng NGAY (one-time use, chống replay)
  //    Cập nhật device_id nếu ticket chưa có (bind tại consume)
  await pool.request()
    .input('tid', sql.VarChar(64), ticket)
    .input('did', sql.VarChar(100), deviceId)
    .query(`
      UPDATE ADMIN_2FA_TICKET
      SET used_at = GETDATE(),
          device_id = ISNULL(device_id, @did)
      WHERE ticket_id = @tid AND used_at IS NULL
    `);

  return {
    valid: true,
    userId: t.user_id,
    deviceId: deviceId,
    ipMismatch,
    issuedIp: t.ip_address,
  };
}

/**
 * Xóa ticket hết hạn / đã dùng quá cũ để tránh phình bảng.
 */
async function cleanupExpiredTickets() {
  const pool = await getPool();
  await pool.request()
    .input('age', sql.Int, MAX_CLEANUP_AGE_MINUTES)
    .query(`
      DELETE FROM ADMIN_2FA_TICKET
      WHERE expires_at < DATEADD(MINUTE, -@age, GETDATE())
         OR (used_at IS NOT NULL AND used_at < DATEADD(MINUTE, -@age, GETDATE()))
    `);
}

/**
 * Đếm số lần consume thất bại của cùng user trong 1 giờ (dùng cho alert).
 */
async function getRecentFailures(userId, minutes = 60) {
  if (!userId) return 0;
  const pool = await getPool();
  const r = await pool.request()
    .input('uid', sql.VarChar(50), userId)
    .input('mins', sql.Int, minutes)
    .query(`
      SELECT COUNT(*) AS n
      FROM ADMIN_2FA_TICKET
      WHERE user_id = @uid
        AND failed_attempts > 0
        AND created_at >= DATEADD(MINUTE, -@mins, GETDATE())
    `);
  return r.recordset[0]?.n || 0;
}

module.exports = {
  issueTicket,
  consumeTicket,
  cleanupExpiredTickets,
  getRecentFailures,
  TICKET_TTL_SECONDS,
};