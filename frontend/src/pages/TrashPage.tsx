import React, { useEffect, useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { Header } from '../components/common/Header';
import { Toast, ToastState } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
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
      if (confirm.mode === 'restore') {
        await documentsApi.restoreDocument(confirm.doc.file_id);
        showToast(`Đã khôi phục: ${confirm.doc.title}`, 'success');
      } else {
        await documentsApi.purgeDocument(confirm.doc.file_id);
        showToast(`Đã xóa vĩnh viễn: ${confirm.doc.title}`, 'success');
      }
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
                      {hasPermission('DOC_PURGE') && (
                        <button
                          onClick={() => setConfirm({ open: true, doc: d, mode: 'purge' })}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-500/30 cursor-pointer"
                          title="Xóa vĩnh viễn"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </button>
                      )}
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
          : `CẢNH BÁO: File PDF vật lý sẽ bị xóa vĩnh viễn khỏi ổ đĩa. Không thể hoàn tác. Xác nhận xóa "${confirm.doc?.title}"?`
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