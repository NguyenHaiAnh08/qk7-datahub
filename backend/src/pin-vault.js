// backend/src/pin-vault.js
// ═══════════════════════════════════════════════════════════════════════════
// MÃ PIN CỦA QUÂN NHÂN — lưu, cấp, đổi
//   - USER.pin_hash (bcrypt): dùng để KIỂM TRA khi mở tài liệu Cấp 4-5.
//   - USER.pin_enc  (AES-256-GCM): bản mã hóa để CHÍNH CHỦ xem lại sau khi quét vân tay.
//     Khóa mã hóa dẫn xuất từ FP_ENC_KEY (muối riêng cho PIN), gắn chặt với user_id.
//   - PIN_DELIVERY: chỉ còn là THÔNG BÁO cho chính chủ, không chứa mã PIN. pin_code mang loại thông báo:
//       NEW    — người chưa từng có PIN: được xem lần đầu không cần quét vân tay (hạn 24 giờ)
//       ROTATE — vừa đổi PIN mới: quét vân tay để xem
//       REVIEW — được mời xem lại PIN đang dùng: quét vân tay để xem
//     (Dòng cũ còn chứa 6 chữ số, sinh trước khi đổi cơ chế, được coi như NEW.)
//   - Người cấp PIN KHÔNG nhận được con số PIN ở bất kỳ API nào.
// Cần chạy backend/migrations/add_pin_view_again.sql.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const crypto = require('crypto');
const bcrypt = require('./bcrypt-lib');

const PIN_PERMISSION = 'USER_PIN_GENERATE';
const PIN_PERMISSION_ID = 'PERM-USR-08';
const ADMIN_ROLE = 'ROL-01';
const FIRST_VIEW_HOURS = 24;
const NOTICE_HOURS = 7 * 24;
// Điều kiện SQL của thông báo còn được xem lần đầu (NEW, hoặc dòng cũ chứa 6 chữ số)
const FIRST_VIEW_SQL = `(pin_code = 'NEW' OR pin_code NOT LIKE '%[^0-9]%')`;

class PinError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

module.exports = function createPinVault({
  sql, getPool, getUserPermissions, secret, protectedAdminId,
}) {
  const key = secret ? crypto.scryptSync(secret, 'qk7-pin-salt', 32) : null;
  const normId = (id) => String(id || '').trim().toUpperCase();

  function encryptPin(userId, pin) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
    cipher.setAAD(Buffer.from(normId(userId)));
    const body = Buffer.concat([cipher.update(String(pin), 'utf8'), cipher.final()]);
    return 'v1:' + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
  }

  function decryptPin(userId, stored) {
    if (!key || !stored || !stored.startsWith('v1:')) return null;
    try {
      const buf = Buffer.from(stored.slice(3), 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12), { authTagLength: 16 });
      decipher.setAAD(Buffer.from(normId(userId)));
      decipher.setAuthTag(buf.subarray(12, 28));
      return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
    } catch {
      return null; // sai khóa hoặc dữ liệu bị sửa
    }
  }

  let readyCache = { ok: false, at: 0 };
  /** Đã có cột pin_enc chưa (chưa có thì thử lại sau 30 giây, không cần khởi động lại) */
  async function ready() {
    if (!key) return false;
    if (readyCache.ok || Date.now() - readyCache.at < 30 * 1000) return readyCache.ok;
    let ok = false;
    try {
      const pool = await getPool();
      const r = await pool.request().query(`SELECT COL_LENGTH('dbo.[USER]', 'pin_enc') AS len`);
      ok = Boolean(r.recordset[0].len);
    } catch (e) {
      console.warn('[pin-vault] kiểm tra cột pin_enc lỗi:', e.message);
    }
    readyCache = { ok, at: Date.now() };
    return ok;
  }

  async function requireReady() {
    if (!(await ready())) {
      throw new PinError(503, 'PIN_VAULT_NOT_INITIALIZED',
        'Chưa bật cơ chế xem lại mã PIN. Quản trị viên cần chạy backend/migrations/add_pin_view_again.sql.');
    }
  }

  /** Quản trị viên, hoặc người được cấp quyền "Cấp mã PIN" */
  async function canIssue(user) {
    if (!user?.user_id) return false;
    if ((user.roles || []).includes(ADMIN_ROLE) || normId(user.user_id) === normId(protectedAdminId)) return true;
    const codes = await getUserPermissions(user.user_id);
    return codes.includes(PIN_PERMISSION);
  }

  async function loadTarget(userId) {
    const pool = await getPool();
    const r = await pool.request()
      .input('uid', sql.VarChar(50), userId)
      .query(`
        SELECT u.user_id, u.full_name, u.pin_hash, u.pin_enc,
               CASE WHEN EXISTS (SELECT 1 FROM USER_FINGERPRINT f WHERE f.user_id = u.user_id AND f.active = 1)
                    THEN 1 ELSE 0 END AS has_fingerprint,
               CASE WHEN EXISTS (SELECT 1 FROM USER_ROLE ur WHERE ur.user_id = u.user_id AND ur.role_id = '${ADMIN_ROLE}'
                                   AND (ur.expires_at IS NULL OR ur.expires_at > GETDATE()))
                    THEN 1 ELSE 0 END AS is_admin,
               CASE WHEN EXISTS (SELECT 1 FROM PIN_DELIVERY d WHERE d.user_id = u.user_id AND d.is_read = 0
                                   AND ${FIRST_VIEW_SQL})
                    THEN 1 ELSE 0 END AS never_viewed
        FROM [USER] u WHERE u.user_id = @uid`);
    return r.recordset[0] || null;
  }

  /** Mã PIN đang dùng của một người; null nếu không có hoặc không xem lại được */
  async function readStoredPin(userId) {
    const pool = await getPool();
    const r = await pool.request()
      .input('uid', sql.VarChar(50), userId)
      .query(`SELECT user_id, pin_hash, pin_enc FROM [USER] WHERE user_id = @uid`);
    const row = r.recordset[0];
    if (!row?.pin_hash) return { hasPin: false, pin: null };
    const pin = decryptPin(row.user_id, row.pin_enc);
    // Bản mã phải khớp đúng mã đang dùng để kiểm tra
    const matches = pin ? await bcrypt.compare(pin, row.pin_hash) : false;
    return { hasPin: true, pin: matches ? pin : null };
  }

  /**
   * Ghi bản mã của PIN vừa được nhập ĐÚNG (PIN cấp theo cơ chế cũ chỉ có hash).
   * Người gọi phải đã kiểm tra pin khớp pinHash.
   */
  async function rememberPin(userId, pin, pinHash) {
    if (!(await ready())) return false;
    const current = await readStoredPin(userId);
    if (current.pin === pin) return false;
    const pool = await getPool();
    await pool.request()
      .input('uid', sql.VarChar(50), userId)
      .input('hash', sql.VarChar(255), pinHash)
      .input('enc', sql.VarChar(255), encryptPin(userId, pin))
      .query(`UPDATE [USER] SET pin_enc = @enc WHERE user_id = @uid AND pin_hash = @hash`);
    return true;
  }

  async function closePinRequests(request, actorId) {
    await request
      .input('actor', sql.VarChar(50), actorId)
      .query(`UPDATE APPROVAL_REQUEST
              SET status = 'EXECUTED', reviewed_by = @actor, reviewed_at = GETDATE(), executed_at = GETDATE()
              WHERE requester_id = @uid AND required_permission = '${PIN_PERMISSION_ID}' AND status = 'PENDING'`);
  }

  async function putNotice(userId, kind, hours) {
    const pool = await getPool();
    await pool.request()
      .input('uid', sql.VarChar(50), userId)
      .input('kind', sql.VarChar(10), kind)
      .input('hours', sql.Int, hours)
      .query(`SET XACT_ABORT ON;
              BEGIN TRAN;
              DELETE FROM PIN_DELIVERY WHERE user_id = @uid;
              INSERT INTO PIN_DELIVERY (user_id, pin_code, expires_at) VALUES (@uid, @kind, DATEADD(HOUR, @hours, GETDATE()));
              COMMIT;`);
  }

  /** Sinh PIN mới. onlyIfNone: chỉ ghi khi người đó chưa có PIN. Trả về false nếu không ghi được. */
  async function writeNewPin(userId, kind, onlyIfNone) {
    const pin = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const hash = await bcrypt.hash(pin, 10);
    const pool = await getPool();
    const r = await pool.request()
      .input('uid', sql.VarChar(50), userId)
      .input('hash', sql.VarChar(255), hash)
      .input('enc', sql.VarChar(255), encryptPin(userId, pin))
      .input('kind', sql.VarChar(10), kind)
      .input('hours', sql.Int, kind === 'NEW' ? FIRST_VIEW_HOURS : NOTICE_HOURS)
      .query(`SET XACT_ABORT ON;
              DECLARE @n INT;
              BEGIN TRAN;
              UPDATE [USER] SET pin_hash = @hash, pin_enc = @enc, updated_at = GETDATE()
              WHERE user_id = @uid ${onlyIfNone ? `AND (pin_hash IS NULL OR pin_hash = '')` : ''};
              SET @n = @@ROWCOUNT;
              IF @n > 0
              BEGIN
                DELETE FROM PIN_DELIVERY WHERE user_id = @uid;
                INSERT INTO PIN_DELIVERY (user_id, pin_code, expires_at) VALUES (@uid, @kind, DATEADD(HOUR, @hours, GETDATE()));
              END
              COMMIT;
              SELECT @n AS n;`);
    return r.recordset[0].n > 0;
  }

  /**
   * Cấp PIN cho một quân nhân.
   *   chưa có PIN           → sinh PIN mới (NEW)
   *   đã có PIN             → giữ nguyên, mời xem lại bằng vân tay (REVIEW)
   *   đã có PIN + rotate    → đổi PIN mới (ROTATE)
   */
  async function issue({ actor, targetUserId, rotate = false }) {
    await requireReady();
    if (!(await canIssue(actor))) {
      throw new PinError(403, 'PIN_ISSUE_DENIED', 'Chỉ Quản trị viên hoặc người có quyền "Cấp mã PIN" được cấp mã PIN.');
    }
    const target = await loadTarget(targetUserId);
    if (!target) throw new PinError(404, 'USER_NOT_FOUND', 'Không tìm thấy quân nhân');

    const actorIsAdmin = (actor.roles || []).includes(ADMIN_ROLE);
    if (normId(target.user_id) === normId(protectedAdminId) && normId(actor.user_id) !== normId(protectedAdminId)) {
      throw new PinError(403, 'PROTECTED_ADMIN_TARGET', 'Tài khoản Quản trị tối cao được bảo vệ: chỉ chính chủ được thao tác.');
    }
    if (!actorIsAdmin && normId(actor.user_id) !== normId(protectedAdminId)) {
      if (normId(target.user_id) === normId(actor.user_id)) {
        throw new PinError(403, 'PIN_SELF_ISSUE', 'Bạn không thể tự cấp mã PIN cho chính mình.');
      }
      if (target.is_admin) {
        throw new PinError(403, 'ADMIN_ROLE_LOCKED', 'Chỉ Quản trị viên được cấp mã PIN cho tài khoản Quản trị.');
      }
    }

    const noFingerprint = () => new PinError(409, 'TARGET_NO_FINGERPRINT',
      'Quân nhân chưa đăng ký vân tay nên sẽ không xem được mã PIN. Hãy đăng ký vân tay trước.');

    let mode = null;
    if (!target.pin_hash && await writeNewPin(target.user_id, 'NEW', true)) {
      mode = 'NEW';
    } else if (rotate) {
      if (!target.has_fingerprint) throw noFingerprint();
      await writeNewPin(target.user_id, 'ROTATE', false);
      mode = 'ROTATE';
    } else {
      const stored = await readStoredPin(target.user_id);
      if (!stored.pin) {
        throw new PinError(409, 'PIN_NOT_VIEWABLE',
          'Mã PIN hiện tại được cấp theo cơ chế cũ nên chưa xem lại được. Nếu quân nhân đã quên, hãy dùng "Đổi PIN mới".');
      }
      if (target.never_viewed) {
        await putNotice(target.user_id, 'NEW', FIRST_VIEW_HOURS); // chưa xem lần nào: mở lại lượt xem đầu
        mode = 'NEW';
      } else {
        if (!target.has_fingerprint) throw noFingerprint();
        await putNotice(target.user_id, 'REVIEW', NOTICE_HOURS);
        mode = 'REVIEW';
      }
    }

    const pool = await getPool();
    await closePinRequests(pool.request().input('uid', sql.VarChar(50), target.user_id), actor.user_id);

    const message = {
      NEW: `Đã cấp mã PIN cho ${target.full_name}. Quân nhân xem mã ở nút chuông (trong 24 giờ).`,
      ROTATE: `Đã đổi mã PIN mới cho ${target.full_name}. Mã cũ hết hiệu lực; quân nhân quét vân tay để xem mã mới.`,
      REVIEW: `${target.full_name} đã có mã PIN nên được giữ nguyên. Quân nhân quét vân tay ở nút chuông để xem lại.`,
    }[mode];
    return { user_id: target.user_id, full_name: target.full_name, mode, message };
  }

  /** Thông tin cho bảng "Mã PIN của tôi" (không chứa mã PIN) */
  async function status(userId) {
    const vaultReady = await ready();
    const pool = await getPool();
    const r = await pool.request()
      .input('uid', sql.VarChar(50), userId)
      .query(`
        SELECT u.pin_hash,
               CASE WHEN EXISTS (SELECT 1 FROM USER_FINGERPRINT f WHERE f.user_id = u.user_id AND f.active = 1)
                    THEN 1 ELSE 0 END AS has_fingerprint,
               CASE WHEN EXISTS (SELECT 1 FROM APPROVAL_REQUEST a WHERE a.requester_id = u.user_id
                                   AND a.status = 'PENDING' AND a.required_permission = '${PIN_PERMISSION_ID}')
                    THEN 1 ELSE 0 END AS request_pending,
               (SELECT TOP 1 CASE WHEN ${FIRST_VIEW_SQL} THEN 'NEW' ELSE pin_code END
                  FROM PIN_DELIVERY d WHERE d.user_id = u.user_id AND d.is_read = 0 AND d.expires_at > GETDATE()
                  ORDER BY d.created_at DESC) AS notice
        FROM [USER] u WHERE u.user_id = @uid`);
    const row = r.recordset[0];
    if (!row) throw new PinError(404, 'USER_NOT_FOUND', 'Không tìm thấy quân nhân');
    const stored = vaultReady ? await readStoredPin(userId) : { pin: null };
    return {
      ready: vaultReady,
      has_pin: Boolean(row.pin_hash),
      viewable: Boolean(stored.pin),
      has_fingerprint: row.has_fingerprint === 1,
      request_pending: row.request_pending === 1,
      notice: row.notice || null,
    };
  }

  /** Lượt xem đầu (không cần vân tay) của người vừa được cấp PIN lần đầu. Dùng một lần. */
  async function takeFirstView(userId) {
    await requireReady();
    const pool = await getPool();
    const r = await pool.request()
      .input('uid', sql.VarChar(50), userId)
      .query(`SELECT TOP 1 d.id, d.pin_code, u.pin_hash
              FROM PIN_DELIVERY d JOIN [USER] u ON u.user_id = d.user_id
              WHERE d.user_id = @uid AND d.is_read = 0 AND d.expires_at > GETDATE() AND ${FIRST_VIEW_SQL}
              ORDER BY d.created_at DESC`);
    const row = r.recordset[0];
    if (!row?.pin_hash) return null;

    let pin;
    if (row.pin_code === 'NEW') {
      pin = (await readStoredPin(userId)).pin;
    } else if (await bcrypt.compare(row.pin_code, row.pin_hash)) {
      pin = row.pin_code; // dòng cũ còn chứa mã PIN
      await rememberPin(userId, pin, row.pin_hash);
    }
    if (!pin) return null;
    // Hai yêu cầu cùng lúc: chỉ yêu cầu xóa được dòng mới nhận mã
    const del = await pool.request().input('id', sql.Int, row.id).query('DELETE FROM PIN_DELIVERY WHERE id = @id');
    return del.rowsAffected[0] === 1 ? pin : null;
  }

  async function clearNotices(userId) {
    const pool = await getPool();
    await pool.request().input('uid', sql.VarChar(50), userId).query('DELETE FROM PIN_DELIVERY WHERE user_id = @uid');
  }

  return {
    ready, requireReady, canIssue, issue, status, readStoredPin, rememberPin, takeFirstView, clearNotices,
    encryptPin, decryptPin,
  };
};

module.exports.PinError = PinError;
module.exports.PIN_PERMISSION_ID = PIN_PERMISSION_ID;
