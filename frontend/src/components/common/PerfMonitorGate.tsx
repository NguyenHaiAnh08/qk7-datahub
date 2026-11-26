/**
 * Cổng hiển thị bảng đo hiệu năng: chỉ Quản trị viên (ROL-01) thấy nút mở.
 * Máy chủ kiểm tra lại quyền ở mọi API /api/admin/perf. Mã của bảng chỉ được tải khi mở.
 */
import React, { Suspense, useEffect, useState } from 'react';
import { Gauge } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import './PerfMonitorGate.css';

const PerfMonitorPopup = React.lazy(() => import('./PerfMonitorPopup'));
const OPEN_KEY = 'qk7_perf_open';

export const PerfMonitorGate: React.FC = () => {
  const { hasRole } = useAuth();
  const allowed = hasRole('ROL-01');
  const [open, setOpen] = useState<boolean>(() => {
    try { return sessionStorage.getItem(OPEN_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    try { sessionStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch { /* bỏ qua */ }
  }, [open]);

  useEffect(() => {
    if (!allowed) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyM') { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [allowed]);

  if (!allowed) return null;
  if (!open) {
    return (
      <button type="button" className="qk7perf-launch" data-perf-ignore onClick={() => setOpen(true)} title="Mở bảng đo hiệu năng (Ctrl+Shift+M)">
        <Gauge size={18} /><span>Đo hiệu năng</span>
      </button>
    );
  }
  return (
    <Suspense fallback={null}>
      <PerfMonitorPopup onHide={() => setOpen(false)} />
    </Suspense>
  );
};
