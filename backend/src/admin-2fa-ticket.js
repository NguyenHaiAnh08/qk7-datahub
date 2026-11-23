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
 * Validate ticket mà KHÔNG đánh dấu used_at ngay (cho phép tối đa 3 lần quét trong TTL).
 * Trả về { valid, reason, userId, deviceId, ipMismatch, failedAttempts }.
 */
async function validateTicket({ ticket, deviceId, ip }) {
  if (!ticket) return { valid: false, reason: 'TICKET_MISSING' };
  if (!deviceId) return { valid: false, reason: 'DEVICE_ID_MISSING' };

  const pool = await getPool();

  // 1. Lấy ticket kèm row lock để tránh race condition
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

  // 2. One-time use: nếu đã xác thực thành công trước đó -> từ chối
  if (t.used_at) {
    return { valid: false, reason: 'TICKET_ALREADY_USED' };
  }

  // 3. Hết hạn (2 phút TTL)
  if (new Date(t.expires_at) < new Date()) {
    return { valid: false, reason: 'TICKET_EXPIRED' };
  }

  // 4. Quá số lần quét sai (tối đa 3 lần)
  if ((t.failed_attempts || 0) >= 3) {
    return { valid: false, reason: 'TICKET_MAX_ATTEMPTS' };
  }

  // 5. Bind device_id tại lần gọi đầu tiên nếu chưa có
  if (!t.device_id) {
    await pool.request()
      .input('tid', sql.VarChar(64), ticket)
      .input('did', sql.VarChar(100), deviceId)
      .query(`UPDATE ADMIN_2FA_TICKET SET device_id = @did WHERE ticket_id = @tid`);
  }

  // 6. IP mismatch → chỉ log warning, KHÔNG chặn (theo yêu cầu)
  const ipMismatch = (t.ip_address || '') !== (ip || '');

  return {
    valid: true,
    userId: t.user_id,
    deviceId: t.device_id || deviceId,
    ipMismatch,
    issuedIp: t.ip_address,
    failedAttempts: t.failed_attempts || 0,
  };
}

/**
 * Đánh dấu ticket đã sử dụng thành công (burn ticket) sau khi vân tay khớp.
 * Sử dụng cập nhật nguyên tử chống replay: chỉ request cập nhật được used_at IS NULL mới hợp lệ.
 */
async function markTicketUsed(ticket, deviceId) {
  if (!ticket) return false;
  const pool = await getPool();
  const mark = await pool.request()
    .input('tid', sql.VarChar(64), ticket)
    .input('did', sql.VarChar(100), deviceId || null)
    .query(`
      UPDATE ADMIN_2FA_TICKET
      SET used_at = GETDATE(),
          device_id = ISNULL(device_id, @did)
      WHERE ticket_id = @tid AND used_at IS NULL
        AND expires_at >= GETDATE()
    `);
  return Boolean(mark.rowsAffected && mark.rowsAffected[0] === 1);
}

/**
 * Ghi nhận 1 lần quét vân tay không khớp (tăng failed_attempts).
 * Nếu đạt 3 lần, tự động khóa ticket (used_at = GETDATE()).
 */
async function recordFailedScan(ticket) {
  if (!ticket) return { failedAttempts: 0, burned: false };
  const pool = await getPool();
  const r = await pool.request()
    .input('tid', sql.VarChar(64), ticket)
    .query(`
      UPDATE ADMIN_2FA_TICKET
      SET failed_attempts = failed_attempts + 1,
          used_at = CASE WHEN failed_attempts + 1 >= 3 THEN GETDATE() ELSE used_at END
      OUTPUT INSERTED.failed_attempts, INSERTED.used_at
      WHERE ticket_id = @tid
    `);
  const row = r.recordset[0];
  const count = row ? row.failed_attempts : 1;
  return { failedAttempts: count, burned: count >= 3 };
}

/**
 * Consume ticket (one-time use truyền thống, tương thích ngược).
 */
async function consumeTicket({ ticket, deviceId, ip }) {
  const v = await validateTicket({ ticket, deviceId, ip });
  if (!v.valid) return v;
  const marked = await markTicketUsed(ticket, deviceId);
  if (!marked) {
    return { valid: false, reason: 'TICKET_ALREADY_USED' };
  }
  return v;
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
  validateTicket,
  markTicketUsed,
  recordFailedScan,
  cleanupExpiredTickets,
  getRecentFailures,
  TICKET_TTL_SECONDS,
};