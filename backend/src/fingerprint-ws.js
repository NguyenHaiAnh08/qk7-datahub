const WebSocket = require('ws');
const crypto = require('crypto');
const agentCrypto = require('./agent-crypto');

// Cho phép agent bản cũ (gửi bridge_token trong URL, không mã hóa tầng ứng dụng) trong thời gian chuyển đổi.
// Khi mọi máy con đã cập nhật: đặt AGENT_ALLOW_LEGACY=false trong .env để chỉ nhận agent bản mới.
const ALLOW_LEGACY_AGENT = process.env.AGENT_ALLOW_LEGACY !== 'false';

function sendJson(conn, obj) {
  conn.ws.send(conn.session ? conn.session.seal(obj) : JSON.stringify(obj));
}

const agentConnections = new Map();
const pendingJobs = new Map();
const deviceEnrollProgress = new Map();

function setupFingerprintWS(httpServer, { BRIDGE_TOKEN }) {
  const wss = new WebSocket.Server({ server: httpServer, path: '/ws/fingerprint' });

  wss.on('connection', (ws, req) => {
    let deviceId;
    let isV2 = false;
    try {
      // 1. Kiểm tra Origin header chống Cross-Site WebSocket Hijacking (CSWSH)
      const origin = req.headers['origin'];
      if (origin) {
        const isAllowed = origin.includes('localhost') || origin.includes('127.0.0.1') ||
                          (process.env.SERVER_IP && origin.includes(process.env.SERVER_IP)) ||
                          (process.env.SERVER_DOMAIN && origin.includes(process.env.SERVER_DOMAIN));
        if (!isAllowed) {
          throw new Error('Forbidden WebSocket Origin: ' + origin);
        }
      }

      // 2. Xác thực Device ID + (agent bản mới: thách đố HMAC; bản cũ: Bridge Token trong URL)
      const url = new URL(req.url, 'http://localhost');
      deviceId = url.searchParams.get('device_id') || req.headers['x-device-id'];
      if (!deviceId) throw new Error('Missing device_id');
      isV2 = url.searchParams.get('proto') === '2';
      if (!isV2) {
        if (!ALLOW_LEGACY_AGENT) throw new Error('Agent bản cũ không được chấp nhận — hãy cập nhật agent');
        const token = url.searchParams.get('bridge_token') || req.headers['x-bridge-token'];
        if (!token || token !== BRIDGE_TOKEN) throw new Error('Invalid bridge token');
        console.warn(`[WS] ⚠️ Agent ${deviceId} dùng giao thức CŨ (token trong URL, không mã hóa tầng ứng dụng). Hãy cập nhật agent.`);
      }
    } catch (err) {
      try { ws.close(4001, err.message); } catch (_) {}
      return;
    }

    if (isV2) {
      // ── Bắt tay xác thực 2 chiều bằng HMAC, rồi mới đăng ký agent ──
      const nonce = crypto.randomBytes(16).toString('base64');
      const timer = setTimeout(() => { try { ws.close(4001, 'Auth timeout'); } catch (_) {} }, 8000);
      ws.once('message', (raw) => {
        clearTimeout(timer);
        try {
          const m = JSON.parse(raw.toString());
          if (m.type !== 'auth' || typeof m.cnonce !== 'string' || typeof m.proof !== 'string') throw new Error('bad auth');
          const expect = agentCrypto.clientProof(BRIDGE_TOKEN, nonce, deviceId);
          if (!agentCrypto.safeEqual(Buffer.from(m.proof, 'hex'), expect)) throw new Error('Invalid bridge token');
          const key = agentCrypto.sessionKey(BRIDGE_TOKEN, nonce, m.cnonce, deviceId);
          const srvProof = agentCrypto.serverProof(BRIDGE_TOKEN, nonce, m.cnonce, deviceId).toString('hex');
          ws.send(JSON.stringify({ type: 'auth_ok', proof: srvProof }));
          registerAgent(ws, deviceId, agentCrypto.createSession(key, 's2a', 'a2s'));
        } catch (err) {
          try { ws.close(4001, 'Invalid bridge token'); } catch (_) {}
        }
      });
      ws.on('error', () => {});
      ws.send(JSON.stringify({ type: 'challenge', nonce }));
      return;
    }

    registerAgent(ws, deviceId, null);
  });

  function registerAgent(ws, deviceId, session) {
    const existing = agentConnections.get(deviceId);
    if (existing && existing.ws !== ws) {
      try { existing.ws.close(4002, 'Replaced'); } catch (_) {}
    }

    agentConnections.set(deviceId, { ws, session, lastPing: Date.now(), connectedAt: Date.now() });
    console.log(`[WS] Agent online: ${deviceId} (total: ${agentConnections.size}) ${session ? '🔐 mã hóa E2E' : '⚠️ legacy'}`);

    ws.on('message', (raw) => {
      try {
        const msg = session ? session.open(raw.toString()) : JSON.parse(raw.toString());
        if (msg.type === 'pong') {
          const c = agentConnections.get(deviceId);
          if (c) c.lastPing = Date.now();
        } else if (msg.type === 'scan_result' || msg.type === 'enroll_result') {
          const pending = pendingJobs.get(msg.job_id);
          if (pending && pending.deviceId === deviceId) {
            clearTimeout(pending.timeout);
            pendingJobs.delete(msg.job_id);

            const c = agentConnections.get(deviceId);
            if (c) {
              if (msg.error === 'DEVICE_OFFLINE') {
                c.sensorOffline = true;
                console.warn(`[WS] ⚠️ Agent ${deviceId} báo DEVICE_OFFLINE (chưa nhận máy quét ZK9500).`);
              } else {
                c.sensorOffline = false;
              }
            }

            if (msg.type === 'enroll_result') {
              deviceEnrollProgress.set(deviceId, {
                enrolling: false,
                step: msg.success ? 3 : (deviceEnrollProgress.get(deviceId)?.step || 0),
                total: 3,
                state: msg.success ? 'completed' : (msg.error || 'error'),
                updatedAt: Date.now(),
              });
            }

            pending.resolve(msg);
          }
        } else if (msg.type === 'enroll_progress') {
          const pending = pendingJobs.get(msg.job_id);
          if (pending) pending.latestStep = msg.step;

          deviceEnrollProgress.set(deviceId, {
            enrolling: true,
            step: Number(msg.step) || 0,
            total: Number(msg.total) || 3,
            state: Number(msg.step) >= 3 ? 'merging' : `captured_${msg.step}`,
            updatedAt: Date.now(),
          });
        }
      } catch (err) {
        console.error('[WS] msg parse:', err.message);
      }
    });

    ws.on('close', () => {
      const current = agentConnections.get(deviceId);
      if (current && current.ws === ws) {
        agentConnections.delete(deviceId);
        console.log(`[WS] Agent offline: ${deviceId} (remaining: ${agentConnections.size})`);
      }
      deviceEnrollProgress.set(deviceId, {
        enrolling: false,
        step: 0,
        total: 3,
        state: 'offline',
        updatedAt: Date.now(),
      });
      for (const [jobId, pending] of pendingJobs.entries()) {
        if (pending.deviceId === deviceId) {
          clearTimeout(pending.timeout);
          pendingJobs.delete(jobId);
          pending.reject(new Error('AGENT_DISCONNECTED'));
        }
      }
    });

    ws.on('error', () => {});
  }

  const heartbeat = setInterval(() => {
    for (const [deviceId, c] of agentConnections.entries()) {
      if (Date.now() - c.lastPing > 90000) {
        try { c.ws.terminate(); } catch (_) {}
        agentConnections.delete(deviceId);
        continue;
      }
      try { sendJson(c, { type: 'ping' }); } catch (_) {}
    }
  }, 30000);

  wss.on('error', (err) => console.warn('[WSS error]:', err.message));
  wss.on('close', () => clearInterval(heartbeat));
  return wss;
}

function requestScan(deviceId, { template_b64, file_id }, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const conn = agentConnections.get(deviceId);
    if (!conn) return reject(new Error('AGENT_OFFLINE'));

    const jobId = 'JOB-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const timeout = setTimeout(() => {
      pendingJobs.delete(jobId);
      reject(new Error('SCAN_TIMEOUT'));
    }, timeoutMs);

    pendingJobs.set(jobId, { resolve, reject, timeout, deviceId });

    try {
      sendJson(conn, {
        type: 'scan_request',
        job_id: jobId,
        file_id,
        template_plain_b64: template_b64,
        timeout_seconds: Math.max(10, Math.floor(timeoutMs / 1000) - 5),
      });
    } catch (err) {
      pendingJobs.delete(jobId);
      clearTimeout(timeout);
      reject(err);
    }
  });
}

function requestEnroll(deviceId, { user_id, timeout_seconds = 60 }, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const conn = agentConnections.get(deviceId);
    if (!conn) return reject(new Error('AGENT_OFFLINE'));

    const jobId = 'ENR-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const timeout = setTimeout(() => {
      pendingJobs.delete(jobId);
      deviceEnrollProgress.set(deviceId, {
        enrolling: false,
        step: 0,
        total: 3,
        state: 'timeout',
        updatedAt: Date.now(),
      });
      reject(new Error('ENROLL_TIMEOUT'));
    }, timeoutMs);

    pendingJobs.set(jobId, { resolve, reject, timeout, deviceId, user_id });

    // Đánh dấu bắt đầu tiến trình enroll cho deviceId
    deviceEnrollProgress.set(deviceId, {
      enrolling: true,
      step: 0,
      total: 3,
      state: 'waiting_touch_1',
      jobId,
      updatedAt: Date.now(),
    });

    try {
      sendJson(conn, {
        type: 'enroll_request',
        job_id: jobId,
        user_id,
        timeout_seconds,
      });
    } catch (err) {
      pendingJobs.delete(jobId);
      clearTimeout(timeout);
      deviceEnrollProgress.set(deviceId, {
        enrolling: false,
        step: 0,
        total: 3,
        state: 'error',
        updatedAt: Date.now(),
      });
      reject(err);
    }
  });
}

function getEnrollProgress(deviceId) {
  if (deviceId && deviceEnrollProgress.has(deviceId)) {
    const p = deviceEnrollProgress.get(deviceId);
    if (Date.now() - p.updatedAt <= 120000) {
      return { enrolling: p.enrolling, step: p.step, total: p.total, state: p.state };
    }
  }
  // Nếu deviceId không truyền hoặc không khớp, tìm bất kỳ agent nào đang active enroll
  for (const [, p] of deviceEnrollProgress.entries()) {
    if (p.enrolling && Date.now() - p.updatedAt <= 120000) {
      return { enrolling: p.enrolling, step: p.step, total: p.total, state: p.state };
    }
  }
  return { enrolling: false, step: 0, total: 3, state: 'idle' };
}

function isAgentOnline(deviceId) {
  return agentConnections.has(deviceId);
}

function listAgents() {
  return Array.from(agentConnections.entries())
    .map(([id, c]) => ({
      device_id: id,
      sensor_ready: !c.sensorOffline,
      connected_at: new Date(c.connectedAt).toISOString(),
      last_ping: new Date(c.lastPing).toISOString(),
    }))
    .sort((a, b) => (b.sensor_ready ? 1 : 0) - (a.sensor_ready ? 1 : 0));
}

module.exports = {
  setupFingerprintWS,
  requestScan,
  requestEnroll,
  getEnrollProgress,
  isAgentOnline,
  listAgents,
};