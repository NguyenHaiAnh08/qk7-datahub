// scripts/perf-report.js — Tổng hợp backend/logs/perf-*.log để tìm tác vụ nặng
// Dùng:  node scripts/perf-report.js                 (log hôm nay)
//        node scripts/perf-report.js 2026-11-25      (một ngày)
//        node scripts/perf-report.js all             (mọi ngày)
//        node scripts/perf-report.js --since 14:30   (từ giờ này trong ngày được chọn)
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'backend', 'logs');
const args = process.argv.slice(2);
const sinceAt = args.indexOf('--since');
const since = sinceAt >= 0 ? args.splice(sinceAt, 2)[1] : null;
const d = new Date();
const pad = (n) => String(n).padStart(2, '0');
const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const day = args[0] || today;

const files = fs.existsSync(LOG_DIR)
  ? fs.readdirSync(LOG_DIR).filter((f) => /^perf-.*\.log$/.test(f) && (day === 'all' || f === `perf-${day}.log`)).sort()
  : [];
if (!files.length) {
  console.log(`Chưa có log cho "${day}" trong ${LOG_DIR}. Hãy khởi động backend và thao tác trên web trước.`);
  process.exit(0);
}

const rows = [];
for (const f of files) {
  for (const line of fs.readFileSync(path.join(LOG_DIR, f), 'utf8').split('\n')) {
    if (!line) continue;
    try {
      const r = JSON.parse(line);
      if (!since || r.t.slice(11) >= since) rows.push(r);
    } catch (_) { /* dòng ghi dở */ }
  }
}

const of = (type) => rows.filter((r) => r.type === type);
const sum = (a, k) => a.reduce((s, r) => s + (r[k] || 0), 0);
const pct = (values, p) => { const a = [...values].sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0; };
const n = (v) => Math.round(v);

function group(list, key) {
  const m = new Map();
  for (const r of list) {
    const k = key(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return [...m.entries()].map(([k, items]) => {
    const ms = items.map((x) => x.ms);
    return { key: k, items, count: items.length, total: sum(items, 'ms'), avg: sum(items, 'ms') / items.length, p95: pct(ms, 0.95), max: Math.max(...ms) };
  });
}

const out = [];
const print = (s = '') => out.push(s);
function table(title, head, lines) {
  print();
  print(`== ${title}`);
  if (!lines.length) { print('  (không có)'); return; }
  const all = [head, ...lines].map((l) => l.map(String));
  const width = head.map((_, i) => Math.max(...all.map((l) => l[i].length)));
  for (const l of all) {
    print('  ' + l.map((c, i) => (i === l.length - 1 ? c : c.padStart(width[i]))).join('  '));
  }
}

const reqs = of('req');
const finished = reqs.filter((r) => !r.aborted);
print(`BÁO CÁO HIỆU NĂNG — ${files.join(', ')}${since ? ` (từ ${since})` : ''}`);
print(`Request: ${reqs.length} | p50 ${n(pct(finished.map((r) => r.ms), 0.5))}ms | p95 ${n(pct(finished.map((r) => r.ms), 0.95))}ms | ≥1s: ${finished.filter((r) => r.ms >= 1000).length} | lỗi 5xx: ${reqs.filter((r) => r.status >= 500).length} | bị ngắt: ${reqs.filter((r) => r.aborted).length}`);

print('Ghi chú: "SQL ms" là tổng thời gian các lệnh SQL (chạy song song thì có thể lớn hơn thời gian request); thời gian đo tại máy chủ, chưa gồm vẽ giao diện trên trình duyệt.');

const routeRow = (g) => [g.count, n(g.avg), n(g.p95), n(g.max), n(g.total), n(sum(g.items, 'db_ms') / g.count), n(sum(g.items, 'db_n') / g.count), n(sum(g.items, 'out_kb') / g.count), g.key];
const HEAD = ['lần', 'TB ms', 'p95', 'max', 'tổng ms', 'SQL ms', 'số SQL', 'KB trả', 'API'];
const routes = group(finished, (r) => r.route);
table('1. API CHẬM NHẤT (theo p95) — người dùng cảm nhận chậm', HEAD, [...routes].sort((a, b) => b.p95 - a.p95).slice(0, 20).map(routeRow));
table('2. API TỐN TỔNG THỜI GIAN NHẤT — tối ưu ở đây lợi nhiều nhất', HEAD, [...routes].sort((a, b) => b.total - a.total).slice(0, 15).map(routeRow));
table('3. API CHẠY NHIỀU LỆNH SQL (nghi N+1)', HEAD,
  routes.filter((g) => sum(g.items, 'db_n') / g.count >= 10).sort((a, b) => sum(b.items, 'db_n') / b.count - sum(a.items, 'db_n') / a.count).slice(0, 10).map(routeRow));
table('4. 20 REQUEST ĐƠN LẺ CHẬM NHẤT', ['giờ', 'ms', 'SQL ms', 'ngoài ms', 'KB gửi', 'KB trả', 'mã', 'request'],
  [...finished].sort((a, b) => b.ms - a.ms).slice(0, 20).map((r) => [r.t.slice(11, 19), n(r.ms), n(r.db_ms), n(r.ext_ms || 0), n(r.in_kb), n(r.out_kb), r.status, `${r.route.split(' ')[0]} ${r.path}`]));
table('5. TRUY VẤN SQL CHẬM', ['lần', 'TB ms', 'max', 'tổng ms', 'API gọi | câu lệnh'],
  group(of('sql'), (r) => r.sql).sort((a, b) => b.total - a.total).slice(0, 15).map((g) => [g.count, n(g.avg), n(g.max), n(g.total), `${g.items[0].route} | ${g.key.slice(0, 200)}${g.items.some((x) => x.error) ? '  [CÓ LỖI]' : ''}`]));
table('6. DỊCH VỤ NGOÀI (AI / OCR)', ['lần', 'TB ms', 'max', 'lỗi', 'địa chỉ'],
  group(of('ext'), (r) => r.target).sort((a, b) => b.total - a.total).map((g) => [g.count, n(g.avg), n(g.max), g.items.filter((x) => x.error || x.status >= 400).length, g.key]));
table('7. SERVER BỊ NGHẼN (mọi người dùng cùng phải chờ)', ['giờ', 'ms', 'request đang chạy'],
  of('stall').sort((a, b) => b.ms - a.ms).slice(0, 15).map((r) => [r.t.slice(11, 19), n(r.ms), (r.active || []).join(', ') || '(tác vụ nền)']));
table('8. REQUEST BỊ NGẮT GIỮA CHỪNG', ['giờ', 'sau ms', 'KB gửi', 'request'],
  reqs.filter((r) => r.aborted).slice(-15).map((r) => [r.t.slice(11, 19), n(r.ms), n(r.in_kb), `${r.route.split(' ')[0]} ${r.path}`]));

const text = out.join('\n');
console.log(text);
const reportFile = path.join(LOG_DIR, 'perf-report.txt');
fs.writeFileSync(reportFile, `${text}\n`, 'utf8');
console.log(`\nĐã lưu: ${reportFile}`);
