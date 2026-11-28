// backend/src/pin-routes.js — API mã PIN: cấp/đổi (người có thẩm quyền), xem (chỉ chính chủ)
'use strict';

module.exports = function registerPinRoutes(app, {
  sql, getPool, requireAuth, pinLimiter, pinVault, writeAccessLog, getClientIp,
  decryptTemplate, requestScan, isAgentOnline,
}) {
  const fail = (res, tag, err) => {
    if (err.status && err.code) return res.status(err.status).json({ error: err.message, code: err.code });
    console.error(`[${tag}]`, err);
    return res.status(500).json({ error: 'Lỗi xử lý mã PIN' });
  };
  const log = (req, action, note, userId = req.user.user_id) => writeAccessLog({
    userId, fileId: null, action, ip: getClientIp(req), note,
  });

  // Cấp / đổi PIN. Phản hồi KHÔNG chứa mã PIN.
  app.post('/api/admin/users/:userId/pin/generate', requireAuth, async (req, res) => {
    try {
      const result = await pinVault.issue({
        actor: req.user, targetUserId: req.params.userId, rotate: req.body?.rotate === true,
      });
      const action = { NEW: 'PIN_GENERATED', ROTATE: 'PIN_ROTATED', REVIEW: 'PIN_REVIEW_GRANTED' }[result.mode];
      await log(req, action, `${action} cho ${result.user_id} (${result.full_name})`);
      res.json({ success: true, ...result });
    } catch (err) {
      fail(res, 'POST pin/generate', err);
    }
  });

  // Chấm đỏ trên nút chuông
  app.get('/api/user/check-new-pin', requireAuth, async (req, res) => {
    try {
      const r = await (await getPool()).request()
        .input('uid', sql.VarChar(50), req.user.user_id)
        .query('SELECT COUNT(*) AS count FROM PIN_DELIVERY WHERE user_id = @uid AND is_read = 0 AND expires_at > GETDATE()');
      res.json({ has_new_pin: r.recordset[0].count > 0 });
    } catch (err) {
      fail(res, 'GET check-new-pin', err);
    }
  });

  app.get('/api/user/pin-status', requireAuth, async (req, res) => {
    try {
      res.json(await pinVault.status(req.user.user_id));
    } catch (err) {
      fail(res, 'GET pin-status', err);
    }
  });

  // Xem lần đầu: chỉ người vừa được cấp PIN lần đầu, một lần, không cần vân tay
  app.get('/api/user/my-pin', requireAuth, async (req, res) => {
    try {
      const pin = await pinVault.takeFirstView(req.user.user_id);
      if (!pin) {
        return res.status(404).json({ error: 'Không có mã PIN nào đang chờ xem lần đầu.', code: 'PIN_NO_FIRST_VIEW' });
      }
      await log(req, 'PIN_FIRST_VIEW', 'Xem mã PIN lần đầu');
      res.json({ success: true, pin });
    } catch (err) {
      fail(res, 'GET my-pin', err);
    }
  });

  // Xem lại mã PIN đang dùng: BẮT BUỘC quét đúng vân tay của chính chủ, trên đúng đầu đọc máy đang dùng
  app.post('/api/user/my-pin/reveal', requireAuth, pinLimiter, async (req, res) => {
    const userId = req.user.user_id;
    try {
      await pinVault.requireReady();
      const stored = await pinVault.readStoredPin(userId);
      if (!stored.hasPin) {
        return res.status(404).json({ error: 'Bạn chưa được cấp mã PIN.', code: 'PIN_NOT_SET' });
      }
      if (!stored.pin) {
        return res.status(409).json({
          error: 'Mã PIN này được cấp theo cơ chế cũ nên chưa xem lại được. Nhập đúng mã một lần khi mở tài liệu Cấp 4-5, hoặc gửi yêu cầu đổi mã mới.',
          code: 'PIN_NOT_VIEWABLE',
        });
      }

      const deviceId = req.headers['x-device-fp'];
      if (!deviceId || !isAgentOnline(deviceId)) {
        return res.status(503).json({
          error: 'Chưa kết nối máy quét vân tay trên máy này. Vui lòng bật Fingerprint Agent.',
          agent_offline: true,
        });
      }

      const fp = await (await getPool()).request()
        .input('uid', sql.VarChar(50), userId)
        .query('SELECT template_enc FROM USER_FINGERPRINT WHERE user_id = @uid AND active = 1');
      if (fp.recordset.length === 0) {
        return res.status(403).json({ error: 'Bạn chưa đăng ký vân tay. Vui lòng liên hệ Quản trị viên.', needs_enroll: true });
      }
      const template = decryptTemplate(fp.recordset[0].template_enc, { userId, action: 'PIN_REVEAL' });
      if (!template || template.length < 100) {
        await log(req, 'PIN_REVEAL_FAIL', 'Mẫu vân tay hỏng hoặc sai khóa mã hóa');
        return res.status(500).json({ error: 'Mẫu vân tay bị hỏng. Vui lòng đăng ký lại.', code: 'TEMPLATE_DECRYPT_FAILED' });
      }

      let scan;
      try {
        scan = await requestScan(deviceId, { template_b64: template.toString('base64'), file_id: 'VERIFY' });
      } catch (err) {
        if (err.message === 'AGENT_OFFLINE' || err.message === 'AGENT_DISCONNECTED') {
          return res.status(503).json({ error: 'Máy quét vừa mất kết nối.', agent_offline: true });
        }
        if (err.message === 'SCAN_TIMEOUT') {
          await log(req, 'PIN_REVEAL_FAIL', 'Hết thời gian chờ quét');
          return res.status(408).json({ error: 'Hết thời gian chờ quét vân tay.', timeout: true });
        }
        throw err;
      }

      if (!scan || scan.match !== true) {
        if (scan?.error === 'CANCELLED') {
          return res.status(409).json({ error: 'Yêu cầu quét đã bị hủy bởi thao tác khác.', cancelled: true });
        }
        if (scan?.error === 'TIMEOUT') {
          await log(req, 'PIN_REVEAL_FAIL', 'Hết thời gian chờ quét');
          return res.status(408).json({ error: 'Hết thời gian chờ quét vân tay. Vui lòng thử lại.', timeout: true });
        }
        if (scan?.error) {
          await log(req, 'PIN_REVEAL_FAIL', `Lỗi thiết bị: ${scan.error}`);
          return res.status(503).json({ error: 'Máy quét vân tay đang lỗi. Kiểm tra cáp USB và Agent.', device_error: true });
        }
        await log(req, 'PIN_REVEAL_FAIL', `Vân tay không khớp (score=${scan?.score})`);
        return res.status(403).json({ error: 'Vân tay không khớp. Vui lòng thử lại.', code: 'FINGERPRINT_MISMATCH' });
      }

      // Đọc lại sau khi quét: PIN có thể vừa được đổi trong lúc chờ đặt ngón tay
      const current = await pinVault.readStoredPin(userId);
      if (!current.pin) return res.status(409).json({ error: 'Mã PIN vừa thay đổi. Vui lòng thử lại.', code: 'PIN_NOT_VIEWABLE' });
      await pinVault.clearNotices(userId);
      await log(req, 'PIN_REVEAL_OK', `Xem lại mã PIN sau khi quét vân tay (score=${scan.score})`);
      res.json({ success: true, pin: current.pin });
    } catch (err) {
      fail(res, 'POST my-pin/reveal', err);
    }
  });
};
