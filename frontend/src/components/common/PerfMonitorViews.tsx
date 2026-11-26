/**
 * Nội dung bốn tab của bảng đo hiệu năng: Tác vụ (máy này) · Máy chủ · Tổng hợp bước · Tài nguyên.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PerfColumn, PerfTable, PerfValueList, formatPerf, perfCellText } from './PerfMonitorTable';
import { perfService, BackgroundStep, ServerStep, ServerTrace, StepSummary, SystemReport } from '../../services/perfService';
import { getClientInfo, getPerfTasks, PerfStep, PerfTask } from '../../utils/perfRecorder';

export interface PerfViewProps {
  query: string;
  paused: boolean;
  /** bỏ qua số liệu trước thời điểm này (nút "Xóa danh sách") */
  since: number;
  /** đăng ký hàm tạo dữ liệu xuất CSV của tab đang mở */
  setExporter: (fn: () => Promise<string[][]> | string[][]) => void;
}

const SLOW_MS = 1000;
const WARN_MS = 300;
const tone = (ms: number | null | undefined) => (ms === null || ms === undefined ? undefined : ms >= SLOW_MS ? 'bad' : ms >= WARN_MS ? 'warn' : undefined);
const clockText = (at: number) => {
  const d = new Date(at);
  return `${d.toLocaleTimeString('vi-VN', { hour12: false })}.${String(d.getMilliseconds()).padStart(3, '0')}`;
};
const TYPE_LABEL: Record<string, string> = {
  api: 'Gọi API', resource: 'Tải tài nguyên', process: 'Xử lý', render: 'Vẽ giao diện', longtask: 'Bị chặn',
  page: 'Tải trang', navigate: 'Chuyển trang', middleware: 'Lớp trung gian', handler: 'Nghiệp vụ', sql: 'SQL',
  external: 'Dịch vụ ngoài', file: 'Tệp', cpu: 'Tính toán', network: 'Mạng',
};
const typeLabel = (t: string) => TYPE_LABEL[t] || t;
const KIND_LABEL: Record<string, string> = { load: 'Tải trang', action: 'Thao tác', navigate: 'Chuyển trang', background: 'Chạy nền' };

const toCsvRows = <T,>(columns: PerfColumn<T>[], rows: T[]) => [
  columns.map((c) => c.title), ...rows.map((r) => columns.map((c) => perfCellText(c, r))),
];
const valuesText = (values: Record<string, string | number>) => Object.entries(values || {})
  .map(([k, v]) => `${k}: ${formatPerf(v)}`).join(' | ');

/** Gọi lại định kỳ khi chưa tạm dừng; giữ số liệu cũ nếu lần gọi sau lỗi */
function usePolling<T>(load: () => Promise<T>, intervalMs: number, paused: boolean) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;
  const loaded = useRef(false);
  useEffect(() => {
    if (paused && loaded.current) return undefined;
    let alive = true;
    let timer = 0;
    const tick = async () => {
      try {
        const next = await loadRef.current();
        if (!alive) return;
        loaded.current = true;
        setData(next);
        setError(null);
      } catch (e: any) {
        if (alive) setError(e?.message || 'Không tải được số liệu');
      }
      if (alive && !paused) timer = window.setTimeout(tick, intervalMs);
    };
    tick();
    return () => { alive = false; window.clearTimeout(timer); };
  }, [intervalMs, paused]);
  return { data, error };
}

const Status: React.FC<{ error: string | null; loading: boolean }> = ({ error, loading }) => (
  <>
    {error && <p className="qk7perf-error">{error}</p>}
    {loading && !error && <p className="qk7perf-note">Đang tải số liệu…</p>}
  </>
);

// ───────────────────────── Các bước (dùng chung) ─────────────────────────
interface StepRow {
  key: string;
  order: string;
  name: string;
  where: string;
  type: string;
  start: number | null;
  ms: number | null;
  cpu: number | null;
  mem: number | null;
  values: Record<string, string | number>;
  server?: boolean;
}

const stepColumns: PerfColumn<StepRow>[] = [
  { key: 'order', title: '#', width: 4, value: (r) => r.order },
  { key: 'name', title: 'Bước', width: 21, value: (r) => r.name, render: (r) => <span className={r.server ? 'qk7perf-sub' : undefined}>{r.name}</span> },
  { key: 'where', title: 'Nơi chạy', width: 7, value: (r) => r.where },
  { key: 'type', title: 'Loại', width: 8, value: (r) => r.type },
  { key: 'start', title: 'Bắt đầu (ms)', width: 10, type: 'dec', value: (r) => r.start },
  { key: 'ms', title: 'Thời gian (ms)', width: 10, type: 'dec', value: (r) => r.ms, tone: (r) => tone(r.ms) },
  { key: 'cpu', title: 'CPU (ms)', width: 8, type: 'dec', value: (r) => r.cpu },
  { key: 'mem', title: 'RAM đổi (MB)', width: 8, type: 'dec', value: (r) => r.mem },
  { key: 'values', title: 'Giá trị', width: 24, value: (r) => valuesText(r.values), render: (r) => <PerfValueList values={r.values} /> },
];

const serverRow = (s: ServerStep, prefix: string, key: string): StepRow => ({
  key, order: `${prefix}${s.n}`, name: s.after_response ? `${s.name} (sau khi trả lời)` : s.name, where: 'Máy chủ',
  type: typeLabel(s.type), start: s.start_ms, ms: s.ms, cpu: s.cpu_ms, mem: s.rss_mb, values: s.values, server: Boolean(prefix),
});

const clientRow = (task: PerfTask, s: PerfStep, i: number): StepRow => ({
  key: `c${s.id}`, order: String(i + 1), name: s.name, where: 'Máy này', type: typeLabel(s.type),
  start: s.start - task.start, ms: s.duration, cpu: null, mem: s.heapDeltaMb, values: s.values,
});

const clientSteps = (task: PerfTask) => [...task.steps].sort((a, b) => a.start - b.start);

// Dấu vết máy chủ đã tải về (không đổi sau khi request xong)
const traceCache = new Map<string, ServerTrace | 'gone'>();
async function loadTrace(id: string) {
  const hit = traceCache.get(id);
  if (hit) return hit;
  try {
    const trace = await perfService.trace(id);
    if (trace.finished) traceCache.set(id, trace);
    return trace;
  } catch (e: any) {
    if (e?.status === 404) traceCache.set(id, 'gone');
    return 'gone' as const;
  }
}

/** Tải nhiều dấu vết: nhiều hơn vài cái thì lấy cả danh sách một lần để không chạm giới hạn tần suất */
async function loadTraces(ids: string[]) {
  if (ids.filter((id) => !traceCache.has(id)).length > 5) {
    try {
      const full = await perfService.traces(600, true);
      full.traces.forEach((t) => { if (t.finished) traceCache.set(t.id, t); });
      ids.forEach((id) => { if (!traceCache.has(id)) traceCache.set(id, 'gone'); });
    } catch { /* thử tải từng cái bên dưới */ }
  }
  const out = new Map<string, ServerTrace | 'gone'>();
  for (const id of ids) out.set(id, await loadTrace(id));
  return out;
}

/** Bước trên máy này, mỗi lời gọi API kèm các bước tương ứng trên máy chủ */
function mergedSteps(task: PerfTask, traces: Map<string, ServerTrace | 'gone'>): StepRow[] {
  const rows: StepRow[] = [];
  clientSteps(task).forEach((s, i) => {
    rows.push(clientRow(task, s, i));
    const trace = s.traceId ? traces.get(s.traceId) : undefined;
    if (trace && trace !== 'gone') {
      (trace.steps || []).forEach((x) => rows.push(serverRow(x, `${i + 1}.`, `c${s.id}-${x.n}`)));
    }
  });
  return rows;
}

const TaskDetail: React.FC<{ task: PerfTask }> = ({ task }) => {
  const [traces, setTraces] = useState(new Map<string, ServerTrace | 'gone'>());
  const ids = task.steps.map((s) => s.traceId).filter(Boolean).join(',');
  useEffect(() => {
    let alive = true;
    loadTraces(ids ? ids.split(',') : []).then((map) => { if (alive) setTraces(map); });
    return () => { alive = false; };
  }, [ids]);
  return <PerfTable columns={stepColumns} rows={mergedSteps(task, traces)} rowKey={(r) => r.key} pageSize={200} />;
};

// ───────────────────────── Tab 1: Tác vụ trên máy này ─────────────────────────
interface TaskRow { task: PerfTask; total: number; api: number; work: number; blocked: number; mem: number | null; running: number }

const summarize = (task: PerfTask): TaskRow => {
  let end = task.start;
  let api = 0;
  let work = 0;
  let blocked = 0;
  let mem: number | null = null;
  let running = 0;
  for (const s of task.steps) {
    if (s.duration === null) { running += 1; continue; }
    end = Math.max(end, s.start + s.duration);
    if (s.type === 'api') api += s.duration;
    if (s.type === 'process' || s.type === 'render') work += s.duration;
    if (s.type === 'longtask') blocked += s.duration;
    if (s.heapDeltaMb !== null) mem = (mem ?? 0) + s.heapDeltaMb;
  }
  return { task, total: end - task.start, api, work, blocked, mem, running };
};

const taskColumns: PerfColumn<TaskRow>[] = [
  { key: 'at', title: 'Thời điểm', width: 12, value: (r) => r.task.at, render: (r) => clockText(r.task.at) },
  { key: 'name', title: 'Tác vụ', width: 24, value: (r) => r.task.name },
  { key: 'kind', title: 'Loại', width: 8, value: (r) => KIND_LABEL[r.task.kind] },
  { key: 'steps', title: 'Số bước', width: 7, type: 'int', value: (r) => r.task.steps.length },
  { key: 'total', title: 'Tổng thời gian (ms)', width: 11, type: 'dec', value: (r) => r.total, tone: (r) => tone(r.total) },
  { key: 'api', title: 'Gọi API (ms)', width: 10, type: 'dec', value: (r) => r.api },
  { key: 'work', title: 'Xử lý và vẽ (ms)', width: 10, type: 'dec', value: (r) => r.work },
  { key: 'blocked', title: 'Bị chặn (ms)', width: 9, type: 'dec', value: (r) => r.blocked, tone: (r) => (r.blocked > 200 ? 'warn' : undefined) },
  { key: 'mem', title: 'RAM trang đổi (MB)', width: 10, type: 'dec', value: (r) => r.mem },
];

export const TaskView: React.FC<PerfViewProps> = ({ query, paused, since, setExporter }) => {
  const [version, setVersion] = useState(0);
  const [hideBackground, setHideBackground] = useState(false);
  useEffect(() => {
    if (paused) return undefined;
    const t = window.setInterval(() => setVersion((v) => v + 1), 1000);
    return () => window.clearInterval(t);
  }, [paused]);
  const rows = useMemo(() => getPerfTasks()
    .filter((t) => t.at >= since && !(hideBackground && t.kind === 'background'))
    .map(summarize).reverse(), [version, since, hideBackground]);
  const searchText = (r: TaskRow) => r.task.steps.map((s) => `${s.name} ${valuesText(s.values)}`).join(' ');

  setExporter(async () => {
    const out: string[][] = [['Thời điểm', 'Tác vụ', ...stepColumns.map((c) => c.title)]];
    const traces = await loadTraces(rows.flatMap((r) => r.task.steps.map((s) => s.traceId).filter(Boolean) as string[]));
    for (const r of rows) {
      for (const step of mergedSteps(r.task, traces)) {
        out.push([clockText(r.task.at), r.task.name, ...stepColumns.map((c) => perfCellText(c, step))]);
      }
    }
    return out;
  });

  return (
    <>
      <label className="qk7perf-check">
        <input type="checkbox" checked={hideBackground} onChange={(e) => setHideBackground(e.target.checked)} />
        Ẩn tác vụ chạy nền
      </label>
      <PerfTable
        columns={taskColumns} rows={rows} rowKey={(r) => r.task.id} query={query} searchText={searchText}
        expand={(r) => <TaskDetail task={r.task} />}
        emptyText="Chưa ghi được tác vụ nào. Hãy thao tác trên trang."
      />
    </>
  );
};

// ───────────────────────── Tab 2: Máy chủ ─────────────────────────
const HEARTBEAT = /^\/api\/(auth\/ping|health|meta)$|\/(pending-count|count)$/;

const traceColumns: PerfColumn<ServerTrace>[] = [
  { key: 'at', title: 'Thời điểm', width: 11, value: (t) => t.at, render: (t) => clockText(t.at) },
  { key: 'route', title: 'Quy trình', width: 18, value: (t) => `${t.method} ${t.path}` },
  { key: 'user', title: 'Người dùng', width: 7, value: (t) => t.user },
  { key: 'status', title: 'Mã', width: 5, type: 'int', value: (t) => t.status, tone: (t) => ((t.status ?? 0) >= 500 || t.aborted ? 'bad' : (t.status ?? 0) >= 400 ? 'warn' : undefined) },
  { key: 'ms', title: 'Tổng (ms)', width: 9, type: 'dec', value: (t) => t.ms, tone: (t) => tone(t.ms) },
  { key: 'ttfb', title: 'Byte đầu (ms)', width: 9, type: 'dec', value: (t) => t.ttfb_ms },
  { key: 'cpu', title: 'CPU (ms)', width: 8, type: 'dec', value: (t) => t.cpu_ms },
  { key: 'rss', title: 'RAM đổi (MB)', width: 8, type: 'dec', value: (t) => t.rss_mb },
  { key: 'db', title: 'SQL (ms)', width: 9, type: 'dec', value: (t) => t.db_ms },
  { key: 'dbn', title: 'Số SQL', width: 5, type: 'int', value: (t) => t.db_n },
  { key: 'ext', title: 'Dịch vụ ngoài (ms)', width: 8, type: 'dec', value: (t) => t.ext_ms },
  { key: 'in', title: 'Nhận (KB)', width: 8, type: 'dec', value: (t) => t.in_kb },
  { key: 'out', title: 'Gửi (KB)', width: 8, type: 'dec', value: (t) => t.out_kb },
  { key: 'steps', title: 'Số bước', width: 5, type: 'int', value: (t) => t.step_count },
];

const TraceDetail: React.FC<{ trace: ServerTrace }> = ({ trace }) => {
  const [detail, setDetail] = useState<ServerTrace | 'gone' | null>(null);
  useEffect(() => {
    let alive = true;
    loadTrace(trace.id).then((t) => { if (alive) setDetail(t); });
    return () => { alive = false; };
  }, [trace.id, trace.step_count]);
  if (!detail) return <p className="qk7perf-note">Đang tải các bước…</p>;
  if (detail === 'gone') return <p className="qk7perf-note">Máy chủ không còn giữ các bước của tác vụ này.</p>;
  return (
    <>
      <p className="qk7perf-note">
        Số request cùng chạy lúc bắt đầu: {detail.concurrent}
        {detail.dropped_steps ? ` · Bỏ bớt ${detail.dropped_steps} bước do vượt giới hạn` : ''}
      </p>
      <PerfTable columns={stepColumns} rows={(detail.steps || []).map((s) => serverRow(s, '', `s${s.n}`))} rowKey={(r) => r.key} pageSize={200} />
    </>
  );
};

const backgroundColumns: PerfColumn<BackgroundStep>[] = [
  { key: 'at', title: 'Thời điểm', width: 11, value: (b) => b.at, render: (b) => clockText(b.at) },
  { key: 'name', title: 'Bước', width: 22, value: (b) => b.name },
  { key: 'type', title: 'Loại', width: 8, value: (b) => typeLabel(b.type) },
  { key: 'ms', title: 'Thời gian (ms)', width: 10, type: 'dec', value: (b) => b.ms, tone: (b) => tone(b.ms) },
  { key: 'cpu', title: 'CPU (ms)', width: 9, type: 'dec', value: (b) => b.cpu_ms },
  { key: 'mem', title: 'RAM đổi (MB)', width: 9, type: 'dec', value: (b) => b.rss_mb },
  { key: 'values', title: 'Giá trị', width: 31, value: (b) => valuesText(b.values), render: (b) => <PerfValueList values={b.values} /> },
];

export const ServerView: React.FC<PerfViewProps> = ({ query, paused, since, setExporter }) => {
  const [mode, setMode] = useState<'requests' | 'background'>('requests');
  const [hideHeartbeat, setHideHeartbeat] = useState(true);
  const [apiOnly, setApiOnly] = useState(true);
  const requests = usePolling(() => perfService.traces(600), 3000, paused);
  const background = usePolling(() => perfService.background(), 5000, paused);
  const keep = (t: ServerTrace) => t.at >= since && !(hideHeartbeat && HEARTBEAT.test(t.path)) && !(apiOnly && !t.path.startsWith('/api'));
  const rows = (requests.data?.traces || []).filter(keep);
  const bgRows = (background.data?.items || []).filter((b) => b.at >= since);

  setExporter(async () => {
    if (mode === 'background') return toCsvRows(backgroundColumns, bgRows);
    const full = await perfService.traces(600, true);
    const out: string[][] = [['Thời điểm', 'Quy trình', 'Tổng (ms)', ...stepColumns.map((c) => c.title)]];
    for (const t of full.traces.filter(keep)) {
      for (const s of t.steps || []) {
        const row = serverRow(s, '', `s${s.n}`);
        out.push([clockText(t.at), `${t.method} ${t.path}`, formatPerf(t.ms, 'dec'), ...stepColumns.map((c) => perfCellText(c, row))]);
      }
    }
    return out;
  });

  return (
    <>
      <div className="qk7perf-filters">
        <div className="qk7perf-seg" role="group" aria-label="Loại việc trên máy chủ">
          <button type="button" className={mode === 'requests' ? 'is-on' : ''} onClick={() => setMode('requests')}>Yêu cầu từ máy con</button>
          <button type="button" className={mode === 'background' ? 'is-on' : ''} onClick={() => setMode('background')}>Tác vụ nền</button>
        </div>
        {mode === 'requests' && (
          <>
            <label className="qk7perf-check"><input type="checkbox" checked={apiOnly} onChange={(e) => setApiOnly(e.target.checked)} />Chỉ API</label>
            <label className="qk7perf-check"><input type="checkbox" checked={hideHeartbeat} onChange={(e) => setHideHeartbeat(e.target.checked)} />Ẩn nhịp kiểm tra định kỳ</label>
          </>
        )}
      </div>
      {requests.data && !requests.data.enabled && <p className="qk7perf-error">Máy chủ đang tắt đo từng bước (PERF_TIMING hoặc PERF_TRACE = false).</p>}
      <Status error={requests.error} loading={!requests.data} />
      {mode === 'requests' ? (
        <PerfTable columns={traceColumns} rows={rows} rowKey={(t) => t.id} query={query} expand={(t) => <TraceDetail trace={t} />} />
      ) : (
        <PerfTable columns={backgroundColumns} rows={bgRows} rowKey={(b) => b.seq} query={query} emptyText="Chưa có tác vụ nền" />
      )}
    </>
  );
};

// ───────────────────────── Tab 3: Tổng hợp theo bước ─────────────────────────
const summaryColumns: PerfColumn<StepSummary>[] = [
  { key: 'type', title: 'Loại', width: 9, value: (s) => typeLabel(s.type) },
  { key: 'name', title: 'Bước / quy trình', width: 28, value: (s) => s.name },
  { key: 'count', title: 'Số lần', width: 7, type: 'int', value: (s) => s.count },
  { key: 'total', title: 'Tổng (ms)', width: 11, type: 'dec', value: (s) => s.total_ms },
  { key: 'avg', title: 'Trung bình (ms)', width: 10, type: 'dec', value: (s) => s.avg_ms, tone: (s) => tone(s.avg_ms) },
  { key: 'p95', title: 'p95 (ms)', width: 10, type: 'dec', value: (s) => s.p95_ms, tone: (s) => tone(s.p95_ms) },
  { key: 'max', title: 'Lớn nhất (ms)', width: 10, type: 'dec', value: (s) => s.max_ms },
  { key: 'cpu', title: 'CPU tổng (ms)', width: 10, type: 'dec', value: (s) => s.cpu_ms },
  { key: 'avgCpu', title: 'CPU trung bình (ms)', width: 10, type: 'dec', value: (s) => s.avg_cpu_ms },
];

function summarizeClient(since: number): StepSummary[] {
  const groups = new Map<string, { type: string; name: string; values: number[] }>();
  for (const task of getPerfTasks()) {
    if (task.at < since) continue;
    for (const s of task.steps) {
      if (s.duration === null) continue;
      const key = `${s.type}|${s.name}`;
      const g = groups.get(key) || { type: s.type, name: s.name, values: [] };
      g.values.push(s.duration);
      groups.set(key, g);
    }
  }
  return [...groups.values()].map(({ type, name, values }) => {
    const sorted = [...values].sort((a, b) => a - b);
    const total = values.reduce((a, b) => a + b, 0);
    return {
      type, name, count: values.length, total_ms: total, avg_ms: total / values.length,
      p95_ms: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))], max_ms: sorted[sorted.length - 1],
      cpu_ms: NaN, avg_cpu_ms: NaN, // trình duyệt không cho đo CPU của từng bước
    };
  });
}

export const SummaryView: React.FC<PerfViewProps> = ({ query, paused, since, setExporter }) => {
  const [side, setSide] = useState<'server' | 'client'>('server');
  const server = usePolling(() => perfService.steps(), 5000, paused);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (paused) return undefined;
    const t = window.setInterval(() => setVersion((v) => v + 1), 2000);
    return () => window.clearInterval(t);
  }, [paused]);
  const clientRows = useMemo(() => summarizeClient(since), [version, since, side]);
  const rows = side === 'server' ? server.data?.steps || [] : clientRows;
  setExporter(() => toCsvRows(summaryColumns, rows));
  return (
    <>
      <div className="qk7perf-filters">
        <div className="qk7perf-seg" role="group" aria-label="Nơi tổng hợp">
          <button type="button" className={side === 'server' ? 'is-on' : ''} onClick={() => setSide('server')}>Máy chủ</button>
          <button type="button" className={side === 'client' ? 'is-on' : ''} onClick={() => setSide('client')}>Máy này</button>
        </div>
        <span className="qk7perf-muted">
          {side === 'server' ? 'Cộng dồn từ lúc máy chủ khởi động' : 'Cộng dồn các tác vụ đang lưu trên máy này'}
        </span>
      </div>
      {side === 'server' && <Status error={server.error} loading={!server.data} />}
      <PerfTable columns={summaryColumns} rows={rows} rowKey={(s) => `${s.type}|${s.name}`} query={query} initialSort={{ key: 'total', desc: true }} />
    </>
  );
};

// ───────────────────────── Tab 4: Tài nguyên ─────────────────────────
interface Metric { group: string; name: string; value: string | number | null; unit: string; level?: 'warn' | 'bad' }

const metricColumns: PerfColumn<Metric>[] = [
  { key: 'group', title: 'Nhóm', width: 16, value: (m) => m.group },
  { key: 'name', title: 'Chỉ số', width: 34, value: (m) => m.name },
  { key: 'value', title: 'Giá trị', width: 38, value: (m) => m.value, tone: (m) => m.level },
  { key: 'unit', title: 'Đơn vị', width: 12, value: (m) => m.unit },
];

const level = (v: number | null | undefined, warn: number, bad: number) => (v === null || v === undefined ? undefined : v >= bad ? 'bad' as const : v >= warn ? 'warn' as const : undefined);

function systemMetrics(r: SystemReport): Metric[] {
  const c = r.current;
  const memPct = (100 * c.mem_used_mb) / r.host.mem_total_mb;
  const out: Metric[] = [];
  const add = (group: string, name: string, value: Metric['value'], unit = '', lv?: Metric['level']) => out.push({ group, name, value, unit, level: lv });
  add('Máy chủ', 'Tên máy', r.host.name);
  add('Máy chủ', 'Hệ điều hành', r.host.platform);
  add('Máy chủ', 'Bộ xử lý', r.host.cpu_model);
  add('Máy chủ', 'Số nhân CPU', r.host.cpu_count);
  add('Máy chủ', 'CPU toàn máy', c.cpu_system_pct, '%', level(c.cpu_system_pct, 70, 90));
  add('Máy chủ', 'RAM đã dùng', c.mem_used_mb, 'MB');
  add('Máy chủ', 'RAM tổng', r.host.mem_total_mb, 'MB');
  add('Máy chủ', 'Tỷ lệ RAM đã dùng', memPct, '%', level(memPct, 80, 92));
  add('Máy chủ', 'Máy đã chạy', r.host.uptime_s / 3600, 'giờ');
  add('Máy chủ web', 'CPU của Node', c.cpu_node_pct, '%', level(c.cpu_node_pct, 50, 80));
  add('Máy chủ web', 'Bộ nhớ chiếm giữ (RSS)', c.rss_mb, 'MB');
  add('Máy chủ web', 'Heap đang dùng', c.heap_used_mb, 'MB');
  add('Máy chủ web', 'Heap đã cấp', c.heap_total_mb, 'MB');
  add('Máy chủ web', 'Bộ nhớ ngoài heap', c.external_mb, 'MB');
  add('Máy chủ web', 'Độ trễ vòng lặp trung bình', c.loop_mean_ms, 'ms');
  add('Máy chủ web', 'Độ trễ vòng lặp lớn nhất', c.loop_max_ms, 'ms', level(c.loop_max_ms, 100, 500));
  add('Máy chủ web', 'Request đang xử lý', c.active_requests);
  add('Máy chủ web', 'Đã chạy', r.node.uptime_s / 60, 'phút');
  add('Máy chủ web', 'Phiên bản Node', r.node.version);
  add('CSDL', 'Kết nối trong pool', c.sql_pool_size);
  add('CSDL', 'Kết nối đang bận', c.sql_pool_busy);
  add('CSDL', 'Yêu cầu đang chờ kết nối', c.sql_pool_waiting, '', level(c.sql_pool_waiting, 1, 5));
  if ('error' in r.database) add('CSDL', 'Dung lượng', r.database.error, '', 'bad');
  else {
    r.database.files.forEach((f) => add('CSDL', f.type === 'ROWS' ? 'Dung lượng tệp dữ liệu' : f.type === 'LOG' ? 'Dung lượng tệp nhật ký' : f.type, f.mb, 'MB'));
    add('CSDL', 'Số phiên đang kết nối CSDL', r.database.connections);
  }
  if ('error' in r.disk) add('Ổ đĩa', 'Dung lượng', r.disk.error, '', 'bad');
  else {
    add('Ổ đĩa', 'Tổng', r.disk.total_gb, 'GB');
    add('Ổ đĩa', 'Đã dùng', r.disk.used_gb, 'GB');
    add('Ổ đĩa', 'Còn trống', r.disk.free_gb, 'GB', level(r.disk.used_pct, 80, 92));
    add('Ổ đĩa', 'Tỷ lệ đã dùng', r.disk.used_pct, '%', level(r.disk.used_pct, 80, 92));
  }
  if ('error' in r.folders) add('Thư mục dữ liệu', 'Dung lượng', r.folders.error, '', 'bad');
  else r.folders.forEach((f) => add('Thư mục dữ liệu', `${f.name} (${f.files} tệp)`, f.mb, 'MB'));
  if ('error' in r.services) add('Dịch vụ', 'Kiểm tra', r.services.error, '', 'bad');
  else r.services.forEach((s) => add('Dịch vụ', `${s.name} ${s.address}`, s.up ? `Đang chạy, phản hồi ${formatPerf(s.ms, 'dec')} ms` : 'Không kết nối được', '', s.up ? undefined : 'warn'));
  if ('error' in r.gpu) add('GPU máy chủ', 'Kiểm tra', r.gpu.error, '', 'warn');
  else if (!r.gpu.length) add('GPU máy chủ', 'NVIDIA', 'Không có hoặc không đo được (thiếu nvidia-smi)');
  else r.gpu.forEach((g) => {
    add('GPU máy chủ', `${g.name}: mức dùng`, g.util_pct, '%', level(g.util_pct, 80, 95));
    add('GPU máy chủ', `${g.name}: bộ nhớ ${formatPerf(g.memory_total_mb)} MB, đã dùng`, g.memory_used_mb, 'MB');
  });
  return out;
}

type Process = Extract<SystemReport['processes'], unknown[]>[number];
const processColumns: PerfColumn<Process>[] = [
  { key: 'name', title: 'Tiến trình', width: 24, value: (p) => (p.is_gateway ? `${p.name} (máy chủ web)` : p.name) },
  { key: 'pid', title: 'PID', width: 12, type: 'int', value: (p) => p.pid },
  { key: 'mem', title: 'RAM đang chiếm (MB)', width: 18, type: 'dec', value: (p) => p.memory_mb },
  { key: 'private', title: 'Bộ nhớ riêng (MB)', width: 18, type: 'dec', value: (p) => p.private_mb },
  { key: 'cpu', title: 'CPU (%)', width: 12, type: 'dec', value: (p) => p.cpu_pct },
  { key: 'seconds', title: 'CPU tích lũy (giây)', width: 16, type: 'dec', value: (p) => p.cpu_seconds },
];

type Sample = SystemReport['current'];
const sampleColumns: PerfColumn<Sample>[] = [
  { key: 'at', title: 'Thời điểm', width: 12, value: (s) => s.at, render: (s) => clockText(s.at) },
  { key: 'cpu', title: 'CPU máy (%)', width: 10, type: 'dec', value: (s) => s.cpu_system_pct },
  { key: 'node', title: 'CPU Node (%)', width: 10, type: 'dec', value: (s) => s.cpu_node_pct },
  { key: 'mem', title: 'RAM máy (MB)', width: 12, type: 'dec', value: (s) => s.mem_used_mb },
  { key: 'rss', title: 'RSS (MB)', width: 11, type: 'dec', value: (s) => s.rss_mb },
  { key: 'heap', title: 'Heap (MB)', width: 11, type: 'dec', value: (s) => s.heap_used_mb },
  { key: 'loop', title: 'Trễ vòng lặp (ms)', width: 11, type: 'dec', value: (s) => s.loop_max_ms },
  { key: 'req', title: 'Request', width: 7, type: 'int', value: (s) => s.active_requests },
  { key: 'busy', title: 'SQL bận', width: 7, type: 'int', value: (s) => s.sql_pool_busy },
  { key: 'wait', title: 'SQL chờ', width: 7, type: 'int', value: (s) => s.sql_pool_waiting },
];

/** Số khung hình mỗi giây; chỉ đo khi tab Tài nguyên đang mở */
function useFps(active: boolean) {
  const [fps, setFps] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return undefined;
    let frames = 0;
    let since = performance.now();
    let id = 0;
    const frame = (now: number) => {
      frames += 1;
      if (now - since >= 1000) { setFps((frames * 1000) / (now - since)); frames = 0; since = now; }
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [active]);
  return fps;
}

export const ResourceView: React.FC<PerfViewProps> = ({ query, paused, setExporter }) => {
  const system = usePolling(() => perfService.system(), 5000, paused);
  const fps = useFps(!paused);
  const report = system.data;
  const clientRows: Metric[] = [
    { group: 'Máy này', name: 'Số khung hình mỗi giây (độ mượt)', value: fps, unit: 'khung/giây', level: fps !== null && fps < 30 ? 'warn' : undefined },
    ...Object.entries(getClientInfo()).map(([name, value]) => ({ group: 'Máy này', name, value, unit: '' })),
  ];
  const serverRows = report ? systemMetrics(report) : [];
  const processes = report && Array.isArray(report.processes) ? report.processes : [];
  const samples = report ? [...report.history].reverse() : [];

  setExporter(() => [
    ...toCsvRows(metricColumns, [...clientRows, ...serverRows]), [],
    ...toCsvRows(processColumns, processes), [],
    ...toCsvRows(sampleColumns, samples),
  ]);

  return (
    <>
      <h4 className="qk7perf-h">Máy đang dùng</h4>
      <PerfTable columns={metricColumns} rows={clientRows} rowKey={(m) => m.name} query={query} pageSize={100} />
      <h4 className="qk7perf-h">Máy chủ</h4>
      <Status error={system.error} loading={!report} />
      <PerfTable columns={metricColumns} rows={serverRows} rowKey={(m) => `${m.group}|${m.name}`} query={query} pageSize={100} />
      <h4 className="qk7perf-h">Tiến trình dịch vụ trên máy chủ</h4>
      {report && !Array.isArray(report.processes) && <p className="qk7perf-error">{report.processes.error}</p>}
      <PerfTable columns={processColumns} rows={processes} rowKey={(p) => p.pid} query={query} />
      <h4 className="qk7perf-h">Diễn biến tài nguyên máy chủ (mới nhất ở trên)</h4>
      <PerfTable columns={sampleColumns} rows={samples} rowKey={(s) => s.at} query={query} pageSize={20} />
    </>
  );
};
