import React, { useEffect, useState } from 'react';
import { Monitor, RefreshCw } from 'lucide-react';
import { Header } from '../components/common/Header';
import { Toast, ToastState } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { sessionService } from '../services/sessionService';
import { useAuth } from '../hooks/useAuth';
import { ActiveSession } from '../types/user';
import { isApprovalRequired } from '../utils/approvalUtils';

export interface SessionsPageProps {
  /** Khi true: render inline trong AdminDashboardPage (không có Header riêng, không min-h-screen) */
  embedded?: boolean;
}

export const SessionsPage: React.FC<SessionsPageProps> = ({ embedded = false }) => {
  const { hasPermission } = useAuth();
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [confirm, setConfirm] = useState<{
    open: boolean;
    userId?: string;
    sessionId?: string;
    name?: string;
  }>({ open: false });
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'success' });

  const showToast = (m: string, t: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, message: m, type: t });
    setTimeout(() => setToast((p) => ({ ...p, show: false })), 2800);
  };

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await sessionService.listActive();
      setSessions(r.items || []);
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => load(true), 15000);
    return () => clearInterval(t);
  }, [autoRefresh]);

  const killOne = async (sessionId: string) => {
    try {
      const res: any = await sessionService.kill(sessionId);
      if (!isApprovalRequired(res)) showToast('Đã kill session', 'success');
      setConfirm({ open: false });
      load(true);
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    }
  };

  const killAllForUser = async (userId: string) => {
    try {
      const r: any = await sessionService.killAllForUser(userId);
      if (!isApprovalRequired(r)) {
        showToast(`Đã kill ${r.revoked_count} session của ${userId}`, 'success');
     }
      setConfirm({ open: false });
      load(true);
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    }
  };

  // ═══════════════════════════════════════════════════════════
  // CONTENT (dùng chung cho cả 2 layout: standalone và embedded)
  // ═══════════════════════════════════════════════════════════
  const pageContent = (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Monitor className="w-6 h-6 text-cyan-500" />
            Phiên Đang Trực Tuyến
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {sessions.length}
            </span>{' '}
            phiên đang hoạt động
            <span className="text-slate-400 ml-1">
              (tương tác trong 3 giờ gần nhất)
            </span>
            {' • '}
            <span className="text-rose-500 dark:text-rose-400">
              Tự động thoát nếu treo máy 180 phút
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>Tự động</span>
          </label>
          <button
            onClick={() => load()}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[860px]">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Quân nhân</th>
                <th className="py-3 px-4">IP</th>
                <th className="py-3 px-4">Thiết bị</th>
                <th className="py-3 px-4">Đăng nhập</th>
                <th className="py-3 px-4">Hoạt động cuối</th>
                <th className="py-3 px-4">Idle</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading && sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Đang tải...
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Không có phiên nào đang hoạt động
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr
                    key={s.session_id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {s.full_name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {s.user_id}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                      {s.ip || '—'}
                    </td>
                    <td
                      className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-[220px] truncate"
                      title={s.user_agent}
                    >
                      {s.user_agent?.split(')')[0] || '—'}
                    </td>
                    <td className="py-3 px-4 text-[11px] font-mono text-slate-500">
                      {new Date(s.created_at).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-4 text-[11px] font-mono text-slate-500">
                      {new Date(s.last_seen_at).toLocaleString('vi-VN')}
                    </td>
                                        <td className="py-3 px-4">
                      {s.minutes_idle <= 2 ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Đang trực
                        </span>
                      ) : s.minutes_idle <= 120 ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          {Math.floor(s.minutes_idle / 60) > 0
                            ? `${Math.floor(s.minutes_idle / 60)}h ${s.minutes_idle % 60}p`
                            : `${s.minutes_idle} phút`}
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30"
                          title={`Sắp auto-logout trong ${Math.max(0, 180 - s.minutes_idle)} phút nữa`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                          {Math.floor(s.minutes_idle / 60)}h {s.minutes_idle % 60}p · sắp hết
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {hasPermission('SESSION_KILL') && (
                        <>
                          <button
                            onClick={() =>
                              setConfirm({
                                open: true,
                                sessionId: s.session_id,
                                name: s.full_name,
                              })
                            }
                            className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-500/30 text-[11px] font-semibold cursor-pointer"
                          >
                            Kill
                          </button>
                          <button
                            onClick={() =>
                              setConfirm({
                                open: true,
                                userId: s.user_id,
                                name: s.full_name,
                              })
                            }
                            className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-500/30 text-[11px] font-semibold cursor-pointer"
                          >
                            Kill tất cả
                          </button>
                        </>
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
  // EMBEDDED LAYOUT (dùng khi nhúng trong AdminDashboardPage)
  // ═══════════════════════════════════════════════════════════
  if (embedded) {
    return (
      <div className="space-y-5">
        {pageContent}

        <ConfirmDialog
          open={confirm.open}
          title="Kill session"
          message={
            confirm.sessionId
              ? `Kill session của ${confirm.name}? User sẽ bị đăng xuất ngay lập tức.`
              : `Kill TẤT CẢ session của ${confirm.name}? User sẽ bị đăng xuất toàn bộ thiết bị.`
          }
          confirmText="Kill"
          confirmVariant="danger"
          onConfirm={() => {
            if (confirm.sessionId) killOne(confirm.sessionId);
            else if (confirm.userId) killAllForUser(confirm.userId);
          }}
          onCancel={() => setConfirm({ open: false })}
        />

        <Toast toast={toast} onClose={() => setToast((p) => ({ ...p, show: false }))} />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // STANDALONE LAYOUT (truy cập /admin/sessions trực tiếp qua URL)
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Header activeNav="admin" title="QK7 DATAHUB" subtitle="Phiên đang hoạt động" />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-5">
        {pageContent}
      </main>

      <ConfirmDialog
        open={confirm.open}
        title="Kill session"
        message={
          confirm.sessionId
            ? `Kill session của ${confirm.name}? User sẽ bị đăng xuất ngay lập tức.`
            : `Kill TẤT CẢ session của ${confirm.name}? User sẽ bị đăng xuất toàn bộ thiết bị.`
        }
        confirmText="Kill"
        confirmVariant="danger"
        onConfirm={() => {
          if (confirm.sessionId) killOne(confirm.sessionId);
          else if (confirm.userId) killAllForUser(confirm.userId);
        }}
        onCancel={() => setConfirm({ open: false })}
      />

      <Toast toast={toast} onClose={() => setToast((p) => ({ ...p, show: false }))} />
    </div>
  );
};

export default SessionsPage;