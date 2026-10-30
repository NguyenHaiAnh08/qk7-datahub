import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor,
  RefreshCw,
  Laptop,
  Tablet,
  Smartphone,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  UserX,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import { Header } from '../components/common/Header';
import { toast } from '../components/common/Toast';
import { sessionService } from '../services/sessionService';
import { useAuth } from '../hooks/useAuth';
import { ActiveSession } from '../types/user';
import { isApprovalRequired } from '../utils/approvalUtils';

export interface SessionsPageProps {
  /** Khi true: render inline trong AdminDashboardPage (không có Header riêng, không min-h-screen) */
  embedded?: boolean;
}

// ══════════════════════════════════════════════════════════════
// DATA PARSING HELPER: Parse User-Agent thô sang định dạng thiết bị dễ đọc
// ══════════════════════════════════════════════════════════════
export interface ParsedUA {
  os: string;
  browser: string;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  displayString: string;
}

export function parseUserAgent(ua?: string): ParsedUA {
  if (!ua || ua.trim() === '') {
    return {
      os: 'Thiết bị không rõ',
      browser: 'Trình duyệt không rõ',
      deviceType: 'desktop',
      displayString: 'Thiết bị không xác định',
    };
  }

  const uaLower = ua.toLowerCase();

  // 1. Nhận diện Hệ điều hành & Phân loại thiết bị
  let os = 'Hệ điều hành khác';
  let deviceType: 'desktop' | 'tablet' | 'mobile' = 'desktop';

  if (
    uaLower.includes('ipad') ||
    (uaLower.includes('macintosh') && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)
  ) {
    os = 'iPadOS';
    deviceType = 'tablet';
  } else if (uaLower.includes('iphone')) {
    os = 'iOS (iPhone)';
    deviceType = 'mobile';
  } else if (uaLower.includes('windows nt 10.0')) {
    os = 'Windows 10/11';
    deviceType = 'desktop';
  } else if (uaLower.includes('windows nt 6.3')) {
    os = 'Windows 8.1';
    deviceType = 'desktop';
  } else if (uaLower.includes('windows nt 6.1')) {
    os = 'Windows 7';
    deviceType = 'desktop';
  } else if (uaLower.includes('windows')) {
    os = 'Windows';
    deviceType = 'desktop';
  } else if (uaLower.includes('macintosh') || uaLower.includes('mac os x')) {
    os = 'macOS';
    deviceType = 'desktop';
  } else if (uaLower.includes('android')) {
    os = 'Android';
    deviceType = uaLower.includes('tablet') ? 'tablet' : 'mobile';
  } else if (uaLower.includes('linux')) {
    os = 'Linux';
    deviceType = 'desktop';
  }

  // 2. Nhận diện Trình duyệt
  let browser = 'Trình duyệt khác';
  if (uaLower.includes('edg/') || uaLower.includes('edge/')) {
    browser = 'MS Edge';
  } else if (uaLower.includes('opr/') || uaLower.includes('opera')) {
    browser = 'Opera';
  } else if (uaLower.includes('chrome') || uaLower.includes('crios')) {
    browser = 'Chrome';
  } else if (uaLower.includes('firefox') || uaLower.includes('fxios')) {
    browser = 'Firefox';
  } else if (uaLower.includes('safari') && !uaLower.includes('chrome')) {
    browser = 'Safari';
  }

  return {
    os,
    browser,
    deviceType,
    displayString: `${os} • ${browser}`,
  };
}

export const SessionsPage: React.FC<SessionsPageProps> = ({ embedded = false }) => {
  const { user, hasPermission } = useAuth();
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [animatingSessionId, setAnimatingSessionId] = useState<string | null>(null);

  // Modal Cảnh Báo Nguy Hiểm: Ngắt phiên (Đỏ Quân Kỳ)
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    type: 'single' | 'all';
    session?: ActiveSession;
    userId?: string;
    userName?: string;
  }>({
    open: false,
    type: 'single',
  });

  // Tải danh sách phiên
  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await sessionService.listActive();
      setSessions(r.items || []);
    } catch (err: any) {
      toast.error('Lỗi tải danh sách phiên: ' + (err.message || 'Lỗi không xác định'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Live Auto-Refresh (Mặc định 15 giây)
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => load(true), 15000);
    return () => clearInterval(t);
  }, [autoRefresh]);

  // ═══════════════════════════════════════════════════════════
  // 1. THAO TÁC NGẮT PHIÊN ĐƠN LẺ (KILL SINGLE SESSION)
  // ═══════════════════════════════════════════════════════════
  const handleKillSingleConfirm = async () => {
    const targetSession = confirmModal.session;
    if (!targetSession) return;

    setAnimatingSessionId(targetSession.session_id);
    setConfirmModal({ open: false, type: 'single' });

    try {
      const r: any = await sessionService.kill(targetSession.session_id);

      // Nếu backend yêu cầu phê duyệt → không claim success, refresh lại
      if (isApprovalRequired(r)) {
        setAnimatingSessionId(null);
        await load(true);
        return;
      }

      toast.success(
        `Đã ngắt phiên kết nối của đồng chí "${targetSession.full_name}" (IP: ${targetSession.ip || 'Local'})`,
        {
          title: 'THU HỒI PHIÊN THÀNH CÔNG',
          badge: 'SESSION-REVOKED',
          duration: 3500,
        }
      );

      // Fade-out row khỏi danh sách
      setTimeout(() => {
        setSessions((prev) => prev.filter((s) => s.session_id !== targetSession.session_id));
        setAnimatingSessionId(null);
      }, 250);
    } catch (err: any) {
      setAnimatingSessionId(null);
      toast.error('Lỗi khi ngắt phiên: ' + (err.message || 'Không thể thu hồi phiên'));
    }
  };

  // ═══════════════════════════════════════════════════════════
  // 2. THAO TÁC NGẮT TOÀN BỘ PHIÊN CỦA 1 QUÂN NHÂN (KILL ALL SESSIONS FOR USER)
  // ═══════════════════════════════════════════════════════════
  const handleKillAllConfirm = async () => {
    const targetUserId = confirmModal.userId;
    const targetUserName = confirmModal.userName;
    if (!targetUserId) return;

    setConfirmModal({ open: false, type: 'all' });
    setLoading(true);

    try {
      const r: any = await sessionService.killAllForUser(targetUserId);

      // Nếu backend yêu cầu phê duyệt → refresh lại, không claim success
      if (isApprovalRequired(r)) {
        await load(true);
        return;
      }

      toast.success(
        `Đã ngắt toàn bộ ${r.revoked_count ?? 0} phiên kết nối của quân nhân "${targetUserName || targetUserId}"!`,
        {
          title: 'THU HỒI TOÀN BỘ THÀNH CÔNG',
          badge: 'REVOKED-ALL',
          duration: 4000,
        }
      );
      await load(true);
    } catch (err: any) {
      toast.error('Lỗi khi ngắt toàn bộ phiên: ' + (err.message || 'Thao tác thất bại'));
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // HELPER: Render Pill trạng thái Live Pulsing
  // ═══════════════════════════════════════════════════════════
  const renderIdlePill = (session: ActiveSession) => {
    const idle = session.minutes_idle;

    if (idle <= 2) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap shadow-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span>Đang hoạt động</span>
        </span>
      );
    }

    if (idle <= 120) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 whitespace-nowrap shadow-xs">
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          <span>
            {Math.floor(idle / 60) > 0
              ? `${Math.floor(idle / 60)}h ${idle % 60}p`
              : `${idle} phút trước`}
          </span>
        </span>
      );
    }

    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 whitespace-nowrap shadow-xs"
        title={`Treo máy quá lâu. Sắp tự động ngắt kết nối sau ${Math.max(0, 180 - idle)} phút nữa`}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
        </span>
        <span>Treo máy ({Math.floor(idle / 60)}h{idle % 60}p)</span>
      </span>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // GIAO DIỆN NỘI DUNG CHÍNH (CONTENT)
  // ═══════════════════════════════════════════════════════════
  const pageContent = (
    <>
      {/* 1. Header & Live Indicator Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
              <Monitor className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <span>Phiên Đang Trực Tuyến</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center flex-wrap gap-1.5">
            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
              {sessions.length}
            </span>{' '}
            <span>phiên đang hoạt động (tương tác trong 3 giờ gần nhất)</span>
            <span className="text-slate-400">•</span>
            <span className="text-rose-600 dark:text-rose-400 font-medium">
              Tự động thoát nếu treo máy 180 phút
            </span>
          </p>
        </div>

        {/* Cụm công tắc Live Auto-Refresh & Nút Làm mới */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Live Auto-Refresh Toggle Switch */}
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer select-none active:scale-95 ${
              autoRefresh
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                : 'bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'
            }`}
            title="Bật/Tắt chế độ tự động làm mới theo chu kỳ 15 giây"
          >
            <span className="relative flex h-2 w-2">
              {autoRefresh && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  autoRefresh ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
              />
            </span>
            <span className="font-mono">{autoRefresh ? 'TỰ ĐỘNG: LIVE (15s)' : 'TỰ ĐỘNG: TẮT'}</span>
          </button>

          {/* Nút Làm mới chuẩn xám trung tính có viền */}
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700/90 border border-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer select-none active:scale-95"
            title="Tải lại danh sách phiên"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* 2. Bảng Dữ Liệu High-craft Grid */}
      <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-200">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[1280px]">
            <colgroup>
              <col style={{ width: '230px' }} />
              <col style={{ width: '130px' }} />
              <col style={{ width: '250px' }} />
              <col style={{ width: '180px' }} />
              <col style={{ width: '180px' }} />
              <col style={{ width: '140px' }} />
              <col style={{ width: '200px' }} />
            </colgroup>
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800/80">
              <tr>
                <th className="py-3 px-4 text-center whitespace-nowrap">Quân nhân</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">IP</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Thiết bị</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Đăng nhập</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Hoạt động cuối</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Idle</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading && sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                      <span className="text-xs font-medium">Đang tải danh sách phiên trực tuyến...</span>
                    </div>
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400 dark:text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center text-slate-400">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Không có phiên hoạt động
                      </span>
                      <span className="text-xs text-slate-400">Hiện tại chưa có người dùng nào trực tuyến</span>
                    </div>
                  </td>
                </tr>
              ) : (
                sessions.map((s) => {
                  const parsed = parseUserAgent(s.user_agent);
                  const isCurrentUser = s.user_id === user?.user_id;
                  const isKilling = animatingSessionId === s.session_id;

                  return (
                    <tr
                      key={s.session_id}
                      className={`hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-colors duration-150 group ${
                        isKilling ? 'opacity-0 transition-opacity duration-200' : ''
                      }`}
                    >
                      {/* 1. Cột Quân nhân: Căn giữa */}
                      <td className="py-3.5 px-4 text-center overflow-hidden">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center justify-center gap-1.5 truncate">
                          <span className="truncate">{s.full_name}</span>
                          {isCurrentUser && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                              Bạn
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                          {s.user_id}
                        </div>
                        {(s.rank || s.position) && (
                          <div
                            className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5"
                            title={[s.rank, s.position].filter(Boolean).join(' • ')}
                          >
                            {[s.rank, s.position].filter(Boolean).join(' • ')}
                          </div>
                        )}
                      </td>

                      {/* 2. Cột IP */}
                      <td className="py-3.5 px-4 font-mono tabular-nums text-sm font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap text-center">
                        {s.ip || '127.0.0.1'}
                      </td>

                      {/* 3. Cột Thiết bị */}
                      <td className="py-3.5 px-4 overflow-hidden text-center" title={s.user_agent}>
                        <div className="flex items-center justify-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center shrink-0">
                            {parsed.deviceType === 'tablet' ? (
                              <Tablet className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                            ) : parsed.deviceType === 'mobile' ? (
                              <Smartphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            ) : (
                              <Laptop className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            )}
                          </div>
                          <div className="min-w-0 text-left">
                            <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5 truncate">
                              <span>{parsed.os}</span>
                              <span className="text-slate-400 text-[10px]">•</span>
                              <span className="text-slate-600 dark:text-slate-300 font-medium truncate">
                                {parsed.browser}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">
                              {parsed.deviceType === 'desktop'
                                ? 'Máy tính để bàn / Laptop'
                                : parsed.deviceType === 'tablet'
                                ? 'Máy tính bảng iPad/Tablet'
                                : 'Thiết bị di động'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 4. Cột Đăng nhập */}
                      <td className="py-3.5 px-4 font-mono tabular-nums text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap text-center">
                        {s.created_at ? new Date(s.created_at).toLocaleString('vi-VN') : '—'}
                      </td>

                      {/* 5. Cột Hoạt động cuối */}
                      <td className="py-3.5 px-4 font-mono tabular-nums text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap text-center">
                        {s.last_seen_at ? new Date(s.last_seen_at).toLocaleString('vi-VN') : '—'}
                      </td>

                      {/* 6. Cột Idle: Pill pulsing */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">{renderIdlePill(s)}</td>

                      {/* 7. Cột Thao tác */}
                      <td className="py-3.5 px-4 text-center space-x-1.5 whitespace-nowrap">
                        {hasPermission('SESSION_KILL') && (
                          <>
                            {isCurrentUser ? (
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 select-none shadow-xs"
                                title="Phiên đang đăng nhập hiện tại của đồng chí. Hệ thống khóa chức năng ngắt phiên để đảm bảo liên tục quyền điều hành."
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Phiên hiện tại</span>
                              </span>
                            ) : (
                              <>
                                {/* Nút Ghost viền Đỏ Quân Kỳ: Ngắt phiên */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmModal({
                                      open: true,
                                      type: 'single',
                                      session: s,
                                      userName: s.full_name,
                                      userId: s.user_id,
                                    })
                                  }
                                  disabled={isKilling}
                                  className="px-2.5 py-1.5 rounded-xl border border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:border-red-500 text-xs font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-40 shadow-xs inline-flex items-center gap-1"
                                  title="Ngắt kết nối phiên làm việc này"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>Ngắt phiên</span>
                                </button>

                                {/* Nút Ghost viền Vàng Kim: Ngắt toàn bộ */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmModal({
                                      open: true,
                                      type: 'all',
                                      userId: s.user_id,
                                      userName: s.full_name,
                                    })
                                  }
                                  disabled={isKilling}
                                  className="px-2.5 py-1.5 rounded-xl border border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500 text-xs font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-40 shadow-xs inline-flex items-center gap-1"
                                  title="Thu hồi toàn bộ phiên đăng nhập của quân nhân này trên mọi thiết bị"
                                >
                                  <Layers className="w-3.5 h-3.5" />
                                  <span>Ngắt toàn bộ</span>
                                </button>
                              </>
                            )}
                          </>
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
  // 3. MODAL CẢNH BÁO NGUY HIỂM: NGẮT PHIÊN (PURGE / KILL CONFIRMATION)
  // ═══════════════════════════════════════════════════════════
  const dangerConfirmModal = (
    <AnimatePresence>
      {confirmModal.open && (
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
                  {confirmModal.type === 'all'
                    ? 'XÁC NHẬN NGẮT TOÀN BỘ PHIÊN'
                    : 'XÁC NHẬN NGẮT PHIÊN TRỰC TUYẾN'}
                </h3>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 block mt-0.5">
                  MÃ BẢO MẬT HỆ THỐNG: SEC-SESSION-REVOKE
                </span>
              </div>
            </div>

            {/* Thông tin đối tượng bị tác động */}
            <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 mb-4 space-y-2 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Quân nhân:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {confirmModal.userName || '—'}{' '}
                  <span className="font-mono text-amber-600 dark:text-amber-400">
                    ({confirmModal.userId || confirmModal.session?.user_id})
                  </span>
                </span>
              </div>

              {confirmModal.type === 'single' && confirmModal.session && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400">Địa chỉ IP:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {confirmModal.session.ip || '127.0.0.1'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400">Thiết bị:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {parseUserAgent(confirmModal.session.user_agent).displayString}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400">Đăng nhập lúc:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {new Date(confirmModal.session.created_at).toLocaleString('vi-VN')}
                    </span>
                  </div>
                </>
              )}

              {confirmModal.type === 'all' && (
                <div className="flex justify-between items-center text-amber-600 dark:text-amber-400 font-semibold">
                  <span>Phạm vi tác động:</span>
                  <span>Toàn bộ thiết bị & trình duyệt</span>
                </div>
              )}
            </div>

            {/* Cảnh báo nghiêm trọng */}
            <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3.5 mb-5 text-xs text-red-700 dark:text-red-300 leading-relaxed font-medium space-y-1.5">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                <span>CẢNH BÁO THU HỒI TOKEN TRUY CẬP</span>
              </p>
              <p>
                {confirmModal.type === 'all'
                  ? `Đồng chí có chắc chắn muốn ngắt toàn bộ phiên kết nối của quân nhân "${confirmModal.userName}"? Tài khoản này sẽ bị đẩy ra khỏi toàn bộ thiết bị đang đăng nhập.`
                  : `Đồng chí có chắc chắn muốn ngắt phiên kết nối của quân nhân "${confirmModal.userName}" trên IP ${confirmModal.session?.ip}? Phiên làm việc này sẽ lập tức mất quyền truy cập.`}
              </p>
            </div>

            {/* Cụm nút hành động */}
            <div className="flex justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setConfirmModal({ open: false, type: 'single' })}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={
                  confirmModal.type === 'all'
                    ? handleKillAllConfirm
                    : handleKillSingleConfirm
                }
                className="px-4 py-2 bg-gradient-to-r from-red-600 via-red-700 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold rounded-xl text-xs shadow-md shadow-red-950/30 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <UserX className="w-3.5 h-3.5" />
                <span>
                  {confirmModal.type === 'all' ? 'Ngắt toàn bộ thiết bị' : 'Xác nhận ngắt phiên'}
                </span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  // ═══════════════════════════════════════════════════════════
  // EMBEDDED LAYOUT (dùng khi nhúng trong AdminDashboardPage)
  // ═══════════════════════════════════════════════════════════
  if (embedded) {
    return (
      <div className="space-y-5">
        {pageContent}
        {dangerConfirmModal}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // STANDALONE LAYOUT (truy cập /admin/sessions trực tiếp qua URL)
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans transition-colors duration-200">
      <Header activeNav="admin" title="Trường Quân Sự Quân Khu 7" subtitle="Trung tâm dữ liệu số" />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-5">
        {pageContent}
      </main>

      {dangerConfirmModal}
    </div>
  );
};

export default SessionsPage;