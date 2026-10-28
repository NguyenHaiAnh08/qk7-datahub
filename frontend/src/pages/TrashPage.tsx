<<<<<<< HEAD
import React, { useEffect, useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { Tooltip } from 'antd';
import { Header } from '../components/common/Header';
import { Toast, ToastState } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { documentsApi } from '../services/documentsApi';
import { useAuth } from '../hooks/useAuth';
import { DocumentItem } from '../types';
import { isApprovalRequired } from '../utils/approvalUtils';

export interface TrashPageProps {
  /** Khi true: render inline trong AdminDashboardPage (không có Header riêng, không min-h-screen) */
  embedded?: boolean;
}

export const TrashPage: React.FC<TrashPageProps> = ({ embedded = false }) => {
  const { hasPermission, user } = useAuth();
  const isAdminUser = (user?.roles || []).includes('ROL-01');
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<{
    open: boolean;
    doc: DocumentItem | null;
    mode: 'restore' | 'purge';
  }>({
    open: false,
    doc: null,
    mode: 'restore',
  });
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'success' });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast((p) => ({ ...p, show: false })), 2800);
  };

  const load = async () => {
    setLoading(true);
    try {
      const r = await documentsApi.getTrash();
      setDocs(r.items || []);
    } catch (err: any) {
      showToast('Lỗi tải thùng rác: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAction = async () => {
  if (!confirm.doc) return;
  try {
    let res: any;
    if (confirm.mode === 'restore') {
      res = await documentsApi.restoreDocument(confirm.doc.file_id);
    } else {
      res = await documentsApi.purgeDocument(confirm.doc.file_id);
    }

    // ✅ Nếu bị APPROVAL_REQUIRED → ApprovalListener đã toast "chờ duyệt" — không báo success
    if (isApprovalRequired(res)) {
      setConfirm({ open: false, doc: null, mode: 'restore' });
      load();
      return;
    }

    // Chỉ báo success khi thao tác thực sự hoàn tất
    showToast(
      confirm.mode === 'restore'
        ? `Đã khôi phục: ${confirm.doc.title}`
        : `Đã xóa vĩnh viễn: ${confirm.doc.title}`,
      'success'
    );
    setConfirm({ open: false, doc: null, mode: 'restore' });
    load();
  } catch (err: any) {
    showToast('Lỗi: ' + err.message, 'error');
  }
};

  // ═══════════════════════════════════════════════════════════
  // CONTENT (dùng chung cho cả 2 layout)
  // ═══════════════════════════════════════════════════════════
  const pageContent = (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Trash2 className="w-6 h-6 text-rose-500" />
            Thùng Rác Tài Liệu
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {docs.length} tài liệu đã xóa mềm. Chỉ Admin được xóa vĩnh viễn.
          </p>
        </div>
        <button
          onClick={load}
          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer"
        >
          Làm mới
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[720px]">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Số hiệu</th>
                <th className="py-3 px-4">Trích yếu</th>
                <th className="py-3 px-4">Độ mật</th>
                <th className="py-3 px-4">Đơn vị</th>
                <th className="py-3 px-4">Xóa lúc</th>
                <th className="py-3 px-4">Người xóa</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Đang tải...
                  </td>
                </tr>
              ) : docs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Thùng rác trống
                  </td>
                </tr>
              ) : (
                docs.map((d: any) => (
                  <tr
                    key={d.file_id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-amber-600 dark:text-amber-400">
                      {d.document_code || d.file_id}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                      {d.title}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] px-2 py-0.5 rounded border bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-500/30">
                        {d.security_name || `Cấp ${d.security_level_id}`}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {d.unit_name || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {d.deleted_at ? new Date(d.deleted_at).toLocaleString('vi-VN') : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {d.deleted_by_name || '—'}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {hasPermission('DOC_RESTORE') && (
                        <button
                          onClick={() => setConfirm({ open: true, doc: d, mode: 'restore' })}
                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/30 cursor-pointer"
                          title="Khôi phục"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {hasPermission('DOC_PURGE') && (() => {
                        const needsApproval = !isAdminUser;
                        const tooltip = needsApproval
                          ? '⚠️ Yêu cầu quyền Admin để xóa vĩnh viễn — bấm để gửi yêu cầu phê duyệt'
                          : 'Xóa vĩnh viễn khỏi hệ thống (không thể hoàn tác)';

                        return (
                          <Tooltip title={tooltip} placement="top" arrow>
                            <button
                              type="button"
                              onClick={() => setConfirm({ open: true, doc: d, mode: 'purge' })}
                              aria-label={needsApproval ? 'Yêu cầu phê duyệt xóa vĩnh viễn' : 'Xóa vĩnh viễn'}
                              className={`p-1.5 rounded-lg transition-all duration-200 ease-[cubic-bezier(.34,1.45,.64,1)] cursor-pointer active:scale-95 ${
                                needsApproval
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-400 dark:border-slate-700 hover:text-amber-600 dark:hover:text-amber-400'
                                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-500/30'
                              }`}
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>
                        );
                      })()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  // ═══════════════════════════════════════════════════════════
  // Dialog (dùng chung + fix BUG #5: isDestructive chỉ khi purge)
  // ═══════════════════════════════════════════════════════════
  const confirmDialog = (
  <ConfirmDialog
    open={confirm.open}
    title={confirm.mode === 'restore' ? 'Khôi phục tài liệu' : 'XÓA VĨNH VIỄN'}
    message={
      confirm.mode === 'restore'
        ? `Khôi phục "${confirm.doc?.title}"?`
        : isAdminUser
          ? `CẢNH BÁO: File PDF vật lý sẽ bị xóa vĩnh viễn khỏi ổ đĩa. Không thể hoàn tác. Xác nhận xóa "${confirm.doc?.title}"?`
          : `Hành động này cần Quản trị viên tối cao phê duyệt. Yêu cầu xóa vĩnh viễn "${confirm.doc?.title}" sẽ được gửi đi thay vì thực hiện ngay.`
    }
    confirmText={confirm.mode === 'restore' ? 'Khôi phục' : 'Xóa vĩnh viễn'}
    confirmVariant={confirm.mode === 'restore' ? 'primary' : 'danger'}
    isDestructive={confirm.mode !== 'restore'}
    onConfirm={handleAction}
    onCancel={() => setConfirm({ open: false, doc: null, mode: 'restore' })}
  />
);

  // ═══════════════════════════════════════════════════════════
  // EMBEDDED LAYOUT
  // ═══════════════════════════════════════════════════════════
  if (embedded) {
    return (
      <div className="space-y-5">
        {pageContent}
        {confirmDialog}
        <Toast toast={toast} onClose={() => setToast((p) => ({ ...p, show: false }))} />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // STANDALONE LAYOUT
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Header activeNav="admin" title="QK7 DATAHUB" subtitle="Thùng rác tài liệu" />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-5">
        {pageContent}
      </main>

      {confirmDialog}
      <Toast toast={toast} onClose={() => setToast((p) => ({ ...p, show: false }))} />
    </div>
  );
};

export default TrashPage;
=======
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  RefreshCw,
  FileText,
  ShieldAlert,
  Clock,
  Building,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
} from 'lucide-react';
import { Header } from '../components/common/Header';
import { toast } from '../components/common/Toast';
import { documentsApi } from '../services/documentsApi';
import { useAuth } from '../hooks/useAuth';
import { DocumentItem } from '../types';

export interface TrashPageProps {
  /** Khi true: render inline trong AdminDashboardPage (không có Header riêng, không min-h-screen) */
  embedded?: boolean;
}

export const TrashPage: React.FC<TrashPageProps> = ({ embedded = false }) => {
  const { hasPermission } = useAuth();
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchLoading, setBatchLoading] = useState(false);
  const [animatingId, setAnimatingId] = useState<string | null>(null);

  // Modal Xóa Vĩnh Viễn (Hỗ trợ xác nhận 2 bước)
  const [purgeModal, setPurgeModal] = useState<{
    open: boolean;
    doc: DocumentItem | null;
    isAll: boolean;
  }>({
    open: false,
    doc: null,
    isAll: false,
  });

  // Modal Khôi phục tất cả
  const [restoreAllModal, setRestoreAllModal] = useState(false);

  // Chuỗi xác nhận cho thao tác Dọn rỗng toàn bộ thùng rác (Double-safety verification)
  const [confirmKeyword, setConfirmKeyword] = useState('');

  // Tải danh sách tài liệu trong thùng rác
  const load = async () => {
    setLoading(true);
    try {
      const r = await documentsApi.getTrash();
      setDocs(r.items || []);
    } catch (err: any) {
      toast.error('Lỗi tải thùng rác: ' + (err.message || 'Lỗi không xác định'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ═══════════════════════════════════════════════════════════
  // 1. THAO TÁC KHÔI PHỤC ĐƠN LẺ (Kèm hiệu ứng mờ dần và trượt sang trái)
  // ═══════════════════════════════════════════════════════════
  const handleRestoreSingle = async (doc: DocumentItem) => {
    if (!doc.file_id) return;
    setAnimatingId(doc.file_id);

    try {
      await documentsApi.restoreDocument(doc.file_id);
      // Hiển thị Animated Toast màu Xanh Lục Quân
      toast.success(`Đã khôi phục thành công văn bản: "${doc.title}"`, {
        title: 'KHÔI PHỤC THÀNH CÔNG',
        badge: 'RESTORED',
        duration: 3500,
      });

      // Cho hiệu ứng kết thúc trước khi loại bỏ khỏi danh sách cục bộ
      setTimeout(() => {
        setDocs((prev) => prev.filter((item) => item.file_id !== doc.file_id));
        setAnimatingId(null);
      }, 250);
    } catch (err: any) {
      setAnimatingId(null);
      toast.error('Lỗi khôi phục: ' + (err.message || 'Không thể khôi phục tài liệu'));
    }
  };

  // ═══════════════════════════════════════════════════════════
  // 2. THAO TÁC KHÔI PHỤC TẤT CẢ (BATCH RESTORE)
  // ═══════════════════════════════════════════════════════════
  const handleRestoreAllConfirm = async () => {
    if (docs.length === 0) return;
    setBatchLoading(true);
    setRestoreAllModal(false);

    try {
      let successCount = 0;
      for (const d of docs) {
        try {
          await documentsApi.restoreDocument(d.file_id);
          successCount++;
        } catch (e) {
          console.warn(`[RestoreAll] Failed for fileId ${d.file_id}`, e);
        }
      }

      toast.success(`Đã khôi phục thành công toàn bộ ${successCount}/${docs.length} tài liệu về vị trí lưu trữ!`, {
        title: 'HOÀN TẤT KHÔI PHỤC HÀNG LOẠT',
        badge: 'BATCH-RESTORE',
        duration: 4000,
      });

      await load();
    } catch (err: any) {
      toast.error('Lỗi trong quá trình khôi phục: ' + err.message);
    } finally {
      setBatchLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // 3. THAO TÁC XÓA VĨNH VIỄN (PURGE - ĐƠN LẺ & DỌN RỖNG)
  // ═══════════════════════════════════════════════════════════
  const handlePurgeConfirm = async () => {
    if (purgeModal.isAll) {
      // Dọn rỗng toàn bộ thùng rác
      setBatchLoading(true);
      setPurgeModal({ open: false, doc: null, isAll: false });
      setConfirmKeyword('');

      try {
        let purgedCount = 0;
        for (const d of docs) {
          try {
            await documentsApi.purgeDocument(d.file_id);
            purgedCount++;
          } catch (e) {
            console.warn(`[PurgeAll] Failed for fileId ${d.file_id}`, e);
          }
        }

        toast.success(`Đã dọn rỗng hoàn toàn thùng rác (${purgedCount} tài liệu đã bị xóa vĩnh viễn khỏi máy chủ).`, {
          title: 'ĐÃ DỌN RỖNG THÙNG RÁC',
          badge: 'PURGED-ALL',
          duration: 4000,
        });

        await load();
      } catch (err: any) {
        toast.error('Lỗi khi dọn rỗng thùng rác: ' + err.message);
      } finally {
        setBatchLoading(false);
      }
    } else if (purgeModal.doc) {
      // Xóa vĩnh viễn đơn lẻ 1 tài liệu
      const targetDoc = purgeModal.doc;
      setAnimatingId(targetDoc.file_id);
      setPurgeModal({ open: false, doc: null, isAll: false });

      try {
        await documentsApi.purgeDocument(targetDoc.file_id);
        toast.success(`Đã xóa vĩnh viễn tệp PDF và dữ liệu của văn bản: "${targetDoc.title}".`, {
          title: 'ĐÃ XÓA VĨNH VIỄN',
          badge: 'PURGED',
          duration: 3500,
        });

        setTimeout(() => {
          setDocs((prev) => prev.filter((item) => item.file_id !== targetDoc.file_id));
          setAnimatingId(null);
        }, 250);
      } catch (err: any) {
        setAnimatingId(null);
        toast.error('Lỗi xóa vĩnh viễn: ' + (err.message || 'Không thể xóa tài liệu'));
      }
    }
  };

  // Helper Badge phân loại cấp độ mật chuẩn Quân đội
  const renderSecurityBadge = (doc: any) => {
    const levelId = doc.security_level_id || 1;
    const levelName = doc.security_name || `Cấp ${levelId}`;

    switch (levelId) {
      case 1:
        // Cấp 1: Công khai (Xám trung tính / Xanh nhạt)
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700 whitespace-nowrap">
            {levelName}
          </span>
        );
      case 2:
        // Cấp 2: Nội bộ (Xanh dương, KHÔNG dùng viền đỏ)
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-500/30 whitespace-nowrap">
            {levelName}
          </span>
        );
      case 3:
        // Cấp 3: Mật (Vàng Kim Quân Hiệu #fbbf24)
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/30 whitespace-nowrap">
            {levelName}
          </span>
        );
      case 4:
        // Cấp 4: Tối mật (Đỏ thắm Quân đội)
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-500/40 whitespace-nowrap">
            {levelName}
          </span>
        );
      case 5:
      default:
        // Cấp 5: Tuyệt mật (Đỏ Quân Kỳ Đậm)
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold border bg-red-100 text-red-800 border-red-300 dark:bg-red-950/70 dark:text-red-300 dark:border-red-500/50 whitespace-nowrap">
            {levelName}
          </span>
        );
    }
  };

  // ═══════════════════════════════════════════════════════════
  // GIAO DIỆN NỘI DUNG CHÍNH (CONTENT)
  // ═══════════════════════════════════════════════════════════
  const pageContent = (
    <>
      {/* 1. Header Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5 text-rose-500 dark:text-rose-400" />
            </div>
            <span>Thùng Rác Tài Liệu</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {docs.length} tài liệu đã xóa mềm. Chỉ Quản trị viên mới có đặc quyền xóa vĩnh viễn hoặc khôi phục.
          </p>
        </div>

        {/* Cụm 3 nút hành động: Khôi phục tất cả + Dọn rỗng + Làm mới */}
        <div className="flex items-center flex-wrap gap-2 shrink-0">
          {/* Nút Ghost viền Xanh Lục Quân: Khôi phục tất cả */}
          {hasPermission('DOC_RESTORE') && (
            <button
              type="button"
              disabled={docs.length === 0 || loading || batchLoading}
              onClick={() => setRestoreAllModal(true)}
              className="px-3.5 py-2 rounded-xl border border-emerald-500/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/15 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 select-none"
              title="Khôi phục toàn bộ tài liệu trong thùng rác về trạng thái lưu trữ"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Khôi phục tất cả</span>
            </button>
          )}

          {/* Nút Đỏ Quân Kỳ: Dọn rỗng thùng rác */}
          {hasPermission('DOC_PURGE') && (
            <button
              type="button"
              disabled={docs.length === 0 || loading || batchLoading}
              onClick={() => {
                setConfirmKeyword('');
                setPurgeModal({ open: true, doc: null, isAll: true });
              }}
              className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 select-none"
              title="Xóa vĩnh viễn toàn bộ tài liệu trong thùng rác (Không thể hoàn tác)"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Dọn rỗng thùng rác</span>
            </button>
          )}

          {/* Nút Làm mới: Xám trung tính có viền */}
          <button
            type="button"
            disabled={loading || batchLoading}
            onClick={load}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700/90 border border-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer select-none"
            title="Tải lại danh sách thùng rác"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* 2. Bảng Dữ Liệu High-craft Data Grid */}
      <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-200">
        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full text-xs text-left min-w-[1150px]">
            <colgroup>
              <col style={{ width: '160px' }} />
              <col style={{ width: '260px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '160px' }} />
              <col style={{ width: '180px' }} />
              <col style={{ width: '140px' }} />
              <col style={{ width: '140px' }} />
            </colgroup>
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800/80">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">Số hiệu</th>
                <th className="py-3 px-4 whitespace-nowrap">Trích yếu</th>
                <th className="py-3 px-4 whitespace-nowrap">Độ mật</th>
                <th className="py-3 px-4 whitespace-nowrap">Đơn vị</th>
                <th className="py-3 px-4 whitespace-nowrap">Xóa lúc</th>
                <th className="py-3 px-4 whitespace-nowrap">Người xóa</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading && docs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                      <span className="text-xs font-medium">Đang tải dữ liệu thùng rác...</span>
                    </div>
                  </td>
                </tr>
              ) : docs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400 dark:text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center text-slate-400">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Thùng rác trống</span>
                      <span className="text-xs text-slate-400">Không có tài liệu nào đang bị xóa tạm thời</span>
                    </div>
                  </td>
                </tr>
              ) : (
                docs.map((d: any) => {
                  const isDeleting = animatingId === d.file_id;
                  return (
                    <tr
                      key={d.file_id}
                      className={`hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-colors duration-150 group ${
                        isDeleting ? 'opacity-0 transition-opacity duration-200' : ''
                      }`}
                    >
                      {/* 1. Cột Số hiệu: font-mono tabular-nums text-sm thẳng hàng tuyệt đối */}
                      <td className="py-3.5 px-4 font-mono tabular-nums text-sm font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap overflow-hidden text-ellipsis">
                        {d.document_code || d.file_id}
                      </td>

                      {/* 2. Cột Trích yếu: font-medium, dễ đọc */}
                        <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-white">
                          <span className="line-clamp-2" title={d.title}>
                            {d.title}
                          </span>
                        </td>

                        {/* 3. Cột Độ mật: chuẩn phân cấp màu sắc quân đội */}
                        <td className="py-3.5 px-4">
                          {renderSecurityBadge(d)}
                        </td>

                        {/* 4. Cột Đơn vị */}
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                          <span className="truncate block max-w-[150px]" title={d.unit_name || '—'}>
                            {d.unit_name || '—'}
                          </span>
                        </td>

                        {/* 5. Cột Xóa lúc: font-mono tabular-nums text-sm thẳng hàng tuyệt đối */}
                        <td className="py-3.5 px-4 font-mono tabular-nums text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {d.deleted_at ? new Date(d.deleted_at).toLocaleString('vi-VN') : '—'}
                        </td>

                        {/* 6. Cột Người xóa */}
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {d.deleted_by_name || '—'}
                        </td>

                        {/* 7. Cột Thao tác: Hào quang xanh / đỏ khi hover kèm Tooltip tĩnh */}
                        <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                          {hasPermission('DOC_RESTORE') && (
                            <button
                              type="button"
                              onClick={() => handleRestoreSingle(d)}
                              disabled={isDeleting || batchLoading}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:shadow-[0_0_12px_rgba(16,185,129,0.35)] transition-all duration-200 cursor-pointer active:scale-95 disabled:opacity-40"
                              title="Khôi phục tài liệu"
                              aria-label="Khôi phục tài liệu"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {hasPermission('DOC_PURGE') && (
                            <button
                              type="button"
                              onClick={() => setPurgeModal({ open: true, doc: d, isAll: false })}
                              disabled={isDeleting || batchLoading}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:shadow-[0_0_12px_rgba(239,68,68,0.35)] transition-all duration-200 cursor-pointer active:scale-95 disabled:opacity-40"
                              title="Xóa vĩnh viễn (Không thể phục hồi)"
                              aria-label="Xóa vĩnh viễn (Không thể phục hồi)"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  // ═══════════════════════════════════════════════════════════
  // 3. MODAL CẢNH BÁO NGUY HIỂM: XÓA VĨNH VIỄN (PURGE CONFIRMATION)
  // Màu Đỏ Quân Kỳ & Xác nhận 2 bước an toàn tuyệt đối
  // ═══════════════════════════════════════════════════════════
  const dangerPurgeModal = (
    <AnimatePresence>
      {purgeModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 360, damping: 26 }}
            className="w-full max-w-md bg-white dark:bg-[#0c1420] border-2 border-red-600/70 dark:border-red-600/60 rounded-2xl p-6 shadow-2xl relative text-left"
          >
            {/* Header Cảnh báo Đỏ Quân Kỳ */}
            <div className="flex items-start space-x-3.5 mb-4">
              <div className="w-11 h-11 rounded-xl bg-red-600/15 border border-red-600/30 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-extrabold text-base text-red-600 dark:text-red-400 uppercase tracking-wide">
                  {purgeModal.isAll ? 'CẢNH BÁO: DỌN RỖNG THÙNG RÁC' : 'XÁC NHẬN XÓA VĨNH VIỄN'}
                </h3>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 block mt-0.5">
                  MÃ BẢO MẬT HỆ THỐNG: SEC-PURGE-CONFIRM
                </span>
              </div>
            </div>

            {/* Khung nội dung cảnh báo nghiêm trọng */}
            <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3.5 mb-4 text-xs text-red-700 dark:text-red-300 leading-relaxed font-medium space-y-2">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                <span>HÀNH ĐỘNG KHÔNG THỂ HOÀN TÁC!</span>
              </p>
              <p>
                {purgeModal.isAll
                  ? `Toàn bộ ${docs.length} tài liệu trong thùng rác cùng toàn bộ tệp tin PDF gốc lưu trên ổ đĩa máy chủ sẽ bị xóa vĩnh viễn khỏi hệ thống.`
                  : `Tệp PDF vật lý của văn bản "${purgeModal.doc?.title}" (${purgeModal.doc?.document_code || purgeModal.doc?.file_id}) sẽ bị xóa vĩnh viễn khỏi hệ thống lưu trữ.`}
              </p>
            </div>

            {/* Bước xác thực bổ sung nếu là dọn rỗng toàn bộ (Double-Safety) */}
            {purgeModal.isAll && (
              <div className="mb-5 space-y-1.5">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Nhập <span className="font-mono text-red-600 dark:text-red-400 font-bold">XAC NHAN XOA</span> để mở khóa nút xóa:
                </label>
                <input
                  type="text"
                  value={confirmKeyword}
                  onChange={(e) => setConfirmKeyword(e.target.value)}
                  placeholder="Gõ chính xác: XAC NHAN XOA"
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
              </div>
            )}

            {/* Cụm nút hành động */}
            <div className="flex justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setPurgeModal({ open: false, doc: null, isAll: false })}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={purgeModal.isAll && confirmKeyword.trim() !== 'XAC NHAN XOA'}
                onClick={handlePurgeConfirm}
                className="px-4 py-2 bg-gradient-to-r from-red-600 via-red-700 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold rounded-xl text-xs shadow-md shadow-red-950/30 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{purgeModal.isAll ? 'Dọn rỗng vĩnh viễn' : 'Xóa vĩnh viễn'}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  // ═══════════════════════════════════════════════════════════
  // 4. MODAL XÁC NHẬN: KHÔI PHỤC TẤT CẢ (RESTORE ALL CONFIRMATION)
  // ═══════════════════════════════════════════════════════════
  const restoreAllConfirmModal = (
    <AnimatePresence>
      {restoreAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 360, damping: 26 }}
            className="w-full max-w-sm bg-white dark:bg-[#0c1420] border border-emerald-500/40 rounded-2xl p-6 shadow-2xl relative text-left"
          >
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Khôi phục tất cả tài liệu</h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-5 leading-relaxed font-medium">
              Bạn có chắc chắn muốn khôi phục toàn bộ <span className="font-bold text-emerald-600 dark:text-emerald-400">{docs.length} tài liệu</span> trong thùng rác về trạng thái lưu trữ ban đầu?
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestoreAllModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleRestoreAllConfirm}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-md shadow-emerald-950/30 flex items-center gap-1.5 active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Khôi phục tất cả</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  // ═══════════════════════════════════════════════════════════
  // EMBEDDED LAYOUT (Khi nhúng trong AdminDashboardPage)
  // ═══════════════════════════════════════════════════════════
  if (embedded) {
    return (
      <div className="space-y-5">
        {pageContent}
        {dangerPurgeModal}
        {restoreAllConfirmModal}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // STANDALONE LAYOUT (Khi truy cập trực tiếp /admin/trash)
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans transition-colors duration-200">
      <Header activeNav="admin" title="Trường Quân Sự Quân Khu 7" subtitle="Thùng rác tài liệu" />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-5">
        {pageContent}
      </main>

      {dangerPurgeModal}
      {restoreAllConfirmModal}
    </div>
  );
};

export default TrashPage;
>>>>>>> cf233fdbc97b0a7292ffcaa92451fc02aabe6508
