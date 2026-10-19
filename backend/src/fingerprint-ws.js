const WebSocket = require('ws');

const agentConnections = new Map();
const pendingJobs = new Map();

function setupFingerprintWS(httpServer, { BRIDGE_TOKEN }) {
  const wss = new WebSocket.Server({ server: httpServer, path: '/ws/fingerprint' });

  wss.on('connection', (ws, req) => {
    let deviceId;
    try {
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('bridge_token');
      deviceId = url.searchParams.get('device_id');
      if (!token || token !== BRIDGE_TOKEN) throw new Error('Invalid bridge token');
      if (!deviceId) throw new Error('Missing device_id');
    } catch (err) {
      try { ws.close(4001, err.message); } catch (_) {}
      return;
    }

    const existing = agentConnections.get(deviceId);
    if (existing && existing.ws !== ws) {
      try { existing.ws.close(4002, 'Replaced'); } catch (_) {}
    }

    agentConnections.set(deviceId, { ws, lastPing: Date.now(), connectedAt: Date.now() });
    console.log(`[WS] Agent online: ${deviceId} (total: ${agentConnections.size})`);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'pong') {
          const c = agentConnections.get(deviceId);
          if (c) c.lastPing = Date.now();
        } else if (msg.type === 'scan_result' || msg.type === 'enroll_result') {
          const pending = pendingJobs.get(msg.job_id);
          if (pending && pending.deviceId === deviceId) {
            clearTimeout(pending.timeout);
            pendingJobs.delete(msg.job_id);
            pending.resolve(msg);
          }
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
      for (const [jobId, pending] of pendingJobs.entries()) {
        if (pending.deviceId === deviceId) {
          clearTimeout(pending.timeout);
          pendingJobs.delete(jobId);
          pending.reject(new Error('AGENT_DISCONNECTED'));
        }
      }
    });

    ws.on('error', () => {});
  });

  const heartbeat = setInterval(() => {
    for (const [deviceId, c] of agentConnections.entries()) {
      if (Date.now() - c.lastPing > 90000) {
        try { c.ws.terminate(); } catch (_) {}
        agentConnections.delete(deviceId);
        continue;
      }
      try { c.ws.send(JSON.stringify({ type: 'ping' })); } catch (_) {}
    }
  }, 30000);

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
      conn.ws.send(JSON.stringify({
        type: 'scan_request',
        job_id: jobId,
        file_id,
        template_plain_b64: template_b64,
        timeout_seconds: Math.max(10, Math.floor(timeoutMs / 1000) - 5),
      }));
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
      reject(new Error('ENROLL_TIMEOUT'));
    }, timeoutMs);

    pendingJobs.set(jobId, { resolve, reject, timeout, deviceId });

    try {
      conn.ws.send(JSON.stringify({
        type: 'enroll_request',
        job_id: jobId,
        user_id,
        timeout_seconds,
      }));
    } catch (err) {
      pendingJobs.delete(jobId);
      clearTimeout(timeout);
      reject(err);
    }
  });
}

function isAgentOnline(deviceId) {
  return agentConnections.has(deviceId);
}

function listAgents() {
  return Array.from(agentConnections.entries()).map(([id, c]) => ({
    device_id: id,
    connected_at: new Date(c.connectedAt).toISOString(),
    last_ping: new Date(c.lastPing).toISOString(),
  }));
}

module.exports = {
  setupFingerprintWS,
  requestScan,
  requestEnroll,
  isAgentOnline,
  listAgents,
};