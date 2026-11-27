import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Search,
  X,
  FileText,
  MonitorPlay,
  Copy,
  ArrowUpDown,
  HardDrive,
} from 'lucide-react';
import { Header } from '../components/common/Header';
import { toast } from '../components/common/Toast';
import { PaginationBar } from '../components/common/PaginationBar';
import { usePageTransition } from '../components/common/PageTransitionStage';
import { TacticalEmptyState } from '../components/common/TacticalEmptyState';
import { SegmentedTabs } from '../components/common/SegmentedTabs';
import { documentsApi } from '../services/documentsApi';
import { useAuth } from '../hooks/useAuth';
import { DocumentItem } from '../types';
import { isApprovalRequired } from '../utils/approvalUtils';
import { formatFileSize } from '../utils/formatFileSize';
import { LectureTrashPanel } from '../components/lectures/LectureTrashPanel';
import { DuplicateDocumentsPanel } from '../components/document-desk/DuplicateDocumentsPanel';

export interface TrashPageProps {
  /** Khi true: render inline trong AdminDashboardPage (không có Header riêng, không min-h-screen) */
  embedded?: boolean;
}

export const TrashPage: React.FC<TrashPageProps> = ({ embedded = false }) => {
  const { hasPermission, user } = useAuth();
  const isAdminUser = (user?.roles || []).includes('ROL-01');

  // Tab: thùng rác Tài liệu | Bài giảng | Tài liệu trùng (2 tab sau chỉ Admin thấy)
  const [trashTab, setTrashTab] = useState<'docs' | 'lectures' | 'duplicates'>('docs');
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchLoading, setBatchLoading] = useState(false);
  const [animatingId, setAnimatingId] = useState<string | null>(null);

  // Tìm kiếm, lọc cấp mật, sắp xếp & chọn hàng loạt
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'standard' | 'classified'>('all');
  const [sortBy, setSortBy] = useState<'deleted_desc' | 'deleted_asc' | 'code_asc'>('deleted_desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Phân trang: tối đa 30 tài liệu / trang
  const ITEMS_PER_PAGE = 30;
  const [currentPage, setCurrentPage] = useState(1);

  const filteredDocs = useMemo(() => {
    let result = [...docs];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((d: any) =>
        (d.document_code || d.file_id || '').toLowerCase().includes(q) ||
        (d.title || '').toLowerCase().includes(q) ||
        (d.unit_name || '').toLowerCase().includes(q) ||
        (d.deleted_by_name || '').toLowerCase().includes(q) ||
        (d.deleted_reason || '').toLowerCase().includes(q)
      );
    }
    if (levelFilter === 'standard') {
      result = result.filter((d) => (d.security_level_id || 1) <= 2);
    } else if (levelFilter === 'classified') {
      result = result.filter((d) => (d.security_level_id || 1) >= 3);
    }
    result.sort((a: any, b: any) => {
      if (sortBy === 'code_asc') {
        return (a.document_code || a.file_id || '').localeCompare(b.document_code || b.file_id || '', 'vi');
      }
      const ta = a.deleted_at ? new Date(a.deleted_at).getTime() : 0;
      const tb = b.deleted_at ? new Date(b.deleted_at).getTime() : 0;
      return sortBy === 'deleted_asc' ? ta - tb : tb - ta;
    });
    return result;
  }, [docs, searchQuery, levelFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredDocs.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedDocs = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredDocs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredDocs, safePage]);
  const tbodyRef = usePageTransition<HTMLTableSectionElement>(safePage, { mode: 'row' });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, levelFilter, sortBy]);

  // Tổng dung lượng lưu trữ tạm trong thùng rác & đếm theo nhóm mật
  const totalBytes = useMemo(
    () => docs.reduce((acc, d: any) => acc + (Number(d.file_size || d.file_size_bytes) || 0), 0),
    [docs]
  );
  const classifiedCount = useMemo(
    () => docs.filter((d) => (d.security_level_id || 1) >= 3).length,
    [docs]
  );

  const selectedDocs = useMemo(
    () => docs.filter((d) => selectedIds.includes(d.file_id)),
    [docs, selectedIds]
  );

  const allOnPageSelected =
    paginatedDocs.length > 0 && paginatedDocs.every((d) => selectedIds.includes(d.file_id));

  const toggleSelectAllOnPage = () => {
    if (allOnPageSelected) {
      const pageIds = new Set(paginatedDocs.map((d) => d.file_id));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...paginatedDocs.map((d) => d.file_id)])));
    }
  };

  const toggleSelectOne = (fileId: string) => {
    setSelectedIds((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    );
  };

  // Modal Xóa Vĩnh Viễn (Hỗ trợ đơn lẻ, đã chọn, và dọn rỗng toàn bộ)
  const [purgeModal, setPurgeModal] = useState<{
    open: boolean;
    doc: DocumentItem | null;
    mode: 'single' | 'selected' | 'all';
  }>({
    open: false,
    doc: null,
    mode: 'single',
  });

  // Modal Khôi phục hàng loạt (tất cả hoặc đã chọn)
  const [restoreBatchModal, setRestoreBatchModal] = useState<{
    open: boolean;
    mode: 'selected' | 'all';
  }>({
    open: false,
    mode: 'all',
  });

  // Chuỗi xác nhận cho thao tác xóa vĩnh viễn hàng loạt (Double-safety verification)
  const [confirmKeyword, setConfirmKeyword] = useState('');

  // Tải danh sách tài liệu trong thùng rác
  const load = async () => {
    setLoading(true);
    try {
      const r = await documentsApi.getTrash();
      const items = r.items || [];
      setDocs(items);
      const existingIds = new Set(items.map((i) => i.file_id));
      setSelectedIds((prev) => prev.filter((id) => existingIds.has(id)));
      const newTotal = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
      setCurrentPage((prev) => (prev > newTotal ? newTotal : prev));
    } catch (err: any) {
      toast.error('Lỗi tải thùng rác: ' + (err.message || 'Lỗi không xác định'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Phím Escape đóng modal xác nhận
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (purgeModal.open) setPurgeModal({ open: false, doc: null, mode: 'single' });
        if (restoreBatchModal.open) setRestoreBatchModal({ open: false, mode: 'all' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [purgeModal.open, restoreBatchModal.open]);

  // ═══════════════════════════════════════════════════════════
  // 1. THAO TÁC KHÔI PHỤC ĐƠN LẺ
  // ═══════════════════════════════════════════════════════════
  const handleRestoreSingle = async (doc: DocumentItem) => {
    if (!doc.file_id) return;
    setAnimatingId(doc.file_id);

    try {
      const res: any = await documentsApi.restoreDocument(doc.file_id);

      if (isApprovalRequired(res)) {
        setAnimatingId(null);
        await load();
        return;
      }

      toast.success(`Đã khôi phục thành công văn bản: "${doc.title}"`, {
        title: 'KHÔI PHỤC THÀNH CÔNG',
        badge: 'RESTORED',
        duration: 3500,
      });

      setTimeout(() => {
        setDocs((prev) => prev.filter((item) => item.file_id !== doc.file_id));
        setSelectedIds((prev) => prev.filter((id) => id !== doc.file_id));
        setAnimatingId(null);
      }, 220);
    } catch (err: any) {
      setAnimatingId(null);
      toast.error('Lỗi khôi phục: ' + (err.message || 'Không thể khôi phục tài liệu'));
    }
  };

  // ═══════════════════════════════════════════════════════════
  // 2. THAO TÁC KHÔI PHỤC HÀNG LOẠT (TẤT CẢ HOẶC ĐÃ CHỌN)
  // ═══════════════════════════════════════════════════════════
  const handleRestoreBatchConfirm = async () => {
    const targets = restoreBatchModal.mode === 'selected' ? selectedDocs : docs;
    if (targets.length === 0) return;
    setBatchLoading(true);
    setRestoreBatchModal({ open: false, mode: 'all' });

    try {
      let successCount = 0;
      let pendingCount = 0;

      for (const d of targets) {
        try {
          const res: any = await documentsApi.restoreDocument(d.file_id);
          if (isApprovalRequired(res)) pendingCount++;
          else successCount++;
        } catch (e) {
          if (import.meta.env.DEV) console.warn('[RestoreBatch] Lỗi khôi phục tài liệu:', e);
        }
      }

      if (pendingCount > 0) {
        toast.success(
          `Đã khôi phục ${successCount}/${targets.length} tài liệu. ${pendingCount} tài liệu chờ phê duyệt.`,
          {
            title: 'HOÀN TẤT KHÔI PHỤC HÀNG LOẠT',
            badge: 'BATCH-RESTORE',
            duration: 4000,
          }
        );
      } else {
        toast.success(
          `Đã khôi phục thành công ${successCount}/${targets.length} tài liệu về vị trí lưu trữ.`,
          {
            title: 'HOÀN TẤT KHÔI PHỤC HÀNG LOẠT',
            badge: 'BATCH-RESTORE',
            duration: 4000,
          }
        );
      }

      setSelectedIds([]);
      await load();
    } catch (err: any) {
      toast.error('Lỗi trong quá trình khôi phục: ' + err.message);
    } finally {
      setBatchLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // 3. THAO TÁC XÓA VĨNH VIỄN (ĐƠN LẺ / ĐÃ CHỌN / DỌN RỖNG)
  // ═══════════════════════════════════════════════════════════
  const handlePurgeConfirm = async () => {
    if (purgeModal.mode === 'all' || purgeModal.mode === 'selected') {
      const targets = purgeModal.mode === 'selected' ? selectedDocs : docs;
      if (targets.length === 0) return;

      setBatchLoading(true);
      const isAllMode = purgeModal.mode === 'all';
      setPurgeModal({ open: false, doc: null, mode: 'single' });
      setConfirmKeyword('');

      try {
        let purgedCount = 0;
        let pendingCount = 0;

        for (const d of targets) {
          try {
            const res: any = await documentsApi.purgeDocument(d.file_id);
            if (isApprovalRequired(res)) pendingCount++;
            else purgedCount++;
          } catch (e) {
            if (import.meta.env.DEV) console.warn('[PurgeBatch] Lỗi xóa vĩnh viễn tài liệu:', e);
          }
        }

        if (pendingCount > 0) {
          toast.success(
            `Đã xóa vĩnh viễn ${purgedCount}/${targets.length} tài liệu. ${pendingCount} yêu cầu chờ phê duyệt.`,
            {
              title: isAllMode ? 'HOÀN TẤT DỌN RỖNG' : 'HOÀN TẤT XÓA HÀNG LOẠT',
              badge: 'PURGED-BATCH',
              duration: 4000,
            }
          );
        } else {
          toast.success(
            isAllMode
              ? `Đã dọn rỗng hoàn toàn thùng rác (${purgedCount} tài liệu đã bị xóa vĩnh viễn khỏi máy chủ).`
              : `Đã xóa vĩnh viễn ${purgedCount} tài liệu đã chọn khỏi máy chủ.`,
            {
              title: isAllMode ? 'ĐÃ DỌN RỖNG THÙNG RÁC' : 'ĐÃ XÓA VĨNH VIỄN',
              badge: isAllMode ? 'PURGED-ALL' : 'PURGED-BATCH',
              duration: 4000,
            }
          );
        }

        setSelectedIds([]);
        await load();
      } catch (err: any) {
        toast.error('Lỗi khi xóa vĩnh viễn: ' + err.message);
      } finally {
        setBatchLoading(false);
      }
    } else if (purgeModal.doc) {
      const targetDoc = purgeModal.doc;
      setAnimatingId(targetDoc.file_id);
      setPurgeModal({ open: false, doc: null, mode: 'single' });

      try {
        const res: any = await documentsApi.purgeDocument(targetDoc.file_id);

        if (isApprovalRequired(res)) {
          setAnimatingId(null);
          await load();
          return;
        }

        toast.success(`Đã xóa vĩnh viễn tệp PDF và dữ liệu của văn bản: "${targetDoc.title}".`, {
          title: 'ĐÃ XÓA VĨNH VIỄN',
          badge: 'PURGED',
          duration: 3500,
        });

        setTimeout(() => {
          setDocs((prev) => prev.filter((item) => item.file_id !== targetDoc.file_id));
          setSelectedIds((prev) => prev.filter((id) => id !== targetDoc.file_id));
          setAnimatingId(null);
        }, 220);
      } catch (err: any) {
        setAnimatingId(null);
        toast.error('Lỗi xóa vĩnh viễn: ' + (err.message || 'Không thể xóa tài liệu'));
      }
    }
  };

  // Helper Badge phân loại cấp độ mật chuẩn Quân đội (5 cấp)
  const renderSecurityBadge = (doc: any) => {
    const levelId = doc.security_level_id || 1;
    const levelName = doc.security_name || `Cấp ${levelId}`;

    switch (levelId) {
      case 1:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-semibold border bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700 whitespace-nowrap">
            {levelName}
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-semibold border bg-emerald-50 text-[#166534] border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/30 whitespace-nowrap">
            {levelName}
          </span>
        );
      case 3:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-semibold border bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/30 whitespace-nowrap">
            {levelName}
          </span>
        );
      case 4:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-semibold border bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-500/30 whitespace-nowrap">
            {levelName}
          </span>
        );
      case 5:
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-bold border bg-rose-50 text-[#b91c1c] border-rose-300 dark:bg-red-950/60 dark:text-rose-300 dark:border-rose-500/40 whitespace-nowrap">
            {levelName}
          </span>
        );
    }
  };

  const hasActiveFilter = Boolean(searchQuery.trim() || levelFilter !== 'all');
  const purgeTargetsCount =
    purgeModal.mode === 'selected' ? selectedDocs.length : purgeModal.mode === 'all' ? docs.length : 1;
  const requiresDoubleConfirm = purgeModal.mode === 'all' || purgeModal.mode === 'selected';

  // ═══════════════════════════════════════════════════════════
  // GIAO DIỆN NỘI DUNG CHÍNH — THÙNG RÁC TÀI LIỆU
  // ═══════════════════════════════════════════════════════════
  const pageContent = (
    <div className="space-y-4">
      {/* ── 1. EXECUTIVE COMMAND HEADER SURFACE ── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 border-l-4 border-l-[#b91c1c] dark:border-l-rose-500 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200/80 dark:border-rose-500/30 flex items-center justify-center shrink-0 text-[#b91c1c] dark:text-rose-400">
              <Trash2 className="w-5 h-5 stroke-[2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Thùng Rác Tài Liệu
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold font-mono tabular-nums bg-rose-50 dark:bg-rose-500/15 text-[#b91c1c] dark:text-rose-300 border border-rose-200/80 dark:border-rose-500/30">
                  {docs.length} tài liệu
                </span>
                {totalBytes > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold font-mono tabular-nums bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    <HardDrive className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                    {formatFileSize(totalBytes)}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Lưu giữ tạm thời các văn bản đã xóa mềm. Chỉ Quản trị viên mới có đặc quyền khôi phục hoặc xóa vĩnh viễn khỏi máy chủ.
              </p>
            </div>
          </div>

          {/* Cụm nút tác vụ cân đối (min-h-[38px], phẳng sắc nét theo TOKENS.md) */}
          <div className="flex items-center flex-wrap gap-2 shrink-0 self-stretch sm:self-start lg:self-center">
            <button
              type="button"
              disabled={loading || batchLoading}
              onClick={load}
              className="min-h-[38px] px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors duration-150 cursor-pointer active:scale-[0.98] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534] dark:focus-visible:ring-emerald-400"
              title="Đồng bộ lại danh sách thùng rác"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#166534] dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`} />
              <span>Làm mới</span>
            </button>

            {hasPermission('DOC_RESTORE') && (
              <button
                type="button"
                disabled={docs.length === 0 || loading || batchLoading}
                onClick={() => setRestoreBatchModal({ open: true, mode: 'all' })}
                className="min-h-[38px] px-3.5 py-2 rounded-xl border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/70 hover:bg-emerald-100/80 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-[#166534] dark:text-emerald-300 disabled:opacity-45 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1.5 transition-colors duration-150 cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534] dark:focus-visible:ring-emerald-400"
                title="Khôi phục toàn bộ tài liệu trong thùng rác về trạng thái lưu trữ"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Khôi phục tất cả</span>
              </button>
            )}

            {hasPermission('DOC_PURGE') && (
              <button
                type="button"
                disabled={docs.length === 0 || loading || batchLoading}
                onClick={() => {
                  setConfirmKeyword('');
                  setPurgeModal({ open: true, doc: null, mode: 'all' });
                }}
                className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#b91c1c] hover:bg-[#991b1b] dark:bg-rose-600 dark:hover:bg-rose-500 text-white disabled:opacity-45 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1.5 transition-colors duration-150 cursor-pointer shadow-xs active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b91c1c] focus-visible:ring-offset-2 dark:focus-visible:ring-rose-400 dark:focus-visible:ring-offset-[#111827]"
                title={
                  isAdminUser
                    ? 'Xóa vĩnh viễn toàn bộ tài liệu trong thùng rác (Không thể hoàn tác)'
                    : 'Gửi yêu cầu phê duyệt để xóa vĩnh viễn toàn bộ thùng rác'
                }
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Dọn rỗng thùng rác</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. SEARCH, CLEARANCE FILTER & SORT TOOLBAR ── */}
      <div className="p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo số hiệu, trích yếu, đơn vị, người xóa hoặc lý do xóa..."
            aria-label="Tìm kiếm tài liệu trong thùng rác"
            className="w-full min-h-[38px] pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#166534] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#166534]/15 dark:focus:ring-emerald-500/20 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Xóa từ khóa tìm kiếm"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Lọc nhóm độ mật */}
          <SegmentedTabs
            ariaLabel="Lọc theo cấp độ bảo mật"
            value={levelFilter}
            onChange={setLevelFilter}
            items={[
              { value: 'all', label: 'Tất cả', count: docs.length, activeTone: 'neutral' },
              { value: 'standard', label: 'Cấp 1–2', count: docs.length - classifiedCount, activeTone: 'emerald' },
              { value: 'classified', label: 'Mật (Cấp 3–5)', count: classifiedCount, activeTone: 'amber' },
            ]}
          />

          {/* Sắp xếp */}
          <div className="relative flex items-center">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'deleted_desc' | 'deleted_asc' | 'code_asc')}
              aria-label="Sắp xếp tài liệu trong thùng rác"
              className="min-h-[34px] pl-8 pr-3 py-1.5 text-[11px] font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#166534] dark:focus:border-emerald-500 cursor-pointer"
            >
              <option value="deleted_desc">Xóa gần nhất</option>
              <option value="deleted_asc">Xóa lâu nhất</option>
              <option value="code_asc">Số hiệu: A → Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── 3. TACTICAL DATA GRID & CONTEXTUAL BATCH BAR ── */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors duration-200">
        {/* Thanh hành động hàng loạt khi có dòng được chọn */}
        {selectedDocs.length > 0 && (
          <div className="px-4 py-2.5 bg-emerald-50/80 dark:bg-emerald-950/35 border-b border-emerald-200/80 dark:border-emerald-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-semibold text-[#166534] dark:text-emerald-300">
              <span>
                Đã chọn <strong className="font-mono tabular-nums">{selectedDocs.length}</strong> tài liệu
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-[11px] underline text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
              >
                Bỏ chọn
              </button>
            </div>
            <div className="flex items-center gap-2">
              {hasPermission('DOC_RESTORE') && (
                <button
                  type="button"
                  disabled={batchLoading}
                  onClick={() => setRestoreBatchModal({ open: true, mode: 'selected' })}
                  className="px-3 py-1.5 rounded-lg bg-[#166534] hover:bg-[#14532d] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Khôi phục đã chọn</span>
                </button>
              )}
              {hasPermission('DOC_PURGE') && (
                <button
                  type="button"
                  disabled={batchLoading}
                  onClick={() => {
                    setConfirmKeyword('');
                    setPurgeModal({ open: true, doc: null, mode: 'selected' });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#b91c1c] hover:bg-[#991b1b] dark:bg-rose-600 dark:hover:bg-rose-500 text-white font-semibold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa vĩnh viễn đã chọn</span>
                </button>
              )}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[1060px]">
            <thead className="bg-slate-50 dark:bg-slate-900/90 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 select-none">
              <tr>
                <th className="py-3.5 pl-4 pr-2 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    disabled={paginatedDocs.length === 0}
                    onChange={toggleSelectAllOnPage}
                    aria-label="Chọn tất cả tài liệu trên trang này"
                    className="w-3.5 h-3.5 rounded border-slate-300 text-[#166534] focus:ring-[#166534] cursor-pointer disabled:opacity-40"
                  />
                </th>
                <th className="py-3.5 px-3 w-40 whitespace-nowrap">Số hiệu</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Trích yếu &amp; chi tiết</th>
                <th className="py-3.5 px-3 w-28 whitespace-nowrap">Độ mật</th>
                <th className="py-3.5 px-3 w-44 whitespace-nowrap">Đơn vị</th>
                <th className="py-3.5 px-3 w-40 whitespace-nowrap">Xóa lúc</th>
                <th className="py-3.5 px-3 w-36 whitespace-nowrap">Người xóa</th>
                <th className="py-3.5 pl-3 pr-4 w-44 text-right whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody ref={tbodyRef} className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {loading && docs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2.5">
                      <RefreshCw className="w-6 h-6 animate-spin text-[#166534] dark:text-emerald-400" />
                      <span className="text-xs font-semibold">Đang đồng bộ dữ liệu thùng rác...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 px-4">
                    <TacticalEmptyState
                      title={hasActiveFilter ? 'Không tìm thấy tài liệu phù hợp' : 'Thùng rác tài liệu đang trống'}
                      description={
                        hasActiveFilter
                          ? 'Thử thay đổi từ khóa hoặc đặt lại bộ lọc độ mật để xem toàn bộ danh sách.'
                          : 'Không có tài liệu nào đang bị xóa mềm. Mọi văn bản bị xóa từ Trung tâm văn bản sẽ lưu tạm tại đây trước khi xử lý vĩnh viễn.'
                      }
                      icon={
                        hasActiveFilter ? (
                          <Search className="w-7 h-7 text-slate-400" />
                        ) : (
                          <CheckCircle2 className="w-7 h-7 text-[#166534] dark:text-emerald-400" />
                        )
                      }
                      onClearFilters={
                        hasActiveFilter
                          ? () => {
                              setSearchQuery('');
                              setLevelFilter('all');
                            }
                          : undefined
                      }
                      compact
                    />
                  </td>
                </tr>
              ) : (
                paginatedDocs.map((d: any) => {
                  const isDeleting = animatingId === d.file_id;
                  const isSelected = selectedIds.includes(d.file_id);
                  const sizeBytes = Number(d.file_size || d.file_size_bytes) || 0;
                  return (
                    <tr
                      key={d.file_id}
                      className={`group transition-colors duration-150 ${
                        isSelected
                          ? 'bg-emerald-50/50 dark:bg-emerald-500/[0.08]'
                          : 'hover:bg-slate-50/90 dark:hover:bg-slate-800/40'
                      } ${isDeleting ? 'opacity-0 transition-opacity duration-200' : ''}`}
                    >
                      {/* Checkbox chọn hàng loạt */}
                      <td className="py-3.5 pl-4 pr-2 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(d.file_id)}
                          aria-label={`Chọn văn bản ${d.document_code || d.file_id}`}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-[#166534] focus:ring-[#166534] cursor-pointer"
                        />
                      </td>

                      {/* 1. Cột Số hiệu */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-md font-mono tabular-nums text-xs font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-500/30 max-w-[150px] truncate"
                          title={d.document_code || d.file_id}
                        >
                          {d.document_code || d.file_id}
                        </span>
                      </td>

                      {/* 2. Cột Trích yếu & Metadata (dung lượng + lý do xóa) */}
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-[13px] text-slate-900 dark:text-white line-clamp-2 leading-snug" title={d.title}>
                          {d.title}
                        </div>
                        {(sizeBytes > 0 || d.deleted_reason) && (
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {sizeBytes > 0 && (
                              <span className="font-mono tabular-nums">{formatFileSize(sizeBytes)}</span>
                            )}
                            {sizeBytes > 0 && d.deleted_reason && <span className="text-slate-300 dark:text-slate-700">•</span>}
                            {d.deleted_reason && (
                              <span className="truncate max-w-[260px]" title={d.deleted_reason}>
                                Lý do: {d.deleted_reason}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 3. Cột Độ mật */}
                      <td className="py-3.5 px-3">{renderSecurityBadge(d)}</td>

                      {/* 4. Cột Đơn vị */}
                      <td className="py-3.5 px-3 text-slate-600 dark:text-slate-300">
                        <span className="truncate block max-w-[165px]" title={d.unit_name || '—'}>
                          {d.unit_name || '—'}
                        </span>
                      </td>

                      {/* 5. Cột Xóa lúc */}
                      <td className="py-3.5 px-3 font-mono tabular-nums text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {d.deleted_at ? new Date(d.deleted_at).toLocaleString('vi-VN') : '—'}
                      </td>

                      {/* 6. Cột Người xóa */}
                      <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap font-medium">
                        {d.deleted_by_name || '—'}
                      </td>

                      {/* 7. Cột Thao tác */}
                      <td className="py-3.5 pl-3 pr-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {hasPermission('DOC_RESTORE') && (
                            <button
                              type="button"
                              onClick={() => handleRestoreSingle(d)}
                              disabled={isDeleting || batchLoading}
                              className="min-h-[32px] px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/70 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-[#166534] dark:text-emerald-300 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer active:scale-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534]"
                              title="Khôi phục tài liệu về kho lưu trữ"
                              aria-label={`Khôi phục tài liệu ${d.document_code || d.file_id}`}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Khôi phục</span>
                            </button>
                          )}

                          {hasPermission('DOC_PURGE') && (
                            <button
                              type="button"
                              onClick={() => setPurgeModal({ open: true, doc: d, mode: 'single' })}
                              disabled={isDeleting || batchLoading}
                              className={`min-h-[32px] min-w-[32px] px-2 py-1 rounded-lg border text-[11px] font-semibold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer active:scale-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 ${
                                isAdminUser
                                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-700/50 text-[#b91c1c] dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 focus-visible:ring-[#b91c1c]'
                                  : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 focus-visible:ring-amber-500'
                              }`}
                              title={
                                isAdminUser
                                  ? 'Xóa vĩnh viễn khỏi máy chủ (Không thể hoàn tác)'
                                  : 'Yêu cầu quyền Admin để xóa vĩnh viễn — bấm để gửi yêu cầu phê duyệt'
                              }
                              aria-label={isAdminUser ? 'Xóa vĩnh viễn' : 'Yêu cầu duyệt xóa vĩnh viễn'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Chân bảng & Phân trang 30 tài liệu / trang */}
        {filteredDocs.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
            <div>
              Hiển thị{' '}
              <strong className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                {(safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filteredDocs.length)}
              </strong>{' '}
              trên tổng số{' '}
              <strong className="font-mono tabular-nums font-bold text-[#b91c1c] dark:text-rose-400">
                {filteredDocs.length}
              </strong>{' '}
              tài liệu đã xóa
              {totalPages > 1 && (
                <span className="ml-1.5 text-slate-500 dark:text-slate-400">
                  (Trang <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">{safePage}/{totalPages}</span>)
                </span>
              )}
            </div>
            {totalPages > 1 && (
              <PaginationBar
                currentPage={safePage}
                totalPages={totalPages}
                onPageChange={(p) => setCurrentPage(p)}
                ariaLabel="Phân trang thùng rác tài liệu"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // 4. MODAL CẢNH BÁO NGUY HIỂM: XÓA VĨNH VIỄN (ĐỎ QUÂN KỲ #b91c1c)
  // ═══════════════════════════════════════════════════════════
  const dangerPurgeModal = (
    <AnimatePresence>
      {purgeModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
          onClick={() => setPurgeModal({ open: false, doc: null, mode: 'single' })}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-[#0c1420] border border-rose-300 dark:border-rose-500/40 rounded-2xl p-6 shadow-2xl relative text-left"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center text-[#b91c1c] dark:text-rose-400 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-base text-[#b91c1c] dark:text-rose-400 tracking-tight">
                    {purgeModal.mode === 'all'
                      ? 'Dọn Rỗng Toàn Bộ Thùng Rác'
                      : purgeModal.mode === 'selected'
                      ? `Xóa Vĩnh Viễn ${selectedDocs.length} Tài Liệu Đã Chọn`
                      : 'Xác Nhận Xóa Vĩnh Viễn'}
                  </h3>
                  <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 block mt-0.5">
                    SEC-PURGE-CONFIRM
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPurgeModal({ open: false, doc: null, mode: 'single' })}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                aria-label="Đóng hộp thoại"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-rose-50 dark:bg-rose-950/35 border border-rose-200 dark:border-rose-500/30 rounded-xl p-3.5 mb-4 text-xs text-rose-800 dark:text-rose-300 leading-relaxed space-y-1.5">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#b91c1c] dark:text-rose-400" />
                <span>{isAdminUser ? 'Hành động không thể hoàn tác' : 'Gửi yêu cầu phê duyệt'}</span>
              </p>
              <p>
                {!isAdminUser ? (
                  requiresDoubleConfirm
                    ? `Yêu cầu xóa vĩnh viễn ${purgeTargetsCount} tài liệu sẽ được gửi tới Quản trị viên tối cao phê duyệt. Dữ liệu hiện chưa bị xóa.`
                    : `Yêu cầu xóa vĩnh viễn văn bản "${purgeModal.doc?.title}" (${purgeModal.doc?.document_code || purgeModal.doc?.file_id}) sẽ được gửi tới Quản trị viên tối cao phê duyệt.`
                ) : requiresDoubleConfirm ? (
                  `Toàn bộ ${purgeTargetsCount} tài liệu cùng các tệp PDF gốc trên máy chủ sẽ bị xóa vĩnh viễn và không thể khôi phục.`
                ) : (
                  `Tệp PDF vật lý và bản ghi của văn bản "${purgeModal.doc?.title}" (${purgeModal.doc?.document_code || purgeModal.doc?.file_id}) sẽ bị xóa vĩnh viễn khỏi máy chủ.`
                )}
              </p>
            </div>

            {requiresDoubleConfirm && (
              <div className="mb-5 space-y-1.5">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Nhập chính xác <span className="font-mono text-[#b91c1c] dark:text-rose-400 font-bold">XAC NHAN XOA</span> để xác nhận:
                </label>
                <input
                  type="text"
                  value={confirmKeyword}
                  onChange={(e) => setConfirmKeyword(e.target.value)}
                  placeholder="XAC NHAN XOA"
                  className="w-full min-h-[38px] px-3 py-2 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-[#b91c1c] focus:ring-2 focus:ring-rose-500/20"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPurgeModal({ open: false, doc: null, mode: 'single' })}
                className="min-h-[38px] px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={requiresDoubleConfirm && confirmKeyword.trim() !== 'XAC NHAN XOA'}
                onClick={handlePurgeConfirm}
                className="min-h-[38px] px-4 py-2 bg-[#b91c1c] hover:bg-[#991b1b] dark:bg-rose-600 dark:hover:bg-rose-500 text-white font-semibold rounded-xl text-xs shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {purgeModal.mode === 'all'
                    ? isAdminUser
                      ? 'Dọn rỗng vĩnh viễn'
                      : 'Gửi yêu cầu dọn rỗng'
                    : purgeModal.mode === 'selected'
                    ? isAdminUser
                      ? `Xóa vĩnh viễn (${selectedDocs.length})`
                      : 'Gửi yêu cầu xóa'
                    : isAdminUser
                    ? 'Xóa vĩnh viễn'
                    : 'Gửi yêu cầu xóa'}
                </span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  // ═══════════════════════════════════════════════════════════
  // 5. MODAL XÁC NHẬN: KHÔI PHỤC HÀNG LOẠT
  // ═══════════════════════════════════════════════════════════
  const restoreBatchCount = restoreBatchModal.mode === 'selected' ? selectedDocs.length : docs.length;
  const restoreAllConfirmModal = (
    <AnimatePresence>
      {restoreBatchModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
          onClick={() => setRestoreBatchModal({ open: false, mode: 'all' })}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-[#0c1420] border border-emerald-200 dark:border-emerald-500/40 rounded-2xl p-6 shadow-2xl relative text-left"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-[#166534] dark:text-emerald-400">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {restoreBatchModal.mode === 'selected'
                  ? 'Khôi phục tài liệu đã chọn'
                  : 'Khôi phục tất cả tài liệu'}
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">
              Đồng chí có chắc chắn muốn khôi phục{' '}
              <strong className="font-mono tabular-nums text-[#166534] dark:text-emerald-400">
                {restoreBatchCount} tài liệu
              </strong>{' '}
              trong thùng rác trở lại kho lưu trữ ban đầu?
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestoreBatchModal({ open: false, mode: 'all' })}
                className="min-h-[36px] px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleRestoreBatchConfirm}
                className="min-h-[36px] px-4 py-2 bg-[#166534] hover:bg-[#14532d] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs transition cursor-pointer shadow-xs flex items-center gap-1.5 active:scale-[0.98]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Khôi phục ({restoreBatchCount})</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  // ═══════════════════════════════════════════════════════════
  // 6. SEGMENTED TAB STRIP (TÀI LIỆU | BÀI GIẢNG | TÀI LIỆU TRÙNG)
  // ═══════════════════════════════════════════════════════════
  const tabbedContent = (
    <div className="space-y-4">
      {isAdminUser && (
        <SegmentedTabs
          ariaLabel="Phân mục thùng rác và đối soát"
          size="md"
          surface="card"
          value={trashTab}
          onChange={setTrashTab}
          items={[
            {
              value: 'docs',
              label: 'Tài liệu',
              icon: <FileText className="w-3.5 h-3.5 shrink-0" />,
              badge: docs.length,
              activeTone: 'emerald',
            },
            {
              value: 'lectures',
              label: 'Bài giảng',
              icon: <MonitorPlay className="w-3.5 h-3.5 shrink-0" />,
              activeTone: 'emerald',
            },
            {
              value: 'duplicates',
              label: 'Tài liệu trùng',
              icon: <Copy className="w-3.5 h-3.5 shrink-0" />,
              activeTone: 'emerald',
            },
          ]}
        />
      )}

      {trashTab === 'lectures' && isAdminUser ? (
        <LectureTrashPanel />
      ) : trashTab === 'duplicates' && isAdminUser ? (
        <DuplicateDocumentsPanel />
      ) : (
        pageContent
      )}
    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-4">
        {tabbedContent}
        {dangerPurgeModal}
        {restoreAllConfirmModal}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 dark:bg-slate-950 flex flex-col font-sans transition-colors duration-200">
      <Header activeNav="admin" title="Trường Quân Sự Quân Khu 7" subtitle="Thùng rác tài liệu" />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-5">
        {tabbedContent}
      </main>

      {dangerPurgeModal}
      {restoreAllConfirmModal}
    </div>
  );
};

export default TrashPage;
