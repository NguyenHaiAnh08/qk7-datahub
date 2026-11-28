import { useCallback, useEffect, useRef, useState } from 'react';
import { libraryService } from '../services/libraryService';
import type { ReadingProgress } from '../components/common/DocumentReadingRing';

/** Phát sau mỗi lần lưu xong để trang thống kê / lịch sử tải lại */
export const READING_SAVED_EVENT = 'qk7:library-reading-saved';
// Chờ người đọc dừng cuộn rồi mới ghi, tránh gửi liên tục
const SAVE_DELAY_MS = 1200;

interface Snapshot {
  fileId: string;
  page: number;
  total: number;
  completed: boolean;
}

/**
 * Lưu và khôi phục trang đang đọc của một tài liệu thư viện (lưu trên máy chủ, theo từng tài khoản).
 * enabled = false (Đại biểu, hoặc không phải tài liệu thư viện) thì không làm gì.
 */
export function useLibraryReading(fileId: string | undefined, enabled: boolean) {
  const active = Boolean(enabled && fileId);
  const [resume, setResume] = useState<{ fileId: string; page: number | null } | null>(null);
  const pending = useRef<Snapshot | null>(null);
  const lastSent = useRef('');
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback((keepalive = false) => {
    window.clearTimeout(timer.current);
    const snap = pending.current;
    pending.current = null;
    if (!snap) return;
    const key = `${snap.fileId}|${snap.page}|${snap.total}|${snap.completed}`;
    if (key === lastSent.current) return;
    lastSent.current = key;
    libraryService
      .saveReading(snap.fileId, { page: snap.page, total_pages: snap.total, completed: snap.completed }, keepalive)
      .then(() => window.dispatchEvent(new CustomEvent(READING_SAVED_EVENT)))
      .catch(() => { lastSent.current = ''; }); // mất kết nối: lần đổi trang sau sẽ ghi lại
  }, []);

  useEffect(() => {
    if (!active || !fileId) return undefined;
    let cancelled = false;
    lastSent.current = '';
    libraryService
      .getReading(fileId)
      .then((res) => { if (!cancelled) setResume({ fileId, page: res.progress?.last_page ?? null }); })
      .catch(() => { if (!cancelled) setResume({ fileId, page: null }); });
    // Đóng tab / tải lại trang khi đang đọc
    const onHide = () => flush(true);
    window.addEventListener('pagehide', onHide);
    return () => {
      cancelled = true;
      window.removeEventListener('pagehide', onHide);
      flush(true); // đóng tài liệu: ghi ngay trang cuối cùng
      setResume(null);
    };
  }, [active, fileId, flush]);

  const report = useCallback((progress: ReadingProgress) => {
    if (!active || !fileId || !progress.totalPages) return;
    pending.current = {
      fileId,
      page: Math.min(Math.max(1, progress.currentPage), progress.totalPages),
      total: progress.totalPages,
      completed: Boolean(progress.isCompleted),
    };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => flush(), SAVE_DELAY_MS);
  }, [active, fileId, flush]);

  /** ready = đã biết trang cần mở; trình đọc chỉ được dựng sau đó */
  const ready = !active || resume?.fileId === fileId;
  return { ready, resumePage: active && ready ? resume?.page ?? null : null, report };
}
