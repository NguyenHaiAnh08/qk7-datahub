/**
 * Cửa sổ nổi "Đo hiệu năng": kéo thanh tiêu đề để di chuyển, kéo 4 cạnh và 4 góc để đổi kích thước,
 * ẩn/hiện bằng nút hoặc Ctrl+Shift+M. Vị trí và kích thước được nhớ trên máy đang dùng.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Eraser, Maximize2, Minimize2, Pause, Play, X } from 'lucide-react';
import { PerfViewProps, ResourceView, ServerView, SummaryView, TaskView } from './PerfMonitorViews';
import { clearPerfTasks } from '../../utils/perfRecorder';
import './PerfMonitorPopup.css';

type Rect = { x: number; y: number; w: number; h: number };
type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const HANDLES: Exclude<Handle, 'move'>[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const STORAGE_KEY = 'qk7_perf_popup';
const MIN_W = 720; // dưới mức này bảng nhiều cột phải ngắt giữa con số
const MIN_H = 260;

const TABS: { key: string; label: string; View: React.FC<PerfViewProps> }[] = [
  { key: 'tasks', label: 'Tác vụ trên máy này', View: TaskView },
  { key: 'server', label: 'Máy chủ', View: ServerView },
  { key: 'summary', label: 'Tổng hợp bước', View: SummaryView },
  { key: 'resources', label: 'Tài nguyên', View: ResourceView },
];

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

/** Giữ cửa sổ nằm trọn trong màn hình */
function fit(r: Rect): Rect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = clamp(r.w, Math.min(MIN_W, vw), vw);
  const h = clamp(r.h, Math.min(MIN_H, vh), vh);
  return { w, h, x: clamp(r.x, 0, vw - w), y: clamp(r.y, 0, vh - h) };
}

function readRect(): Rect {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && ['x', 'y', 'w', 'h'].every((k) => Number.isFinite(saved[k]))) return fit(saved);
  } catch { /* dùng vị trí mặc định */ }
  const w = Math.min(1180, window.innerWidth - 32);
  const h = Math.min(600, window.innerHeight - 96);
  return fit({ w, h, x: (window.innerWidth - w) / 2, y: window.innerHeight - h - 24 });
}

function downloadCsv(rows: string[][], name: string) {
  // Dấu ' chặn Excel hiểu nội dung bắt đầu bằng = + @ là công thức
  const cell = (v: string) => `"${(/^[=+@]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
  const text = String.fromCharCode(0xfeff) + rows.map((r) => r.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `do-hieu-nang-${name}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const PerfMonitorPopup: React.FC<{ onHide: () => void }> = ({ onHide }) => {
  const [rect, setRect] = useState<Rect>(readRect);
  const [maximized, setMaximized] = useState(false);
  const [tab, setTab] = useState(TABS[0].key);
  const [query, setQuery] = useState('');
  const [paused, setPaused] = useState(false);
  const [since, setSince] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const drag = useRef<{ handle: Handle; x: number; y: number; rect: Rect } | null>(null);
  const exporter = useRef<(() => Promise<string[][]> | string[][]) | null>(null);
  const setExporter = useCallback((fn: () => Promise<string[][]> | string[][]) => { exporter.current = fn; }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rect)); } catch { /* không lưu được thì thôi */ }
  }, [rect]);

  useEffect(() => {
    const onResize = () => setRect((r) => fit(r));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const startDrag = (handle: Handle) => (e: React.PointerEvent<HTMLElement>) => {
    if (maximized || e.button !== 0) return;
    if (handle === 'move' && (e.target as Element).closest('button')) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { handle, x: e.clientX, y: e.clientY, rect };
  };

  const onDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    const s = d.rect;
    if (d.handle === 'move') {
      setRect(fit({ ...s, x: s.x + dx, y: s.y + dy }));
      return;
    }
    // Cạnh đối diện đứng yên khi kéo
    const next = { ...s };
    const minW = Math.min(MIN_W, window.innerWidth);
    const minH = Math.min(MIN_H, window.innerHeight);
    if (d.handle.includes('e')) next.w = clamp(s.w + dx, minW, window.innerWidth - s.x);
    if (d.handle.includes('s')) next.h = clamp(s.h + dy, minH, window.innerHeight - s.y);
    if (d.handle.includes('w')) { next.w = clamp(s.w - dx, minW, s.x + s.w); next.x = s.x + s.w - next.w; }
    if (d.handle.includes('n')) { next.h = clamp(s.h - dy, minH, s.y + s.h); next.y = s.y + s.h - next.h; }
    setRect(next);
  };

  const endDrag = () => { drag.current = null; };
  const dragProps = (handle: Handle) => ({
    onPointerDown: startDrag(handle), onPointerMove: onDrag, onPointerUp: endDrag, onPointerCancel: endDrag,
  });

  const exportNow = async () => {
    if (!exporter.current) return;
    setExporting(true);
    setExportError('');
    try {
      downloadCsv(await exporter.current(), tab);
    } catch (e: any) {
      setExportError(e?.message || 'Không xuất được tệp');
    } finally {
      setExporting(false);
    }
  };

  const clearList = () => {
    if (tab === 'tasks') clearPerfTasks();
    setSince(Date.now());
  };

  const { View } = TABS.find((t) => t.key === tab) || TABS[0];

  return (
    <section
      className={`qk7perf${maximized ? ' is-max' : ''}`}
      style={maximized ? undefined : { left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
      data-perf-ignore
      role="dialog"
      aria-label="Bảng đo hiệu năng"
    >
      <header className="qk7perf-head" {...dragProps('move')} onDoubleClick={() => setMaximized((m) => !m)}>
        <strong>Đo hiệu năng</strong>
        <span className="qk7perf-muted">Ctrl+Shift+M để ẩn/hiện</span>
        <div className="qk7perf-head-actions">
          <button type="button" onClick={() => setMaximized((m) => !m)} aria-label={maximized ? 'Thu về kích thước cũ' : 'Phóng to toàn màn hình'} title={maximized ? 'Thu về kích thước cũ' : 'Phóng to'}>
            {maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button type="button" onClick={onHide} aria-label="Ẩn bảng đo" title="Ẩn bảng đo"><X size={16} /></button>
        </div>
      </header>

      <nav className="qk7perf-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'is-on' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>

      <div className="qk7perf-toolbar">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm trong bảng…" aria-label="Tìm trong bảng" />
        <button type="button" onClick={() => setPaused((p) => !p)} className={paused ? 'is-on' : ''}>
          {paused ? <Play size={14} /> : <Pause size={14} />}{paused ? 'Tiếp tục cập nhật' : 'Tạm dừng'}
        </button>
        {(tab === 'tasks' || tab === 'server') && (
          <button type="button" onClick={clearList}><Eraser size={14} />Xóa danh sách</button>
        )}
        <button type="button" onClick={exportNow} disabled={exporting}><Download size={14} />{exporting ? 'Đang xuất…' : 'Xuất CSV'}</button>
        {exportError && <span className="qk7perf-error">{exportError}</span>}
      </div>

      <div className="qk7perf-body">
        <View key={tab} query={query} paused={paused} since={since} setExporter={setExporter} />
      </div>

      {!maximized && HANDLES.map((h) => <div key={h} className={`qk7perf-grip is-${h}`} aria-hidden="true" {...dragProps(h)} />)}
    </section>
  );
};

export default PerfMonitorPopup;
