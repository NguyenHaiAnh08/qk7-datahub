/**
 * Bảo mật tầng ứng dụng cho kênh Backend <-> Fingerprint Agent.
 *
 * Mục tiêu: kênh vẫn an toàn dù TLS bị diệt virus/proxy ký lại hoặc không xác minh được chứng chỉ.
 *  - Xác thực hai chiều bằng HMAC-SHA256 (thách đố/đáp) — BRIDGE_TOKEN không bao giờ đi qua mạng.
 *  - Mọi tin nhắn sau đó được mã hóa + xác thực bằng AES-256-GCM, khóa phiên dẫn xuất từ
 *    BRIDGE_TOKEN + 2 số ngẫu nhiên (nonce) của hai phía → mỗi kết nối một khóa riêng.
 *  - Số thứ tự (seq) tăng dần theo từng chiều → chống phát lại/chèn lại tin nhắn.
 *
 * Định dạng gói tin: {"e": base64( iv(12) | ciphertext | tag(16) )}
 * Bản rõ bên trong: {"s": <seq>, "d": <đối tượng JSON gốc>}; AAD = "s2a" | "a2s" (chiều gửi).
 */
const crypto = require('crypto');

const hmac = (token, data) =>
  crypto.createHmac('sha256', Buffer.from(token, 'utf8')).update(data, 'utf8').digest();

const clientProof = (token, nonce, deviceId) =>
  hmac(token, `qk7-agent-auth|${nonce}|${deviceId}`);
const serverProof = (token, nonce, cnonce, deviceId) =>
  hmac(token, `qk7-server-auth|${nonce}|${cnonce}|${deviceId}`);
const sessionKey = (token, nonce, cnonce, deviceId) =>
  hmac(token, `qk7-session|${nonce}|${cnonce}|${deviceId}`); // 32 byte

const safeEqual = (a, b) =>
  a.length === b.length && crypto.timingSafeEqual(a, b);

/** Phiên mã hóa của một kết nối. dirOut: chiều gửi đi; dirIn: chiều nhận về. */
function createSession(key, dirOut, dirIn) {
  let sendSeq = 0;
  let recvSeq = 0;
  return {
    seal(obj) {
      const iv = crypto.randomBytes(12);
      const c = crypto.createCipheriv('aes-256-gcm', key, iv);
      c.setAAD(Buffer.from(dirOut));
      const pt = Buffer.from(JSON.stringify({ s: ++sendSeq, d: obj }), 'utf8');
      const ct = Buffer.concat([c.update(pt), c.final()]);
      return JSON.stringify({ e: Buffer.concat([iv, ct, c.getAuthTag()]).toString('base64') });
    },
    open(raw) {
      const { e } = JSON.parse(raw);
      const buf = Buffer.from(e, 'base64');
      if (buf.length < 12 + 16) throw new Error('gói quá ngắn');
      const d = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12), { authTagLength: 16 });
      d.setAAD(Buffer.from(dirIn));
      d.setAuthTag(buf.subarray(buf.length - 16));
      const pt = Buffer.concat([d.update(buf.subarray(12, buf.length - 16)), d.final()]);
      const { s, d: obj } = JSON.parse(pt.toString('utf8'));
      if (!Number.isInteger(s) || s <= recvSeq) throw new Error('seq không hợp lệ (phát lại?)');
      recvSeq = s;
      return obj;
    },
  };
}

module.exports = { clientProof, serverProof, sessionKey, createSession, safeEqual };
