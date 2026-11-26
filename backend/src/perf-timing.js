/**
 * Đo thời gian phản hồi để tìm tác vụ nặng / tốn thời gian.
 *
 * Ghi ra file backend/logs/perf-YYYY-MM-DD.log (mỗi dòng 1 JSON):
 *   req   — mọi request /api (và file tĩnh chậm ≥ 200ms): tổng ms, ms đến byte đầu, thời gian + số lệnh SQL,
 *           thời gian gọi dịch vụ ngoài (AI/OCR), dung lượng vào/ra, user, bị ngắt giữa chừng hay không
 *   sql   — từng truy vấn SQL ≥ PERF_SQL_SLOW_MS (chỉ câu lệnh, đã che chuỗi hằng; KHÔNG ghi tham số)
 *   ext   — mọi lời gọi HTTP ra dịch vụ ngoài bằng fetch (không ghi query string)
 *   stall — Node bị nghẽn (event loop đứng ≥ PERF_STALL_MS) kèm các request đang chạy lúc đó
 * Tổng hợp báo cáo:  node scripts/perf-report.js   (hoặc scripts\perf-report.bat)
 *
 * Cấu hình (.env): PERF_TIMING=false tắt hẳn · PERF_LOG=false chỉ tắt ghi file ·
 *   PERF_SLOW_MS=1000 · PERF_SQL_SLOW_MS=100 · PERF_STALL_MS=200 · PERF_SUMMARY_MINUTES=10 (0 = tắt)
 * Xem số liệu trong bộ nhớ: GET /api/admin/perf (chỉ ROL-01) ; ?reset=1 để xoá số liệu.
 * Dấu vết từng bước của mỗi request (perf-trace.js) và tài nguyên máy chủ (perf-system.js), chỉ ROL-01:
 *   GET /api/admin/perf/traces · /traces/:id · /steps · /background · /system
 *   Phản hồi mỗi request mang tiêu đề X-Perf-Id để máy con ghép với bước đo trên máy chủ.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const { monitorEventLoopDelay } = require('perf_hooks');
const perfTrace = require('./perf-trace');
const perfSystem = require('./perf-system');

const ENABLED = process.env.PERF_TIMING !== 'false';
const FILE_LOG = ENABLED && process.env.PERF_LOG !== 'false';
const SLOW_MS = Number(process.env.PERF_SLOW_MS || 1000);
const SQL_SLOW_MS = Number(process.env.PERF_SQL_SLOW_MS || 100);
const STALL_MS = Number(process.env.PERF_STALL_MS || 200);
const STATIC_MIN_MS = 200;
const SUMMARY_MIN = Number(process.env.PERF_SUMMARY_MINUTES ?? 10);
const MAX_ROUTES = 500;
const SAMPLES = 200; // vòng mẫu để tính p95
const LOG_DIR = path.join(__dirname, '..', 'logs');
const MAX_FILE_BYTES = 100 * 1024 * 1024; // chặn đầy đĩa

const stats = new Map();
let since = Date.now();
const { context } = perfTrace;
const active = new Set();

// ───────────────────────── Ghi file ─────────────────────────
const pad = (n) => String(n).padStart(2, '0');
const localDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d) => `${localDay(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;

let stream = null;
let streamDay = '';
let written = 0;

function writeLog(entry) {
  if (!FILE_LOG) return;
  try {
    const now = new Date();
    const day = localDay(now);
    if (day !== streamDay) {
      stream?.end();
      fs.mkdirSync(LOG_DIR, { recursive: true });
      const file = path.join(LOG_DIR, `perf-${day}.log`);
      written = fs.existsSync(file) ? fs.statSync(file).size : 0;
      stream = fs.createWriteStream(file, { flags: 'a' });
      stream.on('error', (e) => console.warn('[PERF] Không ghi được file log:', e.message));
      streamDay = day;
    }
    if (written >= MAX_FILE_BYTES) return;
    const line = `${JSON.stringify({ t: localTime(now), ...entry })}\n`;
    written += Buffer.byteLength(line);
    stream.write(line);
  } catch (e) {
    console.warn('[PERF] Lỗi ghi log:', e.message);
  }
}

const round = (n) => +n.toFixed(1);
const msSince = (t0) => Number(process.hrtime.bigint() - t0) / 1e6;
// Đường dẫn không khớp route → gom các đoạn có chữ số thành :id
const normalizePath = (p) => p.split('/').map((s) => (/\d/.test(s) ? ':id' : s)).join('/');

// ───────────────────────── SQL ─────────────────────────
// Tên bước ổn định để cộng dồn: "SQL SELECT DOCUMENT"
function sqlName(method, command) {
  if (method === 'bulk') return `SQL BULK ${command?.name || ''}`.trim();
  const text = cleanSql(command); // lấy cả câu: mệnh đề FROM có thể nằm sau danh sách cột dài
  const verb = /\b(SELECT|INSERT|UPDATE|DELETE|MERGE|EXEC)\b/i.exec(text)?.[1]?.toUpperCase() || 'KHÁC';
  const table = /\b(?:FROM|INTO|UPDATE|MERGE|EXEC)\s+([\[\]\w.]+)/i.exec(text)?.[1]?.replace(/[\[\]]/g, '');
  return `SQL ${verb}${table ? ` ${table}` : ''}`;
}

function cleanSql(command) {
  const text = Array.isArray(command) ? command.join('?') : String(command || '');
  return text
    .replace(/--[^\n]*/g, ' ')
    .replace(/'(?:[^']|'')*'/g, "'?'") // che chuỗi hằng (có thể chứa dữ liệu)
    .replace(/\s+/g, ' ')
    .trim();
}

const describeSql = (command) => cleanSql(command).slice(0, 400);

function instrumentSql() {
  const { Request } = require('mssql');
  for (const method of ['query', 'execute', 'batch', 'bulk']) {
    const original = Request.prototype[method];
    if (typeof original !== 'function') continue;
    Request.prototype[method] = function timed(...args) {
      const ctx = context.getStore();
      const t0 = process.hrtime.bigint();
      const endStep = perfTrace.startStep('sql', sqlName(method, args[0]));
      const params = Object.keys(this.parameters || {}).length; // chỉ đếm, không ghi giá trị
      const done = (err, result) => {
        const ms = msSince(t0);
        if (ctx) { ctx.dbMs += ms; ctx.dbN += 1; }
        endStep({
          'Số dòng trả về': result?.recordset?.length ?? 0,
          'Số dòng bị tác động': (result?.rowsAffected || []).reduce((a, b) => a + b, 0),
          'Số tham số': params,
          'Câu lệnh': method === 'bulk' ? `BULK ${args[0]?.name || ''}` : describeSql(args[0]),
          ...(err ? { 'Lỗi': String(err.message).slice(0, 200) } : {}),
        });
        if (ms >= SQL_SLOW_MS || err) {
          writeLog({
            type: 'sql', ms: round(ms),
            rows: result?.recordset?.length,
            route: ctx?.label || '(nền)',
            sql: method === 'bulk' ? `BULK ${args[0]?.name || ''}` : describeSql(args[0]),
            error: err ? String(err.message).slice(0, 200) : undefined,
          });
        }
      };
      const last = args[args.length - 1];
      if (typeof last === 'function') {
        args[args.length - 1] = function onDone(err, result) { done(err, result); return last.apply(this, arguments); };
        return original.apply(this, args);
      }
      const out = original.apply(this, args);
      if (out && typeof out.then === 'function') {
        return out.then(
          (result) => { done(null, result); return result; },
          (err) => { done(err); throw err; },
        );
      }
      return out;
    };
  }
}

// ───────────────────────── Dịch vụ ngoài (fetch) ─────────────────────────
function instrumentFetch() {
  const original = globalThis.fetch;
  if (typeof original !== 'function') return;
  globalThis.fetch = async function timedFetch(input, init) {
    const ctx = context.getStore();
    const t0 = process.hrtime.bigint();
    let target = '?';
    let host = '?';
    try { const u = new URL(input?.url || String(input)); target = u.host + u.pathname; host = u.host; } catch (_) {}
    const endStep = perfTrace.startStep('external', `Gọi dịch vụ ${host}`);
    const done = (status, error, bytes) => {
      const ms = msSince(t0);
      if (ctx) ctx.extMs += ms;
      endStep({
        'Địa chỉ': target, 'Mã trả về': status,
        ...(bytes ? { 'KB trả về': bytes / 1024 } : {}), ...(error ? { 'Lỗi': error } : {}),
      });
      writeLog({ type: 'ext', ms: round(ms), target, status, route: ctx?.label || '(nền)', error });
    };
    try {
      const res = await original.call(this, input, init);
      done(res.status, undefined, Number(res.headers.get('content-length') || 0));
      return res;
    } catch (e) {
      done(0, String(e.cause?.code || e.message).slice(0, 200));
      throw e;
    }
  };
}

// ───────────────────────── Node bị nghẽn ─────────────────────────
function watchEventLoop() {
  const h = monitorEventLoopDelay({ resolution: 20 });
  h.enable();
  setInterval(() => {
    const ms = h.max / 1e6;
    h.reset();
    if (ms >= STALL_MS) {
      writeLog({ type: 'stall', ms: round(ms), active: [...active].slice(0, 10).map((c) => c.label) });
    }
  }, 1000).unref();
}

if (ENABLED) {
  perfTrace.install();
  instrumentSql();
  instrumentFetch();
  watchEventLoop();
}

// ───────────────────────── Thống kê trong bộ nhớ ─────────────────────────
function record(key, ms, status) {
  let s = stats.get(key);
  if (!s) {
    if (stats.size >= MAX_ROUTES) key = 'OTHER';
    s = stats.get(key) || { count: 0, total: 0, max: 0, errors: 0, ring: [], i: 0 };
    stats.set(key, s);
  }
  s.count++;
  s.total += ms;
  if (ms > s.max) s.max = ms;
  if (status >= 500) s.errors++;
  if (s.ring.length < SAMPLES) s.ring.push(ms);
  else { s.ring[s.i] = ms; s.i = (s.i + 1) % SAMPLES; }
}

function p95(ring) {
  if (!ring.length) return 0;
  const a = [...ring].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(a.length * 0.95))];
}

function snapshot() {
  return [...stats.entries()].map(([route, s]) => ({
    route,
    count: s.count,
    avg_ms: +(s.total / s.count).toFixed(1),
    p95_ms: +p95(s.ring).toFixed(1),
    max_ms: +s.max.toFixed(1),
    total_ms: Math.round(s.total),
    errors_5xx: s.errors,
  }));
}

// ───────────────────────── Middleware ─────────────────────────
function middleware() {
  if (!ENABLED) return (req, res, next) => next();
  return function perfTimingMiddleware(req, res, next) {
    const url = req.originalUrl.split('?')[0];
    const isApi = url.startsWith('/api');
    const t0 = process.hrtime.bigint();
    // Không đo, không ghi log chính các API của bảng đo để số liệu không bị nhiễu
    const ofMonitor = url.startsWith('/api/admin/perf');
    const ctx = perfTrace.startTrace({ method: req.method, path: url, ignore: ofMonitor });
    ctx.label = `${req.method} ${normalizePath(url)}`;
    req.__perf = ctx;
    if (ctx.id) res.setHeader('X-Perf-Id', ctx.id);
    let sendStart = null;
    const readStart = req.socket?.bytesRead || 0;
    const writeStart = req.socket?.bytesWritten || 0;
    let ttfb = null;
    active.add(ctx);

    const writeHead = res.writeHead;
    res.writeHead = function timedWriteHead(...args) {
      if (ttfb === null) {
        ttfb = msSince(t0);
        sendStart = perfTrace.startStep('network', 'Gửi phản hồi về máy con', undefined, ctx);
      }
      return writeHead.apply(this, args);
    };

    // 'close' luôn chạy 1 lần cho cả request hoàn tất lẫn bị ngắt
    res.once('close', () => {
      active.delete(ctx);
      const ms = msSince(t0);
      const aborted = !res.writableFinished;
      // req.route.path chỉ có khi khớp route; ghép với baseUrl của router con
      const pattern = req.route?.path
        ? `${req.baseUrl || ''}${typeof req.route.path === 'string' ? req.route.path : '(regex)'}`
        : null;
      if (isApi && !ofMonitor) record(`${req.method} ${pattern || '(no-route)'}`, ms, res.statusCode);

      const inBytes = Number(req.headers['content-length'] || 0) || Math.max(0, (req.socket?.bytesRead || 0) - readStart);
      const outKb = Math.max(0, (req.socket?.bytesWritten || writeStart) - writeStart) / 1024;
      for (const finish of [...ctx.pending]) finish(); // các bước còn mở kết thúc cùng phản hồi
      sendStart?.({ 'Mã trả về': res.statusCode, 'KB gửi đi': outKb });
      perfTrace.finishTrace(ctx, {
        route: pattern ? `${req.method} ${pattern}` : ctx.label,
        status: res.statusCode, ms, ttfb_ms: ttfb, in_kb: inBytes / 1024, out_kb: outKb,
        user: req.user?.user_id || null, aborted: aborted || undefined,
      });

      if (!ofMonitor && (isApi || ms >= STATIC_MIN_MS)) {
        writeLog({
          type: 'req',
          route: pattern ? `${req.method} ${pattern}` : ctx.label,
          path: url,
          status: res.statusCode,
          ms: round(ms),
          ttfb_ms: ttfb === null ? undefined : round(ttfb),
          db_ms: round(ctx.dbMs),
          db_n: ctx.dbN,
          ext_ms: ctx.extMs ? round(ctx.extMs) : undefined,
          in_kb: round(inBytes / 1024),
          out_kb: round(outKb),
          user: req.user?.user_id,
          aborted: aborted || undefined,
        });
      }

      if (aborted) {
        // Chẩn đoán: request bị ngắt khi chưa trả lời xong (vd upload file lớn bị đứt giữa chừng)
        const got = req.socket?.bytesRead || 0;
        const total = Number(req.headers['content-length'] || 0);
        console.warn(
          `[ABORTED] ${req.method} ${url} sau ${Math.round(ms)}ms, ` +
          `nhận ${(got / 1048576).toFixed(1)}MB/${(total / 1048576).toFixed(1)}MB ` +
          `(req.complete=${req.complete}, ip=${req.ip})`
        );
      } else if (isApi && ms >= SLOW_MS) {
        console.warn(`[SLOW] ${req.method} ${pattern || ctx.label} ${Math.round(ms)}ms ` +
          `(SQL ${Math.round(ctx.dbMs)}ms/${ctx.dbN} lệnh) status=${res.statusCode}`);
      }
    });
    context.run(ctx, next);
  };
}

function startSummary() {
  if (!ENABLED) return;
  if (FILE_LOG) console.log(`[PERF] Ghi log hiệu năng vào ${LOG_DIR} (báo cáo: node scripts/perf-report.js)`);
  if (!SUMMARY_MIN) return;
  const t = setInterval(() => {
    const top = snapshot().sort((a, b) => b.total_ms - a.total_ms).slice(0, 10);
    if (!top.length) return;
    console.log(`[PERF] Top 10 API theo tổng thời gian (từ ${new Date(since).toLocaleTimeString()}):`);
    top.forEach(r => console.log(
      `  ${String(r.count).padStart(6)}x avg=${r.avg_ms}ms p95=${r.p95_ms}ms max=${r.max_ms}ms  ${r.route}`));
  }, SUMMARY_MIN * 60 * 1000);
  t.unref();
}

const isPerfAdmin = (req) => (req.user?.roles || []).includes('ROL-01');
const PERF_DENIED = { error: 'Chỉ Quản trị viên tối cao (ROL-01) được xem số liệu hiệu năng.' };

function reportHandler(req, res) {
  if (!isPerfAdmin(req)) {
    return res.status(403).json(PERF_DENIED);
  }
  const data = snapshot().sort((a, b) => b.total_ms - a.total_ms);
  const out = { since: new Date(since).toISOString(), slow_threshold_ms: SLOW_MS, routes: data };
  if (req.query.reset === '1') { stats.clear(); since = Date.now(); }
  res.json(out);
}

/** Các API của bảng đo hiệu năng (chỉ đọc). Gắn tại /api/admin/perf, sau requireAuth. */
function monitorRouter(getPool) {
  if (ENABLED) perfSystem.start(getPool);
  const report = perfSystem.createReporter(getPool);
  const router = express.Router();
  const guard = (req, res, next) => (isPerfAdmin(req) ? next() : res.status(403).json(PERF_DENIED));
  router.get('/traces', guard, (req, res) => res.json({
    enabled: perfTrace.ENABLED,
    traces: perfTrace.list({ limit: req.query.limit, full: req.query.full === '1' }),
  }));
  router.get('/traces/:id', guard, (req, res) => {
    const trace = perfTrace.get(req.params.id);
    if (!trace) return res.status(404).json({ error: 'Không còn dấu vết của tác vụ này (máy chủ chỉ giữ số lượng gần nhất)' });
    res.json(trace);
  });
  router.get('/steps', guard, (req, res) => res.json({ enabled: perfTrace.ENABLED, steps: perfTrace.stepSummary() }));
  router.get('/background', guard, (req, res) => res.json({ items: perfTrace.listBackground(Number(req.query.limit) || 200) }));
  router.get('/system', guard, async (req, res) => {
    try { res.json(await report()); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  return router;
}

module.exports = { middleware, startSummary, reportHandler, monitorRouter };
