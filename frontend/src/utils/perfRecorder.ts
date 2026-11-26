/**
 * Ghi lại từng bước của mỗi tác vụ ngay trên máy đang dùng (chỉ giữ trong bộ nhớ, không gửi đi đâu).
 *
 * Tác vụ: tải trang, một lần bấm nút/liên kết, một lần chuyển trang, hoặc việc chạy nền.
 * Bước:   gọi API, tải tài nguyên, xử lý trên máy (perfStep), vẽ giao diện, luồng giao diện bị chặn.
 * API mang theo mã `X-Perf-Id` để bảng đo ghép thêm các bước tương ứng trên máy chủ.
 *
 * Không ghi tham số trên đường dẫn (có thể chứa mã phiên), không ghi nội dung gửi/nhận.
 */

export type PerfStepType = 'api' | 'resource' | 'process' | 'render' | 'longtask' | 'page' | 'navigate';
export type PerfTaskKind = 'load' | 'action' | 'navigate' | 'background';
export type PerfValues = Record<string, string | number>;

export interface PerfStep {
  id: number;
  type: PerfStepType;
  name: string;
  /** mili giây tính từ lúc mở trang */
  start: number;
  /** null khi bước chưa xong */
  duration: number | null;
  heapDeltaMb: number | null;
  values: PerfValues;
  traceId?: string;
}

export interface PerfTask {
  id: number;
  kind: PerfTaskKind;
  name: string;
  /** thời điểm thực (epoch ms) */
  at: number;
  start: number;
  steps: PerfStep[];
}

const MAX_TASKS = 300;
const MAX_STEPS = 300;
const CHAIN_MS = 1500; // việc xảy ra trong khoảng này sau bước cuối vẫn thuộc cùng tác vụ
const MONITOR_PATH = '/api/admin/perf';
const MB = 1048576;

const tasks: PerfTask[] = [];
let taskSeq = 0;
let stepSeq = 0;
let installed = false;
let loadTask: PerfTask | null = null;
let current: { task: PerfTask; listed: boolean; open: number; lastEnd: number } | null = null;
const waitingResource: { url: string; step: PerfStep }[] = [];
let longTaskCount = 0;
let longTaskTotal = 0;

const heapMb = (): number | null => {
  const m = (performance as any).memory;
  return m ? m.usedJSHeapSize / MB : null;
};

function newTask(kind: PerfTaskKind, name: string, start = performance.now()): PerfTask {
  return { id: ++taskSeq, kind, name, at: performance.timeOrigin + start, start, steps: [] };
}

function list(task: PerfTask) {
  tasks.push(task);
  if (tasks.length > MAX_TASKS) tasks.shift();
}

/** Tác vụ nhận bước mới; việc không do người dùng khởi phát được gom thành tác vụ nền */
function owner(fallbackName: string, at = performance.now()): NonNullable<typeof current> {
  // Việc bắt đầu trước thao tác hiện tại thì không thuộc thao tác đó
  if (current && at >= current.task.start - 5 && (current.open > 0 || at - current.lastEnd < CHAIN_MS)) return current;
  if (loadTask && at - loadTask.start < 4000) return { task: loadTask, listed: true, open: 0, lastEnd: at };
  return { task: newTask('background', fallbackName, at), listed: false, open: 0, lastEnd: at };
}

function addStep(target: NonNullable<typeof current>, step: Omit<PerfStep, 'id'>): PerfStep {
  const full: PerfStep = { id: ++stepSeq, ...step };
  if (!target.listed) { list(target.task); target.listed = true; }
  if (target.task.steps.length < MAX_STEPS) target.task.steps.push(full);
  if (full.duration !== null) target.lastEnd = Math.max(target.lastEnd, full.start + full.duration);
  return full;
}

function begin(type: PerfStepType, name: string, values: PerfValues = {}) {
  const start = performance.now();
  const target = owner(`Chạy nền: ${name}`, start);
  const heapBefore = heapMb();
  const step = addStep(target, { type, name, start, duration: null, heapDeltaMb: null, values });
  target.open += 1;
  return {
    step,
    end(extra: PerfValues = {}) {
      const end = performance.now();
      const heapAfter = heapMb();
      step.duration = end - start;
      step.heapDeltaMb = heapBefore === null || heapAfter === null ? null : heapAfter - heapBefore;
      Object.assign(step.values, extra);
      target.open = Math.max(0, target.open - 1);
      target.lastEnd = Math.max(target.lastEnd, end);
    },
  };
}

/** Đo một đoạn xử lý trên máy con. values(kết quả) trả về các giá trị cần ghi. */
export async function perfStep<T>(
  name: string,
  fn: () => Promise<T> | T,
  options: { type?: PerfStepType; values?: PerfValues; result?: (value: T) => PerfValues } = {},
): Promise<T> {
  if (!installed) return fn();
  const handle = begin(options.type || 'process', name, { ...options.values });
  try {
    const value = await fn();
    handle.end(options.result ? options.result(value) : {});
    return value;
  } catch (error: any) {
    handle.end({ 'Lỗi': String(error?.name || error?.message || error).slice(0, 200) });
    throw error;
  }
}

// ───────────────────────── Gọi API ─────────────────────────
function patchFetch() {
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url: URL;
    try {
      url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    } catch {
      return original(input, init);
    }
    if (url.pathname.startsWith(MONITOR_PATH) || url.protocol === 'blob:' || url.protocol === 'data:') {
      return original(input, init);
    }
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const target = url.origin === window.location.origin ? url.pathname : `${url.host}${url.pathname}`;
    const body = init?.body;
    const sent = body instanceof FormData
      ? Array.from(body.values()).reduce<number>((n, v) => n + (v instanceof Blob ? v.size : String(v).length), 0)
      : typeof body === 'string' ? body.length : body instanceof Blob ? body.size : 0;
    const handle = begin('api', `${method} ${target}`, sent ? { 'KB gửi lên': sent / 1024 } : {});
    try {
      const response = await original(input, init);
      handle.end({ 'Mã trả về': response.status, 'Chờ máy chủ trả lời (ms)': performance.now() - handle.step.start });
      handle.step.traceId = response.headers.get('X-Perf-Id') || undefined;
      // Thời gian tải hết nội dung được bổ sung khi trình duyệt ghi nhận tài nguyên
      waitingResource.push({ url: url.href, step: handle.step });
      if (waitingResource.length > 100) waitingResource.shift();
      return response;
    } catch (error: any) {
      handle.end({ 'Lỗi': String(error?.name || error?.message || error).slice(0, 200) });
      throw error;
    }
  };
}

// ───────────────────────── Trình duyệt tự đo ─────────────────────────
const timingValues = (e: PerformanceResourceTiming): PerfValues => {
  const out: PerfValues = { 'KB truyền qua mạng': e.transferSize / 1024, 'KB nội dung': e.decodedBodySize / 1024 };
  // Bằng 0 khi máy chủ khác nguồn không cho đọc chi tiết
  if (e.requestStart > 0) {
    out['Chờ kết nối (ms)'] = e.requestStart - e.startTime;
    out['Chờ byte đầu (ms)'] = e.responseStart - e.requestStart;
    out['Tải nội dung (ms)'] = e.responseEnd - e.responseStart;
  }
  if (e.transferSize === 0 && e.decodedBodySize > 0) out['Lấy từ bộ nhớ đệm'] = 'Có';
  return out;
};

function onResource(e: PerformanceResourceTiming) {
  const url = new URL(e.name, window.location.href);
  if (url.pathname.startsWith(MONITOR_PATH)) return;
  if (e.initiatorType === 'fetch' || e.initiatorType === 'xmlhttprequest') {
    const i = waitingResource.findIndex((w) => w.url === e.name && e.startTime >= w.step.start - 5);
    if (i >= 0) {
      const { step } = waitingResource.splice(i, 1)[0];
      step.duration = Math.max(step.duration ?? 0, e.responseEnd - step.start);
      Object.assign(step.values, timingValues(e));
    }
    return;
  }
  if (url.protocol === 'blob:' || url.protocol === 'data:') return;
  const target = owner('Tải tài nguyên', e.startTime);
  addStep(target, {
    type: 'resource', name: `${e.initiatorType || 'tệp'} ${url.pathname}`, start: e.startTime,
    duration: e.duration, heapDeltaMb: null, values: timingValues(e),
  });
}

function onLongTask(e: PerformanceEntry) {
  longTaskCount += 1;
  longTaskTotal += e.duration;
  addStep(owner('Luồng giao diện bị chặn', e.startTime), {
    type: 'longtask', name: 'Luồng giao diện bị chặn (trang không phản hồi)', start: e.startTime,
    duration: e.duration, heapDeltaMb: null, values: {},
  });
}

function pageStep(name: string, start: number, duration: number, values: PerfValues = {}) {
  if (!loadTask || !(duration >= 0)) return;
  addStep({ task: loadTask, listed: true, open: 0, lastEnd: 0 }, {
    type: 'page', name, start, duration, heapDeltaMb: null, values,
  });
}

function recordNavigation() {
  const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (!n) return;
  pageStep('Chuyển hướng', n.redirectStart, n.redirectEnd - n.redirectStart);
  pageStep('Tra tên miền (DNS)', n.domainLookupStart, n.domainLookupEnd - n.domainLookupStart);
  pageStep('Kết nối và bắt tay TLS', n.connectStart, n.connectEnd - n.connectStart);
  pageStep('Chờ máy chủ trả trang', n.requestStart, n.responseStart - n.requestStart);
  pageStep('Tải tệp HTML', n.responseStart, n.responseEnd - n.responseStart, { 'KB': n.transferSize / 1024 });
  pageStep('Phân tích HTML và chạy mã khởi động', n.responseEnd, n.domContentLoadedEventStart - n.responseEnd);
  pageStep('Chờ tài nguyên còn lại', n.domContentLoadedEventEnd, n.loadEventStart - n.domContentLoadedEventEnd);
  pageStep('Hoàn tất sự kiện tải trang', n.loadEventStart, n.loadEventEnd - n.loadEventStart);
}

function observe(type: string, handler: (entry: any) => void) {
  try {
    new PerformanceObserver((l) => l.getEntries().forEach(handler)).observe({ type, buffered: true } as any);
  } catch { /* trình duyệt không hỗ trợ loại số liệu này */ }
}

// ───────────────────────── Thao tác người dùng ─────────────────────────
function afterPaint(callback: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(callback));
}

function startAction(kind: PerfTaskKind, name: string, firstStep: string, type: PerfStepType) {
  const start = performance.now();
  current = { task: newTask(kind, name, start), listed: false, open: 0, lastEnd: start };
  const target = current;
  afterPaint(() => {
    addStep(target, { type, name: firstStep, start, duration: performance.now() - start, heapDeltaMb: null, values: {} });
  });
}

function watchActions() {
  document.addEventListener('click', (event) => {
    const el = (event.target as Element | null)?.closest?.(
      'button,a,[role="button"],[role="tab"],[role="menuitem"],input[type="submit"]',
    ) as HTMLElement | null;
    if (!el || el.closest('[data-perf-ignore]')) return;
    const label = (el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.tagName)
      .replace(/\s+/g, ' ').trim().slice(0, 60);
    startAction('action', `Bấm: ${label || el.tagName.toLowerCase()}`, 'Giao diện phản hồi sau khi bấm', 'render');
  }, true);

  document.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement | null;
    if (input?.type !== 'file' || !input.files?.length || input.closest('[data-perf-ignore]')) return;
    const kb = Array.from(input.files).reduce((n, f) => n + f.size, 0) / 1024;
    startAction('action', `Chọn tệp (${input.files.length} tệp)`, 'Giao diện phản hồi sau khi chọn tệp', 'render');
    if (current) addStep(current, {
      type: 'process', name: 'Tệp được chọn', start: performance.now(), duration: 0, heapDeltaMb: null,
      values: { 'KB': kb },
    });
  }, true);

  const onRoute = (path: string) => {
    const at = performance.now();
    const name = `Chuyển trang ${path}`;
    if (current && at - current.lastEnd < CHAIN_MS) {
      const target = current;
      afterPaint(() => addStep(target, {
        type: 'navigate', name, start: at, duration: performance.now() - at, heapDeltaMb: null, values: {},
      }));
    } else {
      startAction('navigate', name, 'Vẽ trang mới', 'navigate');
    }
  };
  let lastPath = window.location.pathname;
  const check = () => {
    if (window.location.pathname !== lastPath) { lastPath = window.location.pathname; onRoute(lastPath); }
  };
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method];
    history[method] = function patched(this: History, ...args: Parameters<History['pushState']>) {
      original.apply(this, args);
      check();
    };
  }
  window.addEventListener('popstate', check);
}

export function installPerfRecorder() {
  if (installed || typeof window === 'undefined' || typeof performance === 'undefined') return;
  installed = true;
  loadTask = newTask('load', `Tải trang ${window.location.pathname}`, 0);
  list(loadTask);
  patchFetch();
  watchActions();
  observe('resource', onResource);
  observe('longtask', onLongTask);
  observe('paint', (e) => pageStep(
    e.name === 'first-contentful-paint' ? 'Hiện nội dung đầu tiên (FCP)' : 'Vẽ lần đầu (FP)', 0, e.startTime));
  observe('largest-contentful-paint', (e) => pageStep('Hiện khối nội dung lớn nhất (LCP)', 0, e.startTime));
  const done = () => setTimeout(recordNavigation, 0);
  if (document.readyState === 'complete') done(); else window.addEventListener('load', done, { once: true });
}

export const getPerfTasks = (): PerfTask[] => tasks;

export function clearPerfTasks() {
  tasks.length = 0;
  current = null;
  loadTask = null;
}

/** Thông số của máy và trình duyệt đang dùng */
export function getClientInfo(): PerfValues {
  const nav = navigator as any;
  const memory = (performance as any).memory;
  let gpu = 'Không đọc được';
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      gpu = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch { /* máy không có WebGL */ }
  return {
    'Card đồ họa trình duyệt đang dùng': gpu,
    'Số nhân CPU': navigator.hardwareConcurrency || 'Không đọc được',
    'RAM của máy (mức ước lượng, GB)': nav.deviceMemory ?? 'Không đọc được',
    'Bộ nhớ mã trang đang dùng (MB)': memory ? memory.usedJSHeapSize / MB : 'Chỉ có trên Chrome/Edge',
    'Bộ nhớ mã trang tối đa (MB)': memory ? memory.jsHeapSizeLimit / MB : 'Chỉ có trên Chrome/Edge',
    'Số phần tử trên trang': document.getElementsByTagName('*').length,
    'Số lần giao diện bị chặn': longTaskCount,
    'Tổng thời gian bị chặn (ms)': longTaskTotal,
    'Độ phân giải cửa sổ': `${window.innerWidth} × ${window.innerHeight} (tỷ lệ ${window.devicePixelRatio})`,
    'Tốc độ mạng ước lượng (Mbit/s)': nav.connection?.downlink ?? 'Không đọc được',
    'Trình duyệt': navigator.userAgent,
  };
}
