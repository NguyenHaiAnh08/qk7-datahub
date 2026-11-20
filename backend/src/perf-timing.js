/**
 * Đo thời gian xử lý API (chỉ trong bộ nhớ, không ghi DB, không gửi ra client).
 *  - Nhóm theo "METHOD /đường-dẫn-mẫu" (vd GET /api/documents/:id) nên không phình bộ nhớ.
 *  - Ghi log dòng [SLOW] khi một request vượt PERF_SLOW_MS (mặc định 1000ms).
 *  - Mỗi PERF_SUMMARY_MINUTES phút (mặc định 10; 0 = tắt) in 10 API chậm nhất.
 *  - Tắt hẳn bằng PERF_TIMING=false.
 *  - Xem số liệu: GET /api/admin/perf (chỉ ROL-01) ; ?reset=1 để xoá số liệu.
 */
const SLOW_MS = Number(process.env.PERF_SLOW_MS || 1000);
const SUMMARY_MIN = Number(process.env.PERF_SUMMARY_MINUTES ?? 10);
const MAX_ROUTES = 500;
const SAMPLES = 200; // vòng mẫu để tính p95

const stats = new Map();
let since = Date.now();

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

function middleware() {
  if (process.env.PERF_TIMING === 'false') return (req, res, next) => next();
  return (req, res, next) => {
    if (!req.originalUrl.startsWith('/api')) return next(); // bỏ qua file tĩnh
    const t0 = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      // req.route.path chỉ có khi khớp route; ghép với baseUrl của router con
      const pattern = req.route?.path
        ? `${req.baseUrl || ''}${typeof req.route.path === 'string' ? req.route.path : '(regex)'}`
        : '(no-route)';
      record(`${req.method} ${pattern}`, ms, res.statusCode);
      if (ms >= SLOW_MS) {
        console.warn(`[SLOW] ${req.method} ${pattern} ${Math.round(ms)}ms status=${res.statusCode}`);
      }
    });
    next();
  };
}

function startSummary() {
  if (process.env.PERF_TIMING === 'false' || !SUMMARY_MIN) return;
  const t = setInterval(() => {
    const top = snapshot().sort((a, b) => b.total_ms - a.total_ms).slice(0, 10);
    if (!top.length) return;
    console.log(`[PERF] Top 10 API theo tổng thời gian (từ ${new Date(since).toLocaleTimeString()}):`);
    top.forEach(r => console.log(
      `  ${String(r.count).padStart(6)}x avg=${r.avg_ms}ms p95=${r.p95_ms}ms max=${r.max_ms}ms  ${r.route}`));
  }, SUMMARY_MIN * 60 * 1000);
  t.unref();
}

function reportHandler(req, res) {
  if (!(req.user?.roles || []).includes('ROL-01')) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên tối cao (ROL-01) được xem số liệu hiệu năng.' });
  }
  const data = snapshot().sort((a, b) => b.total_ms - a.total_ms);
  const out = { since: new Date(since).toISOString(), slow_threshold_ms: SLOW_MS, routes: data };
  if (req.query.reset === '1') { stats.clear(); since = Date.now(); }
  res.json(out);
}

module.exports = { middleware, startSummary, reportHandler };
