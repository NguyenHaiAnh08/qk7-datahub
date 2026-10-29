/* <!-- Lucian UX/UI Prompt #058 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#058 --> */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion'; // (giữ nguyên import, dùng cho tương lai)
import { Popover, Tooltip } from 'antd';
import {
  Building,
  Clock,
  ShieldAlert,
  UploadCloud,
  BookOpen,
  MonitorPlay,
  Layers,
  Library,
  LogOut,
  ChevronDown,
  Menu,
  Trash2,
  Activity,
  Shield,
  Bell,
  Bot,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useDeviceMode } from '../../contexts/DeviceModeContext';
import { useNetworkStatus } from '../../contexts/NetworkStatusContext';
import { useAIChat } from '../../contexts/AIChatContext';
import { ThemeToggle } from './ThemeToggle';
import { DeviceModeSwitch } from './DeviceModeSwitch';
import { ROUTE_PATHS } from '../../routes/routePaths';
import { useApprovalContext } from '../../contexts/ApprovalContext';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showClock?: boolean;
  activeNav?: 'desk' | 'portal' | 'myunit' | 'admin' | 'login' | 'lectures' | 'materials' | 'library' | 'data';
  onToggleMobileMenu?: () => void;
}

// ══════════════════════════════════════════════════════════════════════
// HELPER: Lấy chữ cái đầu của tên cuối (tên chính) theo quy chuẩn tiếng Việt
// ══════════════════════════════════════════════════════════════════════
export function getAvatarInitial(name?: string, fallback = 'ĐB'): string {
  if (!name || !name.trim()) return fallback;
  const clean = name.trim();
  if (clean.toLowerCase() === 'đại biểu' || clean.toLowerCase() === 'khách') return 'ĐB';
  const parts = name.trim().split(/\s+/);
  const lastName = parts[parts.length - 1];
  return lastName ? lastName.charAt(0).toUpperCase() : fallback;
}

// ══════════════════════════════════════════════════════════════════════
// COMPONENT: Cụm Nút Điều Hướng 5 Phân Hệ (Morphing Pill: Icon -> Chữ Đẩy Ra)
// ══════════════════════════════════════════════════════════════════════
const NavigationGlider: React.FC<{
  activeNav?: 'desk' | 'portal' | 'myunit' | 'admin' | 'login' | 'lectures' | 'materials' | 'library' | 'data';
}> = ({ activeNav: explicitActiveNav }) => {
  const { isAdmin } = useAuth();
  const { deviceMode, isTouch } = useDeviceMode();
  const location = useLocation();

  // Nhận diện thiết bị cảm ứng hoặc chế độ iPadOS để vô hiệu hóa Tooltip
  const isTouchOrIPad =
    deviceMode === 'ipad' ||
    isTouch ||
    (typeof navigator !== 'undefined' &&
      (navigator.maxTouchPoints > 0 ||
        (/iPad|iPhone|iPod|Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1))) ||
    (typeof window !== 'undefined' && 'ontouchstart' in window);

  const getEffectiveActiveNav = () => {
    if (explicitActiveNav) {
      if (
        explicitActiveNav === 'desk' ||
        explicitActiveNav === 'myunit' ||
        explicitActiveNav === 'portal' ||
        explicitActiveNav === 'data'
      ) {
        return 'portal';
      }
      return explicitActiveNav;
    }
    const path = location.pathname;
    if (
      path.startsWith(ROUTE_PATHS.DESK) ||
      path.startsWith(ROUTE_PATHS.MY_UNIT) ||
      path.startsWith(ROUTE_PATHS.PORTAL)
    ) {
      return 'portal';
    }
    if (path.startsWith(ROUTE_PATHS.LECTURES)) return 'lectures';
    if (path.startsWith(ROUTE_PATHS.MATERIALS)) return 'materials';
    if (path.startsWith(ROUTE_PATHS.LIBRARY)) return 'library';
    if (path.startsWith(ROUTE_PATHS.ADMIN)) return 'admin';
    return undefined;
  };

  const activeNav = getEffectiveActiveNav();

  const allNavTabs = [
    {
      key: 'portal',
      to: ROUTE_PATHS.PORTAL,
      label: 'Dữ liệu số',
      icon: BookOpen,
      tourId: 'tour-nav-portal',
      visible: true,
    },
    {
      key: 'lectures',
      to: ROUTE_PATHS.LECTURES,
      label: 'Bài giảng số',
      icon: MonitorPlay,
      visible: true,
    },
    {
      key: 'materials',
      to: ROUTE_PATHS.MATERIALS,
      label: 'Học liệu số',
      icon: Layers,
      visible: true,
    },
    {
      key: 'library',
      to: ROUTE_PATHS.LIBRARY,
      label: 'Thư viện số',
      icon: Library,
      visible: true,
    },
    {
      key: 'admin',
      to: ROUTE_PATHS.ADMIN,
      label: 'Quản trị',
      icon: ShieldAlert,
      visible: Boolean(isAdmin),
    },
  ];

  const visibleTabs = allNavTabs.filter((t) => t.visible);

  return (
    <nav
      aria-label="Điều hướng hệ thống"
      className="u058-nav relative flex items-center gap-1.5 sm:gap-2 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-2xl rounded-full px-2 sm:px-2.5 py-1.5 select-none w-fit max-w-full touch-manipulation"
    >
      {visibleTabs.map((tab) => {
        const isActive = activeNav === tab.key;
        const IconComponent = tab.icon;

        const tabLink = (
          <Link
            key={tab.key}
            id={tab.tourId || (tab.key === 'portal' ? 'tour-nav-portal' : undefined)}
            to={tab.to}
            onClick={(e) => {
              if (isActive && location.pathname === tab.to) {
                e.preventDefault();
              }
            }}
            aria-current={isActive ? 'page' : undefined}
            aria-label={tab.label}
            data-active={isActive ? 'true' : 'false'}
            className={`u058-tab relative z-10 shrink-0 flex items-center justify-center rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200 ease-out select-none h-10 touch-manipulation cursor-pointer ${
              isActive
                ? 'is-active bg-[#166534] dark:bg-emerald-600 !text-white font-bold px-4 py-2 shadow-md border border-emerald-500/40'
                : 'text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 w-10 px-0 border border-transparent'
            }`}
            style={isActive ? { color: '#ffffff' } : undefined}
          >
            <IconComponent
              className={`w-5 h-5 shrink-0 transition-transform duration-200 ${
                isActive ? 'scale-105 !text-white stroke-white' : 'text-slate-600 dark:text-slate-400'
              }`}
              style={isActive ? { color: '#ffffff', stroke: '#ffffff' } : undefined}
            />
            <span
              className={`morphing-pill-label overflow-hidden whitespace-nowrap transition-all duration-200 ease-out ${
                isActive
                  ? 'max-w-[280px] opacity-100 ml-2 font-bold !text-white'
                  : 'max-w-0 opacity-0 ml-0 pointer-events-none'
              }`}
              style={isActive ? { color: '#ffffff' } : undefined}
            >
              {tab.label}
            </span>
          </Link>
        );

        if (isTouchOrIPad || isActive) {
          return <React.Fragment key={tab.key}>{tabLink}</React.Fragment>;
        }

        return (
          <Tooltip
            key={tab.key}
            title={tab.label}
            placement="bottom"
            mouseEnterDelay={0.25}
            arrow={{ pointAtCenter: true }}
          >
            {tabLink}
          </Tooltip>
        );
      })}
    </nav>
  );
};

export const Header: React.FC<HeaderProps> = ({
  title = 'Trường Quân Sự Quân Khu 7',
  subtitle = 'Trung tâm dữ liệu số',
  showClock = true,
  activeNav,
  onToggleMobileMenu,
}) => {
  const { user, isAdmin, logout, hasPermission } = useAuth();
  const { deviceMode, orientation } = useDeviceMode();
  const { isOnline, checkConnection } = useNetworkStatus();
  const navigate = useNavigate();
  const { count: approvalCount } = useApprovalContext();
  const showApprovalBadge = hasPermission('APPROVAL_VALIDATE') && approvalCount > 0;
  const [liveClock, setLiveClock] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userPopoverOpen, setUserPopoverOpen] = useState(false);
  const { isChatOpen, toggleChat, aiStatus } = useAIChat();

  useEffect(() => {
    if (!showClock) return;
    const updateTime = () => setLiveClock(new Date().toLocaleTimeString('vi-VN'));
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [showClock]);

  const isIPadPortrait = deviceMode === 'ipad' && orientation === 'portrait';
  const isGuestUser = !user || user.user_id === 'GUEST';
  const avatarInitial = getAvatarInitial(user?.full_name);

  const canAccessDesk =
    hasPermission('DOC_UPLOAD') || hasPermission('DOC_EDIT') || hasPermission('DOC_PARSE');

  const canAccessAdmin =
    hasPermission('SYSTEM_STATS_VIEW') ||
    hasPermission('USER_VIEW') ||
    hasPermission('ROLE_VIEW') ||
    hasPermission('AUDIT_VIEW') ||
    hasPermission('SESSION_VIEW') ||
    isAdmin;

  const canAccessTrash = hasPermission('DOC_TRASH_VIEW');
  const canAccessSessions = hasPermission('SESSION_VIEW');

  // (liveClock hiện không render – giữ state để tương thích nếu sau này cần hiển thị)
  void liveClock;

  const userPopoverContent = (
    <div className="w-[380px] max-w-[92vw] p-1 text-slate-800 dark:text-slate-200 text-xs">
      <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {isGuestUser ? (
              <span className="font-bold text-slate-900 dark:text-white text-sm shrink-0">
                Đại biểu
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider shrink-0">
                {user?.user_id || 'Tài khoản'}
              </span>
            )}
            {isOnline ? (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 select-none shrink-0"
                title="Kết nối máy chủ LAN cổng 8000 ổn định"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                <span>Đang trực tuyến</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => checkConnection()}
                className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-rose-700 dark:text-rose-400 bg-rose-500/15 px-1.5 py-0.5 rounded border border-rose-500/40 animate-pulse cursor-pointer select-none shrink-0"
                title="Mất kết nối máy chủ LAN. Bấm để thử kết nối lại!"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
                <span>Mất kết nối</span>
              </button>
            )}
          </div>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
              (user?.clearance_level_id || 1) >= 4
                ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {user?.clearance_name || 'Công khai'}
          </span>
        </div>
        {!isGuestUser && (
          <>
            <div className="font-bold text-slate-900 dark:text-white mt-1.5 text-sm">
              {user?.full_name || 'Cán bộ'}
            </div>
        {(user?.rank_name || user?.position) && (
          <div
            className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis"
            title={[user.rank_name, user.position].filter(Boolean).join(' - ')}
          >
            {[user.rank_name, user.position].filter(Boolean).join(' - ')}
          </div>
        )}
        {user?.unit_name && (
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5 font-medium whitespace-nowrap">
            {user.unit_name}
          </div>
        )}
        {((user?.role_names && user.role_names.length > 0) || (user?.roles && user.roles.length > 0)) && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0 font-medium">
              <Shield className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span>Vai trò hệ thống:</span>
            </span>
            {(user.role_names && user.role_names.length > 0 ? user.role_names : user.roles || []).map((roleName, idx) => {
              const roleId = user.roles?.[idx];
              return (
                <span
                  key={idx}
                  className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25 whitespace-nowrap shadow-2xs"
                  title={roleId ? `Mã vai trò: ${roleId}` : undefined}
                >
                  {roleName}
                </span>
              );
            })}
          </div>
        )}
          </>
        )}
      </div>

      <div className="py-1">
        <Link
          to={ROUTE_PATHS.PORTAL}
          onClick={() => {
            setUserPopoverOpen(false);
            setDropdownOpen(false);
          }}
          className="flex items-center px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
        >
          <BookOpen className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 mr-2" />
          <span>Dữ liệu số</span>
        </Link>

        {user && user.user_id !== 'GUEST' && (
          <Link
            to={ROUTE_PATHS.MY_UNIT}
            onClick={() => {
              setUserPopoverOpen(false);
              setDropdownOpen(false);
            }}
            className="flex items-center px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
          >
            <Building className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mr-2 shrink-0" />
            <span className="truncate">{user.unit_name || 'Đơn vị của tôi'}</span>
          </Link>
        )}

        {canAccessDesk && (
          <Link
            to={ROUTE_PATHS.DESK}
            onClick={() => {
              setUserPopoverOpen(false);
              setDropdownOpen(false);
            }}
            className="flex items-center px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
          >
            <UploadCloud className="w-3.5 h-3.5 text-emerald-500 mr-2" />
            <span>Đăng tải văn bản</span>
          </Link>
        )}

        <Link
          to={ROUTE_PATHS.LECTURES}
          onClick={() => {
            setUserPopoverOpen(false);
            setDropdownOpen(false);
          }}
          className="flex items-center px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
        >
          <MonitorPlay className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mr-2" />
          <span>Bài giảng số</span>
        </Link>

        <Link
          to={ROUTE_PATHS.MATERIALS}
          onClick={() => {
            setUserPopoverOpen(false);
            setDropdownOpen(false);
          }}
          className="flex items-center px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
        >
          <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mr-2" />
          <span>Học liệu số</span>
        </Link>

        <Link
          to={ROUTE_PATHS.LIBRARY}
          onClick={() => {
            setUserPopoverOpen(false);
            setDropdownOpen(false);
          }}
          className="flex items-center px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
        >
          <Library className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mr-2" />
          <span>Thư viện số</span>
        </Link>

        {canAccessTrash && (
          <Link
            to={ROUTE_PATHS.ADMIN_TRASH}
            onClick={() => {
              setUserPopoverOpen(false);
              setDropdownOpen(false);
            }}
            className="flex items-center px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500 mr-2" />
            <span>Thùng rác tài liệu</span>
          </Link>
        )}

        {canAccessAdmin && (
          <>
            <Link
              to={ROUTE_PATHS.ADMIN}
              onClick={() => {
                setUserPopoverOpen(false);
                setDropdownOpen(false);
              }}
              className="flex items-center px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500 mr-2" />
              <span>Trung tâm quản trị hệ thống</span>
            </Link>

            {showApprovalBadge && (
              <Link
                to={`${ROUTE_PATHS.ADMIN}?tab=approvals`}
                onClick={() => {
                  setUserPopoverOpen(false);
                  setDropdownOpen(false);
                }}
                className="flex items-center justify-between px-3 py-1.5 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition"
              >
                <span className="flex items-center">
                  <Bell className="w-3.5 h-3.5 text-amber-500 mr-2" />
                  <span>Yêu cầu chờ duyệt</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  {approvalCount}
                </span>
              </Link>
            )}
          </>
        )}

        {canAccessSessions && (
          <Link
            to={ROUTE_PATHS.ADMIN_SESSIONS}
            onClick={() => {
              setUserPopoverOpen(false);
              setDropdownOpen(false);
            }}
            className="flex items-center px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
          >
            <Activity className="w-3.5 h-3.5 text-cyan-500 mr-2" />
            <span>Phiên đang hoạt động</span>
          </Link>
        )}

        {user && user.user_id !== 'GUEST' && (
          <Link
            to={ROUTE_PATHS.MY_APPROVALS}
            onClick={() => {
              setUserPopoverOpen(false);
              setDropdownOpen(false);
            }}
            className="flex items-center px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
          >
            <Clock className="w-3.5 h-3.5 text-amber-500 mr-2" />
            <span>Yêu cầu của tôi</span>
          </Link>
        )}
      </div>

      <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
        <button
          onClick={() => {
            setUserPopoverOpen(false);
            setDropdownOpen(false);
            void logout();
          }}
          className="w-full flex items-center px-3 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition text-left cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 mr-2" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════
  // BRANCH 1: GIAO DIỆN HEADER CHUYÊN BIỆT CHO IPAD AIR M4
  // ══════════════════════════════════════════════════════════════════════
  if (deviceMode === 'ipad') {
    return (
      // ✅ FIX: Gộp 2 thẻ <header> bị trùng thành 1, kết hợp class của cả hai
      <header className="sticky top-0 z-30 shrink-0 w-full max-w-full overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-4 lg:px-6 min-h-[3.75rem] sm:min-h-[4rem] h-[calc(3.75rem+env(safe-area-inset-top,0px))] sm:h-[calc(4rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] flex items-center justify-between gap-2 sm:gap-4 text-slate-900 dark:text-white shadow-xs transition-colors duration-200 select-none">
        {/* Cụm Trái: Hamburger (nếu có) + Logo + Tên trường */}
        <div className="shrink-0 z-20 flex items-center gap-2 sm:gap-2.5">
          {onToggleMobileMenu && isIPadPortrait && (
            <button
              onClick={onToggleMobileMenu}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              title="Danh mục menu"
              aria-label="Mở danh mục menu"
            >
              <Menu className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            </button>
          )}

          <div
            className="flex items-center gap-2.5 cursor-pointer group shrink-0"
            onClick={() => navigate(canAccessAdmin ? ROUTE_PATHS.ADMIN : ROUTE_PATHS.PORTAL)}
          >
            <img
              src="/Logo_QSQK7.png"
              alt="Logo Trường Quân Sự Quân Khu 7"
              style={{ aspectRatio: '1074 / 1465' }}
              className="h-8 sm:h-9 w-auto object-contain shrink-0 group-hover:scale-105 transition-transform drop-shadow-xs"
            />
            <div className="min-w-0">
              <span className="block font-extrabold text-xs sm:text-sm tracking-wider bg-gradient-to-r from-slate-900 via-slate-800 to-amber-600 dark:from-white dark:via-slate-100 dark:to-amber-400 bg-clip-text text-transparent whitespace-nowrap">
                {title}
              </span>
              <span className="block text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-medium -mt-0.5 tracking-wider uppercase whitespace-nowrap">
                {subtitle}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex justify-center px-1 sm:px-2 lg:px-4 min-w-0 overflow-hidden">
          <NavigationGlider activeNav={activeNav} />
        </div>

        <div id="tour-header-controls-ipad" className="shrink-0 z-20 flex items-center gap-1.5 sm:gap-2">
          {!isOnline && (
            <button
              type="button"
              onClick={() => checkConnection()}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/40 text-[10px] font-mono font-bold shrink-0 animate-pulse cursor-pointer select-none"
              title="Mất kết nối máy chủ LAN. Bấm để thử kết nối lại!"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping shrink-0" />
              <span>Mất kết nối</span>
            </button>
          )}

          <DeviceModeSwitch compact />
          <ThemeToggle size="sm" />

          {/* Nút Mở Trợ Lý AI - iPad */}
          <button
            type="button"
            onClick={() => toggleChat()}
            className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 cursor-pointer border select-none ${
              isChatOpen
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 shadow-sm ring-2 ring-emerald-500/20'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-500/40'
            }`}
            title="Trợ lý AI - Dữ liệu Số Quân Khu 7"
            aria-label="Mở Trợ lý AI Dữ liệu Số Quân Khu 7"
          >
            <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400 transition-transform duration-200 hover:scale-110" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  aiStatus === 'online' ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  aiStatus === 'online' ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </span>
          </button>

          {/* User Profile Pill - iPad */}
          <Popover
            content={userPopoverContent}
            trigger="click"
            open={userPopoverOpen}
            onOpenChange={setUserPopoverOpen}
            placement="bottomRight"
            arrow={{ pointAtCenter: true }}
            overlayStyle={{ maxWidth: 'none' }}
            overlayInnerStyle={{ padding: 0 }}
          >
            <button
              type="button"
              className="flex items-center gap-1.5 sm:gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 px-2 sm:px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer shrink-0"
            >
              <div
                className="relative w-6 h-6 rounded-lg bg-gradient-to-tr from-[#14532d] via-[#166534] to-[#15803d] border border-amber-400/40 flex items-center justify-center shrink-0 shadow-xs"
              >
                <span
                  className={`!text-white font-black leading-none select-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] ${
                    avatarInitial.length > 1 ? 'text-[9.5px] tracking-tight' : 'text-xs'
                  }`}
                  style={{ color: '#ffffff' }}
                >
                  {avatarInitial}
                </span>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ring-1 ring-white dark:ring-slate-800 ${
                    isOnline ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                  title={isOnline ? 'Đang trực tuyến' : 'Mất kết nối máy chủ'}
                />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap leading-none">
                {user?.full_name || (isGuestUser ? 'Đại biểu' : 'Khách')}
              </span>

              {showApprovalBadge && (
                <Tooltip
                  title={`${approvalCount} yêu cầu đang chờ Quản trị viên tối cao phê duyệt`}
                  placement="bottom"
                  arrow
                >
                  <span
                    role="status"
                    aria-label={`${approvalCount} yêu cầu chờ duyệt`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setUserPopoverOpen(false);
                      navigate(ROUTE_PATHS.ADMIN);
                    }}
                    className={`inline-flex items-center justify-center gap-0.5 min-w-[22px] h-5 px-1 rounded-md text-[10px] font-mono font-bold border transition-all duration-200 ease-[cubic-bezier(.34,1.45,.64,1)] cursor-pointer select-none shrink-0 hover:scale-110 ${
                      approvalCount >= 10
                        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
                    }`}
                  >
                    <Bell className="w-2.5 h-2.5" />
                    <span className="tabular-nums">{approvalCount > 99 ? '99+' : approvalCount}</span>
                  </span>
                </Tooltip>
              )}

              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  (user?.clearance_level_id || 1) >= 4 ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                title={user?.clearance_name || 'Cấp độ bảo mật'}
              />
            </button>
          </Popover>
        </div>
      </header>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // BRANCH 2: GIAO DIỆN MÁY TÍNH TIÊU CHUẨN (deviceMode === 'pc')
  // ══════════════════════════════════════════════════════════════════════
  return (
    // ✅ FIX: Gộp 2 thẻ <header> bị trùng thành 1
    <header className="sticky top-0 z-30 shrink-0 w-full max-w-full overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-4 lg:px-6 min-h-[4rem] h-[calc(4rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] flex items-center justify-between gap-2 sm:gap-4 text-slate-900 dark:text-white shadow-sm transition-colors duration-200 select-none">
      {/* Vùng Trái: Brand & Optional Drawer Hamburger Button */}
      <div className="shrink-0 z-20 flex items-center space-x-2 sm:space-x-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer flex lg:hidden shrink-0"
            title="Mở thanh điều hướng"
            aria-label="Mở danh mục menu"
          >
            <Menu className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          </button>
        )}

        <div
          className="flex items-center space-x-2.5 sm:space-x-3 cursor-pointer group shrink-0"
          onClick={() => navigate(canAccessAdmin ? ROUTE_PATHS.ADMIN : ROUTE_PATHS.PORTAL)}
        >
          <img
            src="/Logo_QSQK7.png"
            alt="Logo Trường Quân Sự Quân Khu 7"
            style={{ aspectRatio: '1074 / 1465' }}
            className="h-9 sm:h-10 w-auto object-contain shrink-0 group-hover:scale-105 transition-transform drop-shadow-sm"
          />
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-sm sm:text-base lg:text-lg tracking-wider bg-gradient-to-r from-slate-900 via-slate-800 to-amber-600 dark:from-white dark:via-slate-100 dark:to-amber-400 bg-clip-text text-transparent whitespace-nowrap">
                {title}
              </span>
            </div>
            <span className="block text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium -mt-0.5 tracking-wider uppercase whitespace-nowrap">
              {subtitle}
            </span>
          </div>
        </div>
      </div>

      <div className="hidden sm:flex flex-1 justify-center items-center px-2 sm:px-4 min-w-0 z-10">
        <NavigationGlider activeNav={activeNav} />
      </div>

      <div id="tour-header-controls" className="flex items-center space-x-1.5 sm:space-x-2 lg:space-x-2.5 shrink-0 z-20">
        {!isOnline && (
          <button
            type="button"
            onClick={() => checkConnection()}
            className="flex items-center space-x-1.5 text-xs font-mono font-bold text-rose-700 dark:text-rose-400 bg-rose-500/15 px-2.5 py-1.5 rounded-lg border border-rose-500/40 shrink-0 animate-pulse cursor-pointer select-none"
            title="Mất kết nối máy chủ LAN. Bấm để thử kết nối lại ngay!"
          >
            <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping shrink-0" />
            <span>Mất kết nối máy chủ</span>
          </button>
        )}

        <div className="shrink-0">
          <DeviceModeSwitch compact />
        </div>

        <div className="shrink-0">
          <ThemeToggle />
        </div>

        {/* Nút Mở Trợ Lý AI - PC */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => toggleChat()}
            className={`relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 cursor-pointer border select-none ${
              isChatOpen
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 shadow-sm ring-2 ring-emerald-500/20'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-500/40'
            }`}
            title="Trợ lý AI - Dữ liệu Số Quân Khu 7"
            aria-label="Mở Trợ lý AI Dữ liệu Số Quân Khu 7"
          >
            <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400 transition-transform duration-200 hover:scale-110" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  aiStatus === 'online' ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  aiStatus === 'online' ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </span>
          </button>
        </div>

        {/* User profile menu Desktop */}
        <div className="shrink-0 z-20">
          <Popover
            content={userPopoverContent}
            trigger="click"
            open={dropdownOpen}
            onOpenChange={setDropdownOpen}
            placement="bottomRight"
            arrow={{ pointAtCenter: true }}
            overlayStyle={{ maxWidth: 'none' }}
            overlayInnerStyle={{ padding: 0 }}
          >
            <button
              type="button"
              className="flex items-center space-x-1.5 sm:space-x-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer shrink-0"
            >
              <div
                className="relative w-7 h-7 rounded-lg bg-gradient-to-tr from-[#14532d] via-[#166534] to-[#15803d] border border-amber-400/40 flex items-center justify-center shrink-0 shadow-xs"
              >
                <span
                  className={`!text-white font-black leading-none select-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] ${
                    avatarInitial.length > 1 ? 'text-[10px] tracking-tight' : 'text-xs'
                  }`}
                  style={{ color: '#ffffff' }}
                >
                  {avatarInitial}
                </span>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-white dark:ring-slate-800 ${
                    isOnline ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                  title={isOnline ? 'Đang trực tuyến' : 'Mất kết nối máy chủ'}
                />
              </div>
              <div className="text-left hidden md:block whitespace-nowrap">
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                  {user?.full_name || (isGuestUser ? 'Đại biểu' : 'Khách')}
                </span>
                <span className="block text-[10px] text-amber-600 dark:text-amber-400 leading-tight font-medium">
                  {user?.clearance_name || `Mức ${user?.clearance_level_id || 1}`}
                </span>
              </div>

              {showApprovalBadge && (
                <Tooltip
                  title={`${approvalCount} yêu cầu đang chờ duyệt`}
                  placement="bottom"
                  arrow
                >
                  <span
                    role="status"
                    aria-label={`${approvalCount} yêu cầu chờ duyệt`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDropdownOpen(false);
                      navigate(ROUTE_PATHS.ADMIN);
                    }}
                    className={`inline-flex items-center gap-1 h-6 px-1.5 rounded-md text-[11px] font-mono font-bold border transition-all duration-200 ease-[cubic-bezier(.34,1.45,.64,1)] cursor-pointer select-none shrink-0 hover:scale-105 ${
                      approvalCount >= 10
                        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
                    }`}
                  >
                    <Bell className="w-3 h-3" />
                    <span className="tabular-nums">{approvalCount > 99 ? '99+' : approvalCount}</span>
                  </span>
                </Tooltip>
              )}

              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0 transition-transform duration-200 ${
                  dropdownOpen ? 'rotate-180 text-emerald-600 dark:text-emerald-400' : ''
                }`}
              />
            </button>
          </Popover>
        </div>
      </div>
    </header>
  );
};

export default Header;