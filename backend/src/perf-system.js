/**
 * Tài nguyên của máy chủ cho bảng đo hiệu năng (chỉ đọc).
 *  - Lấy mẫu định kỳ: CPU máy và tiến trình Node, bộ nhớ, độ trễ vòng lặp, số request đang chạy, pool SQL.
 *  - Chỉ đo khi có người xem (có nhớ đệm ngắn): tiến trình dịch vụ, ổ đĩa, thư mục dữ liệu, CSDL, dịch vụ, GPU NVIDIA.
 * Cấu hình (.env): PERF_SAMPLE_MS=2000
 */
'use strict';
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { execFile } = require('child_process');
const { monitorEventLoopDelay } = require('perf_hooks');
const perfTrace = require('./perf-trace');

const ROOT = path.join(__dirname, '..');
const MB = 1048576;
const GB = 1073741824;
const SAMPLE_MS = Math.max(500, Number(process.env.PERF_SAMPLE_MS) || 2000);
const HISTORY = 900; // 30 phút với chu kỳ 2 giây

const history = [];
let loop = null;
let last = null;
let poolRef = null;

const cpuTimes = () => os.cpus().reduce((acc, c) => {
  const total = Object.values(c.times).reduce((a, b) => a + b, 0);
  return { idle: acc.idle + c.times.idle, total: acc.total + total };
}, { idle: 0, total: 0 });

function takeSample() {
  const now = { t: process.hrtime.bigint(), os: cpuTimes(), proc: process.cpuUsage() };
  const m = process.memoryUsage();
  let cpuSystem = null;
  let cpuNode = null;
  if (last) {
    const elapsedUs = Number(now.t - last.t) / 1000;
    const total = now.os.total - last.os.total;
    cpuSystem = total > 0 ? 100 * (1 - (now.os.idle - last.os.idle) / total) : null;
    const used = now.proc.user + now.proc.system - last.proc.user - last.proc.system;
    cpuNode = 100 * used / elapsedUs / os.cpus().length;
  }
  last = now;
  const loopMean = loop ? loop.mean / 1e6 : null;
  const loopMax = loop ? loop.max / 1e6 : null;
  loop?.reset();
  const pool = poolRef;
  return {
    at: Date.now(),
    cpu_system_pct: cpuSystem,
    cpu_node_pct: cpuNode,
    mem_used_mb: (os.totalmem() - os.freemem()) / MB,
    rss_mb: m.rss / MB,
    heap_used_mb: m.heapUsed / MB,
    heap_total_mb: m.heapTotal / MB,
    external_mb: m.external / MB,
    loop_mean_ms: Number.isFinite(loopMean) ? loopMean : null,
    loop_max_ms: Number.isFinite(loopMax) ? loopMax : null,
    active_requests: perfTrace.activeCount(),
    sql_pool_size: pool?.size ?? null,
    sql_pool_busy: pool?.borrowed ?? null,
    sql_pool_waiting: pool?.pending ?? null,
  };
}

function start(getPool) {
  if (loop) return;
  loop = monitorEventLoopDelay({ resolution: 20 });
  loop.enable();
  takeSample();
  setInterval(() => {
    history.push(takeSample());
    if (history.length > HISTORY) history.shift();
    if (!poolRef && getPool) getPool().then((p) => { poolRef = p; }).catch(() => {});
  }, SAMPLE_MS).unref();
}

// ───────────────────────── Đo theo yêu cầu (có nhớ đệm) ─────────────────────────
const WAIT_MS = 6000; // một mục chậm (vd CSDL treo) không được giữ cả báo cáo

function cached(ttlMs, load) {
  let value;
  let at = 0;
  let pending = null;
  return () => {
    if (at && Date.now() - at < ttlMs) return Promise.resolve(value);
    if (!pending) {
      pending = Promise.resolve().then(load)
        .catch((e) => ({ error: e.message }))
        .then((v) => { value = v; at = Date.now(); pending = null; return v; });
    }
    let timer;
    const late = new Promise((resolve) => {
      timer = setTimeout(() => resolve({ error: 'Chưa có số liệu: quá 6 giây chưa đo xong' }), WAIT_MS);
    });
    return Promise.race([pending, late]).finally(() => clearTimeout(timer));
  };
}

const run = (cmd, args) => new Promise((resolve, reject) => {
  execFile(cmd, args, { timeout: 8000, windowsHide: true, maxBuffer: 4 * MB },
    (err, stdout) => (err ? reject(err) : resolve(stdout)));
});

let lastProcCpu = new Map();
let lastProcAt = 0;
const processes = cached(10000, async () => {
  let rows;
  if (process.platform === 'win32') {
    // "exit 0": tên tiến trình không đang chạy không phải là lỗi
    const script = "Get-Process node,sqlservr,python,pythonw,ollama* -ErrorAction SilentlyContinue | "
      + 'Select-Object Id,ProcessName,WorkingSet64,PrivateMemorySize64,CPU | ConvertTo-Json -Compress; exit 0';
    const out = (await run('powershell', ['-NoProfile', '-NonInteractive', '-Command', script])).trim();
    const data = out ? JSON.parse(out) : [];
    rows = (Array.isArray(data) ? data : [data]).map((p) => ({
      pid: p.Id, name: p.ProcessName, memory_mb: p.WorkingSet64 / MB, private_mb: p.PrivateMemorySize64 / MB,
      cpu_seconds: p.CPU ?? null,
    }));
  } else {
    const out = await run('ps', ['-eo', 'pid=,rss=,time=,comm=']);
    rows = out.split('\n').map((l) => l.trim().split(/\s+/)).filter((c) => /node|sqlservr|python|ollama/.test(c[3] || ''))
      .map((c) => ({
        pid: Number(c[0]), name: c[3], memory_mb: Number(c[1]) / 1024, private_mb: null,
        cpu_seconds: c[2].split(/[:-]/).reduce((a, b) => a * 60 + Number(b), 0),
      }));
  }
  const now = Date.now();
  const elapsed = lastProcAt ? (now - lastProcAt) / 1000 : 0;
  const next = new Map();
  for (const p of rows) {
    const before = lastProcCpu.get(p.pid);
    p.cpu_pct = elapsed && before !== undefined && p.cpu_seconds !== null
      ? Math.max(0, 100 * (p.cpu_seconds - before) / elapsed / os.cpus().length) : null;
    if (p.cpu_seconds !== null) next.set(p.pid, p.cpu_seconds);
    p.is_gateway = p.pid === process.pid;
  }
  lastProcCpu = next;
  lastProcAt = now;
  return rows.sort((a, b) => b.memory_mb - a.memory_mb);
});

const disk = cached(10000, async () => {
  const s = await fs.promises.statfs(ROOT);
  const total = (s.blocks * s.bsize) / GB;
  const free = (s.bavail * s.bsize) / GB;
  return { total_gb: total, free_gb: free, used_gb: total - free, used_pct: total ? 100 * (total - free) / total : null };
});

async function folderSize(dir) {
  let bytes = 0;
  let files = 0;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    const items = await fs.promises.readdir(current, { withFileTypes: true }).catch(() => []);
    for (const item of items) {
      const full = path.join(current, item.name);
      if (item.isDirectory()) stack.push(full);
      else if (item.isFile()) {
        const st = await fs.promises.stat(full).catch(() => null);
        if (st) { bytes += st.size; files++; }
      }
    }
  }
  return { files, mb: bytes / MB };
}

const folders = cached(60000, async () => {
  const uploads = path.join(ROOT, 'uploads');
  const subs = await fs.promises.readdir(uploads, { withFileTypes: true }).catch(() => []);
  const targets = [
    ...subs.filter((d) => d.isDirectory()).map((d) => [`uploads/${d.name}`, path.join(uploads, d.name)]),
    ['logs', path.join(ROOT, 'logs')],
    ['public (giao diện)', path.join(ROOT, 'public')],
  ];
  const out = [];
  for (const [name, dir] of targets) out.push({ name, ...(await folderSize(dir)) });
  return out;
});

function databaseReader(getPool) {
  return cached(60000, async () => {
    const pool = await getPool();
    const files = await pool.request().query(
      `SELECT type_desc AS type, CAST(SUM(CAST(size AS BIGINT)) * 8.0 / 1024 AS FLOAT) AS mb
       FROM sys.database_files GROUP BY type_desc`);
    let connections = null;
    try {
      const c = await pool.request().query('SELECT COUNT(*) AS n FROM sys.dm_exec_sessions WHERE database_id = DB_ID()');
      connections = c.recordset[0].n;
    } catch { /* tài khoản SQL không có quyền xem phiên */ }
    return { files: files.recordset, connections };
  });
}

const tcpCheck = (url) => new Promise((resolve) => {
  let u;
  try { u = new URL(url); } catch { resolve({ up: false, ms: null }); return; }
  const t0 = process.hrtime.bigint();
  const socket = net.connect({ host: u.hostname, port: Number(u.port) || (u.protocol === 'https:' ? 443 : 80) });
  const finish = (up) => { socket.destroy(); resolve({ up, ms: up ? Number(process.hrtime.bigint() - t0) / 1e6 : null }); };
  socket.setTimeout(1000, () => finish(false));
  socket.once('connect', () => finish(true));
  socket.once('error', () => finish(false));
});

function serviceReader(getPool) {
  return cached(5000, async () => {
    const list = [
      ['Trợ lý AI', process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001'],
      ['OCR', process.env.OCR_SERVICE_URL || 'http://127.0.0.1:8002'],
      ['Ollama', process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'],
    ];
    const out = await Promise.all(list.map(async ([name, url]) => ({ name, address: new URL(url).host, ...(await tcpCheck(url)) })));
    const t0 = process.hrtime.bigint();
    try {
      const pool = await getPool();
      await pool.request().query('SELECT 1 AS ok');
      out.unshift({ name: 'CSDL SQL Server', address: '(truy vấn thử)', up: true, ms: Number(process.hrtime.bigint() - t0) / 1e6 });
    } catch {
      out.unshift({ name: 'CSDL SQL Server', address: '(truy vấn thử)', up: false, ms: null });
    }
    return out;
  });
}

const gpu = cached(10000, async () => {
  try {
    const out = await run('nvidia-smi', ['--query-gpu=name,utilization.gpu,memory.used,memory.total', '--format=csv,noheader,nounits']);
    return out.trim().split('\n').filter(Boolean).map((line) => {
      const [name, util, used, total] = line.split(',').map((s) => s.trim());
      return { name, util_pct: Number(util), memory_used_mb: Number(used), memory_total_mb: Number(total) };
    });
  } catch {
    return []; // máy chủ không có GPU NVIDIA hoặc không có nvidia-smi
  }
});

function createReporter(getPool) {
  const database = databaseReader(getPool);
  const services = serviceReader(getPool);
  return async function report() {
    const [p, d, f, db, s, g] = await Promise.all([processes(), disk(), folders(), database(), services(), gpu()]);
    return {
      at: Date.now(),
      sample_ms: SAMPLE_MS,
      host: {
        name: os.hostname(), platform: `${os.type()} ${os.release()}`, cpu_model: os.cpus()[0]?.model?.trim(),
        cpu_count: os.cpus().length, mem_total_mb: os.totalmem() / MB, uptime_s: os.uptime(),
      },
      node: { pid: process.pid, version: process.version, uptime_s: process.uptime() },
      current: history[history.length - 1] || takeSample(),
      history: history.slice(-150),
      processes: p, disk: d, folders: f, database: db, services: s, gpu: g,
    };
  };
}

module.exports = { start, createReporter };
