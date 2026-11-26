/**
 * Dấu vết từng bước của mỗi tác vụ trên máy chủ (giữ trong bộ nhớ, không ghi đĩa).
 *
 * Mỗi request /api tạo một "trace"; mỗi việc bên trong là một "step": lớp trung gian, xử lý nghiệp vụ,
 * truy vấn SQL, gọi dịch vụ ngoài, đọc/ghi tệp, băm dữ liệu, kiểm tra mật khẩu, bước đo thủ công (step()).
 * Việc chạy ngoài request (tác vụ nền) được gom vào danh sách "nền".
 *
 * Tài nguyên của bước:
 *   ms       — thời gian thực (đồng hồ)
 *   cpu_ms   — CPU của CẢ tiến trình Node trong lúc bước chạy (nhiều request cùng lúc thì có phần của nhau)
 *   rss_mb / heap_mb — thay đổi bộ nhớ của tiến trình giữa đầu và cuối bước
 *
 * Nạp file này không làm thay đổi gì; chỉ install() (do perf-timing gọi) mới gắn đo vào thư viện.
 * Cấu hình (.env): PERF_TRACE=false tắt đo từng bước · PERF_TRACE_KEEP=600 số tác vụ giữ lại
 */
'use strict';
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');

const ENABLED = process.env.PERF_TIMING !== 'false' && process.env.PERF_TRACE !== 'false';
const MAX_TRACES = Math.max(50, Number(process.env.PERF_TRACE_KEEP) || 600);
const MAX_STEPS = 400; // mỗi trace
const MAX_BACKGROUND = 500;
const MAX_STEP_NAMES = 600;
const SAMPLES = 200; // vòng mẫu để tính p95
const ROOT = path.join(__dirname, '..');
const MB = 1048576;

const context = new AsyncLocalStorage();
const traces = [];
const byId = new Map();
const background = [];
const stepStats = new Map();
let seq = 0;
let bgSeq = 0;
let activeCount = 0;
const bootId = Date.now().toString(36);

const clock = () => process.hrtime.bigint();
const msBetween = (a, b) => Number(b - a) / 1e6;

function snapshot() {
  const c = process.cpuUsage();
  const m = process.memoryUsage();
  return { t: clock(), cpu: c.user + c.system, rss: m.rss, heap: m.heapUsed };
}

function p95(ring) {
  if (!ring.length) return 0;
  const a = [...ring].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(a.length * 0.95))];
}

function addStat(type, name, ms, cpuMs) {
  let key = `${type}|${name}`;
  let s = stepStats.get(key);
  if (!s) {
    if (stepStats.size >= MAX_STEP_NAMES) { key = `${type}|(khác)`; name = '(khác)'; }
    s = stepStats.get(key) || { type, name, count: 0, total: 0, max: 0, cpu: 0, ring: [], i: 0 };
    stepStats.set(key, s);
  }
  s.count++;
  s.total += ms;
  s.cpu += cpuMs || 0;
  if (ms > s.max) s.max = ms;
  if (s.ring.length < SAMPLES) s.ring.push(ms);
  else { s.ring[s.i] = ms; s.i = (s.i + 1) % SAMPLES; }
}

function pushStep(trace, step) {
  addStat(step.type, step.name, step.ms, step.cpu_ms);
  if (!trace) {
    background.push({ seq: ++bgSeq, at: Date.now() - Math.round(step.ms), ...step });
    if (background.length > MAX_BACKGROUND) background.shift();
    return;
  }
  if (trace.steps.length >= MAX_STEPS) { trace.dropped_steps = (trace.dropped_steps || 0) + 1; return; }
  if (trace.finished) step.after_response = true; // chạy tiếp sau khi đã trả lời máy con
  step.n = trace.steps.length + 1;
  trace.steps.push(step);
}

const NOOP = () => {};

/** Bắt đầu một bước; gọi hàm trả về để kết thúc (có thể kèm giá trị). */
function startStep(type, name, values, trace = context.getStore()) {
  if (!ENABLED || trace?.ignore) return NOOP;
  const a = snapshot();
  let done = false;
  return (extra) => {
    if (done) return;
    done = true;
    const b = snapshot();
    pushStep(trace, {
      type,
      name,
      start_ms: trace ? msBetween(trace.t0, a.t) : null,
      ms: msBetween(a.t, b.t),
      cpu_ms: (b.cpu - a.cpu) / 1000,
      rss_mb: (b.rss - a.rss) / MB,
      heap_mb: (b.heap - a.heap) / MB,
      values: { ...values, ...extra },
    });
  };
}

/** Đo một đoạn xử lý (đồng bộ hoặc Promise). values(result) trả về các giá trị cần ghi. */
function step(name, fn, values) {
  const end = startStep('process', name);
  const ok = (result) => { end(values ? values(result) : undefined); return result; };
  const fail = (e) => { end({ 'Lỗi': String(e?.message || e).slice(0, 200) }); throw e; };
  let out;
  try { out = fn(); } catch (e) { return fail(e); }
  return out && typeof out.then === 'function' ? out.then(ok, fail) : ok(out);
}

// ───────────────────────── Vòng đời trace ─────────────────────────
function startTrace({ method, path: url, ignore }) {
  if (ignore || !ENABLED) return { ignore: true, id: null, steps: [], pending: new Set(), dbMs: 0, dbN: 0, extMs: 0, label: `${method} ${url}` };
  activeCount++;
  const a = snapshot();
  seq++;
  const trace = {
    id: `${bootId}-${seq}`, seq, at: Date.now(), method, path: url, route: null, status: null, user: null,
    t0: a.t, start: a, finished: false, steps: [], pending: new Set(),
    dbMs: 0, dbN: 0, extMs: 0, label: `${method} ${url}`, concurrent: activeCount,
  };
  traces.push(trace);
  byId.set(trace.id, trace);
  if (traces.length > MAX_TRACES) byId.delete(traces.shift().id);
  return trace;
}

function finishTrace(trace, info) {
  if (!trace || trace.ignore || trace.finished) return;
  activeCount = Math.max(0, activeCount - 1);
  const b = snapshot();
  Object.assign(trace, info, {
    cpu_ms: (b.cpu - trace.start.cpu) / 1000,
    rss_mb: (b.rss - trace.start.rss) / MB,
    heap_mb: (b.heap - trace.start.heap) / MB,
    finished: true,
  });
}

const summary = (t) => ({
  id: t.id, seq: t.seq, at: t.at, method: t.method, path: t.path, route: t.route, status: t.status, user: t.user,
  finished: t.finished, aborted: t.aborted, concurrent: t.concurrent,
  ms: t.finished ? t.ms : msBetween(t.t0, clock()), ttfb_ms: t.ttfb_ms,
  cpu_ms: t.cpu_ms, rss_mb: t.rss_mb, heap_mb: t.heap_mb,
  db_ms: t.dbMs, db_n: t.dbN, ext_ms: t.extMs, in_kb: t.in_kb, out_kb: t.out_kb,
  step_count: t.steps.length, dropped_steps: t.dropped_steps || 0,
});

function list({ limit = 200, full = false } = {}) {
  const n = Math.min(Math.max(1, Number(limit) || 200), MAX_TRACES);
  return traces.slice(-n).reverse().map((t) => (full ? { ...summary(t), steps: t.steps } : summary(t)));
}

function get(id) {
  const t = byId.get(String(id));
  return t ? { ...summary(t), steps: t.steps } : null;
}

const listBackground = (limit = 200) => background.slice(-Math.min(limit, MAX_BACKGROUND)).reverse();

function stepSummary() {
  return [...stepStats.values()].map((s) => ({
    type: s.type, name: s.name, count: s.count,
    total_ms: s.total, avg_ms: s.total / s.count, p95_ms: p95(s.ring), max_ms: s.max,
    cpu_ms: s.cpu, avg_cpu_ms: s.cpu / s.count,
  }));
}

// ───────────────────────── Gắn đo vào Express ─────────────────────────
// Tên hiển thị theo tên hàm (hàm của thư viện hoặc hàm đã đặt tên trong mã dự án)
const LAYER_NAMES = {
  securityHeaders: 'Gắn tiêu đề bảo mật',
  compression: 'Thiết lập nén phản hồi',
  corsMiddleware: 'Kiểm tra CORS',
  jsonParser: 'Đọc dữ liệu JSON gửi lên',
  chuanHoaPhanHoi: 'Chuẩn hóa kiểu nội dung phản hồi',
  phatTepNenSan: 'Tìm tệp nén sẵn',
  serveStatic: 'Tìm tệp tĩnh',
  xacThucPhien: 'Xác thực phiên đăng nhập',
  protectedAdminGuard: 'Bảo vệ tài khoản Quản trị tối cao',
  approvalInterceptor: 'Kiểm tra quyền bị khóa duyệt',
  requireAuth: 'Kiểm tra đã đăng nhập',
  validateUploadedPdf: 'Kiểm tra tệp PDF tải lên',
  multerMiddleware: 'Nhận tệp tải lên',
  perfTimingMiddleware: 'Khởi tạo đo hiệu năng',
};

function layerLabel(layer, req) {
  const fn = layer.handle;
  if (fn.perfName) return { type: 'middleware', name: fn.perfName };
  const stack = req.route?.stack;
  if (stack && stack[stack.length - 1] === layer) {
    const pattern = typeof req.route.path === 'string' ? req.route.path : '(regex)';
    return { type: 'handler', name: `Xử lý nghiệp vụ ${req.method} ${req.baseUrl || ''}${pattern}` };
  }
  if (LAYER_NAMES[fn.name]) return { type: 'middleware', name: LAYER_NAMES[fn.name] };
  // express-rate-limit trả về hàm tên "middleware"
  if (fn.name === 'middleware') return { type: 'middleware', name: 'Giới hạn tần suất truy cập' };
  return { type: 'middleware', name: fn.name ? `Lớp xử lý ${fn.name}` : `Lớp xử lý không tên (${req.baseUrl || '/'})` };
}

function instrumentExpress() {
  const expressDir = path.dirname(require.resolve('express'));
  const Layer = require(require.resolve('router/lib/layer', { paths: [expressDir] }));
  const handleRequest = Layer.prototype.handleRequest;
  const handleError = Layer.prototype.handleError;

  const traced = (layer, req, res, next, label, invoke) => {
    const trace = req.__perf;
    const end = startStep(label.type, label.name, undefined, trace);
    let ended = false;
    const finish = (extra) => {
      if (ended) return;
      ended = true;
      trace.pending.delete(finish);
      end(extra);
    };
    trace.pending.add(finish); // perf-timing kết thúc các bước còn mở khi phản hồi đóng
    const done = (err) => {
      finish(err && err !== 'route' && err !== 'router'
        ? { 'Lỗi': String(err.message || err).slice(0, 200) } : undefined);
      return next(err);
    };
    return context.run(trace, () => invoke(done));
  };

  Layer.prototype.handleRequest = function tracedRequest(req, res, next) {
    const trace = req.__perf;
    const fn = this.handle;
    if (!trace || trace.ignore || fn.length > 3) return handleRequest.call(this, req, res, next);
    // Route và router lồng nhau: chỉ đo từng bước bên trong
    if (this.route || fn.stack || this.name === 'router' || fn.name === 'router') {
      return context.run(trace, () => handleRequest.call(this, req, res, next));
    }
    return traced(this, req, res, next, layerLabel(this, req), (done) => handleRequest.call(this, req, res, done));
  };

  Layer.prototype.handleError = function tracedError(error, req, res, next) {
    const trace = req.__perf;
    if (!trace || trace.ignore || this.handle.length !== 4) return handleError.call(this, error, req, res, next);
    const label = { type: 'middleware', name: 'Xử lý lỗi' };
    return traced(this, req, res, next, label, (done) => handleError.call(this, error, req, res, done));
  };
}

// ───────────────────────── Gắn đo vào tệp, mã băm, mật khẩu ─────────────────────────
const shortPath = (p) => {
  if (typeof p !== 'string' && !Buffer.isBuffer(p) && !(p instanceof URL)) return '(bộ mô tả tệp)';
  const s = p instanceof URL ? p.pathname : String(p);
  const rel = path.relative(ROOT, s);
  return rel.startsWith('..') || path.isAbsolute(rel) ? path.basename(s) : rel.replace(/\\/g, '/');
};
const sizeOf = (d) => (typeof d === 'string' ? Buffer.byteLength(d) : d?.byteLength ?? null);
// Chỉ đo thao tác nằm trong một request; bỏ việc nạp thư viện
const traceForFile = (p) => {
  const t = context.getStore();
  if (!t || t.ignore || (typeof p === 'string' && p.includes('node_modules'))) return null;
  return t;
};
const fileValues = (p, extra, bytes) => ({
  'Tệp': shortPath(p), ...extra, ...(bytes === null || bytes === undefined ? {} : { 'KB': bytes / 1024 }),
});

function instrumentFs() {
  const fs = require('fs');
  const OPS = {
    readFile: 'Đọc tệp', writeFile: 'Ghi tệp', appendFile: 'Ghi nối tệp', unlink: 'Xóa tệp',
    rename: 'Di chuyển tệp', copyFile: 'Chép tệp', rm: 'Xóa tệp/thư mục', readdir: 'Liệt kê thư mục',
  };
  const bytesOf = (op, args, result) => {
    if (op === 'readFile') return sizeOf(result);
    if (op === 'writeFile' || op === 'appendFile') return sizeOf(args[1]);
    return null;
  };
  const target = (op, args) => ((op === 'rename' || op === 'copyFile') ? { 'Đích': shortPath(args[1]) } : {});

  for (const [op, label] of Object.entries(OPS)) {
    const syncName = `${op}Sync`;
    const sync = fs[syncName];
    if (typeof sync === 'function') {
      fs[syncName] = function tracedSync(...args) {
        const t = traceForFile(args[0]);
        if (!t) return sync.apply(this, args);
        const end = startStep('file', label, undefined, t);
        try {
          const result = sync.apply(this, args);
          end(fileValues(args[0], target(op, args), bytesOf(op, args, result)));
          return result;
        } catch (e) {
          end(fileValues(args[0], { 'Lỗi': e.code || e.message }));
          throw e;
        }
      };
    }
    const promised = fs.promises[op];
    if (typeof promised === 'function') {
      fs.promises[op] = function tracedPromise(...args) {
        const t = traceForFile(args[0]);
        if (!t) return promised.apply(this, args);
        const end = startStep('file', label, undefined, t);
        return promised.apply(this, args).then(
          (result) => { end(fileValues(args[0], target(op, args), bytesOf(op, args, result))); return result; },
          (e) => { end(fileValues(args[0], { 'Lỗi': e.code || e.message })); throw e; },
        );
      };
    }
  }

  for (const [name, label, counter] of [
    ['createReadStream', 'Đọc tệp theo luồng', 'bytesRead'],
    ['createWriteStream', 'Ghi tệp theo luồng', 'bytesWritten'],
  ]) {
    const original = fs[name];
    fs[name] = function tracedStream(...args) {
      const stream = original.apply(this, args);
      const t = traceForFile(args[0]);
      if (t) {
        const end = startStep('file', label, undefined, t);
        stream.once('close', () => end(fileValues(args[0], {}, stream[counter])));
      }
      return stream;
    };
  }
}

function instrumentCrypto() {
  const crypto = require('crypto');
  const original = crypto.createHash;
  crypto.createHash = function tracedHash(...args) {
    const hash = original.apply(this, args);
    const t = context.getStore();
    if (!t || t.ignore) return hash;
    const { update, digest } = hash;
    let bytes = 0;
    let spent = 0n;
    let first = null;
    hash.update = function timedUpdate(data, ...rest) {
      const a = clock();
      if (first === null) first = a;
      update.call(this, data, ...rest);
      spent += clock() - a;
      bytes += sizeOf(data) || 0;
      return this;
    };
    hash.digest = function timedDigest(...rest) {
      const a = clock();
      const out = digest.apply(this, rest);
      spent += clock() - a;
      const ms = Number(spent) / 1e6;
      pushStep(t, {
        type: 'cpu', name: `Băm dữ liệu ${args[0]}`, start_ms: msBetween(t.t0, first ?? a),
        ms, cpu_ms: null, rss_mb: null, heap_mb: null, values: { 'KB': bytes / 1024 },
      });
      return out;
    };
    return hash;
  };
}

function instrumentBcrypt() {
  let lib;
  try { lib = require('./bcrypt-lib'); } catch { return; }
  const NAMES = { compare: 'Kiểm tra mật khẩu', compareSync: 'Kiểm tra mật khẩu', hash: 'Mã hóa mật khẩu', hashSync: 'Mã hóa mật khẩu' };
  for (const [method, label] of Object.entries(NAMES)) {
    const original = lib[method];
    if (typeof original !== 'function') continue;
    lib[method] = function tracedBcrypt(...args) {
      const t = context.getStore();
      if (!t || t.ignore || typeof args[args.length - 1] === 'function') return original.apply(this, args);
      const end = startStep('cpu', label, undefined, t); // không ghi mật khẩu hay mã băm
      let out;
      try { out = original.apply(this, args); } catch (e) { end(); throw e; }
      if (out && typeof out.then === 'function') return out.finally(() => end());
      end();
      return out;
    };
  }
}

let installed = false;
function install() {
  if (installed || !ENABLED) return;
  installed = true;
  for (const fn of [instrumentExpress, instrumentFs, instrumentCrypto, instrumentBcrypt]) {
    try { fn(); } catch (e) { console.warn(`[PERF] Không gắn được đo (${fn.name}):`, e.message); }
  }
}

module.exports = {
  ENABLED, context, install, step, startStep, startTrace, finishTrace,
  list, get, listBackground, stepSummary,
  activeCount: () => activeCount,
};
