/* <!-- Lucian UX/UI Prompt #058 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#058 --> */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Popover, Tooltip } from 'antd';
import {
  Building,
  Clock,
  ShieldAlert,
  UploadCloud,
  BookOpen,
  LogOut,
  ChevronDown,
  Menu,
  Trash2,      // ⭐ MỚI
  Activity,    // ⭐ MỚI
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useDeviceMode } from '../../contexts/DeviceModeContext';
import { useNetworkStatus } from '../../contexts/NetworkStatusContext';
import { ThemeToggle } from './ThemeToggle';
import { DeviceModeSwitch } from './DeviceModeSwitch';
import { ROUTE_PATHS } from '../../routes/routePaths';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showClock?: boolean;
  activeNav?: 'desk' | 'portal' | 'myunit' | 'admin' | 'login';
  onToggleMobileMenu?: () => void;
}

// ══════════════════════════════════════════════════════════════════════
// COMPONENT: Cụm 4 Nút Điều Hướng Trượt Mượt (Sliding Highlight Pill Navigation #058)
// Đăng tải • Dữ liệu số • Đơn vị của tôi • Quản trị
// ══════════════════════════════════════════════════════════════════════
// Lưu trữ vị trí Pill gần nhất giữa các lần chuyển trang để duy trì chuyển động 2 chiều liên tục (Bidirectional motion)
let lastKnownPillCoords: { left: number; width: number } | null = null;

const NavigationGlider: React.FC<{
  activeNav?: 'desk' | 'portal' | 'myunit' | 'admin' | 'login';
}> = ({ activeNav: explicitActiveNav }) => {
  const { user, isAdmin, isStaff, hasPermission } = useAuth();
  const { deviceMode } = useDeviceMode();
  const location = useLocation();

  // Tự động nhận diện tab đang mở nếu activeNav không được truyền từ page
  const getEffectiveActiveNav = () => {
    if (explicitActiveNav) return explicitActiveNav;
    const path = location.pathname;
    if (path.startsWith(ROUTE_PATHS.DESK)) return 'desk';
    if (path.startsWith(ROUTE_PATHS.MY_UNIT)) return 'myunit';
    if (path.startsWith(ROUTE_PATHS.ADMIN)) return 'admin';
    if (path.startsWith(ROUTE_PATHS.PORTAL)) return 'portal';
    return undefined;
  };

  const activeNav = getEffectiveActiveNav();

  const userUnitName = user?.unit_name?.trim() || 'Đơn vị của tôi';

  const allNavTabs = [
  {
    key: 'desk',
    to: ROUTE_PATHS.DESK,
    label: 'Đăng tải',
    shortLabel: 'Đăng tải',
    icon: UploadCloud,
    activeColor: 'text-white',
    inactiveColor: 'text-emerald-600 dark:text-emerald-400',
    visible:
      hasPermission('DOC_UPLOAD') ||
      hasPermission('DOC_EDIT') ||
      hasPermission('DOC_PARSE'),
  },
  {
    key: 'portal',
    to: ROUTE_PATHS.PORTAL,
    label: 'Dữ liệu số',
    shortLabel: 'Dữ liệu số',
    icon: BookOpen,
    activeColor: 'text-white',
    inactiveColor: 'text-emerald-700 dark:text-emerald-400',
    visible: true,
  },
  {
    key: 'myunit',
    to: ROUTE_PATHS.MY_UNIT,
    label: userUnitName,
    shortLabel: userUnitName,
    icon: Building,
    activeColor: 'text-white',
    inactiveColor: 'text-amber-600 dark:text-amber-500',
    visible: Boolean(user && user.user_id !== 'GUEST'),
  },
  {
    key: 'admin',
    to: ROUTE_PATHS.ADMIN,
    label: 'Quản trị',
    shortLabel: 'Quản trị',
    icon: ShieldAlert,
    activeColor: 'text-white',
    inactiveColor: 'text-amber-600 dark:text-amber-500',
    visible: Boolean(isAdmin),
  },
];

  const visibleTabs = allNavTabs.filter((t) => t.visible);

  const containerRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<Record<string, HTMLElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>(() => {
    return lastKnownPillCoords || { left: 0, width: 0 };
  });
  const isInitialMount = useRef(!lastKnownPillCoords);

  // Chuẩn hóa tính toán tọa độ offset thực tế chính xác tuyệt đối từ container cha
  const updateIndicator = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeEl = tabRefs.current[activeNav || ''];

    if (activeEl) {
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      const x = Math.round(activeRect.left - containerRect.left);
      const w = Math.round(activeRect.width);

      if (w > 0) {
        lastKnownPillCoords = { left: x, width: w };
        // Gán trực tiếp vào CSS variable của DOM node để loại bỏ độ trễ và giật khung hình
        container.style.setProperty('--x', `${x}px`);
        container.style.setProperty('--w', `${w}px`);
        container.style.setProperty('--pill-opacity', '1');

        setIndicatorStyle({ left: x, width: w });
      }
    } else {
      container.style.setProperty('--pill-opacity', '0');
      setIndicatorStyle({ left: 0, width: 0 });
    }
  }, [activeNav, visibleTabs.length, userUnitName]);

  useEffect(() => {
    updateIndicator();
    const raf = requestAnimationFrame(() => {
      updateIndicator();
      isInitialMount.current = false;
    });

    // ResizeObserver đảm bảo Pill cập nhật chuẩn xác khi font chữ, zoom, hoặc breakpoint thay đổi
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(() => {
        updateIndicator();
      });
      ro.observe(containerRef.current);
      Object.values(tabRefs.current).forEach((el) => {
        if (el) ro?.observe(el);
      });
    }

    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(updateIndicator);
    }

    window.addEventListener('resize', updateIndicator);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', updateIndicator);
      if (ro) ro.disconnect();
    };
  }, [updateIndicator, deviceMode, activeNav]);

  return (
    <nav
      ref={containerRef as any}
      aria-label="Điều hướng hệ thống"
      className={`u058-nav relative flex items-center bg-slate-200/80 dark:bg-[#111827]/80 dark:bg-slate-900/80 backdrop-blur-md p-1 sm:p-1.5 rounded-2xl border border-slate-300/70 dark:border-slate-800 shadow-xs w-fit max-w-full select-none ${
        isInitialMount.current ? 'no-transition' : ''
      }`}
      style={{
        '--x': `${indicatorStyle.left}px`,
        '--w': `${indicatorStyle.width}px`,
        '--pill-opacity': indicatorStyle.width > 0 ? 1 : 0,
      } as React.CSSProperties}
    >
      {/* Sliding Pill Highlight Indicator (#058) */}
      <span className="u058-pill" aria-hidden="true" />

      {visibleTabs.map((tab) => {
        const isActive = activeNav === tab.key;
        const IconComponent = tab.icon;
        return (
          <Link
            key={tab.key}
            id={tab.key === 'portal' ? 'tour-nav-portal' : undefined}
            ref={(el) => {
              tabRefs.current[tab.key] = el;
            }}
            to={tab.to}
              onClick={() => {
                const el = tabRefs.current[tab.key];
                const container = containerRef.current;
                if (el && container) {
                  const containerRect = container.getBoundingClientRect();
                  const activeRect = el.getBoundingClientRect();
                  const x = Math.round(activeRect.left - containerRect.left);
                  const w = Math.round(activeRect.width);
                  if (w > 0) {
                    lastKnownPillCoords = { left: x, width: w };
                    container.style.setProperty('--x', `${x}px`);
                    container.style.setProperty('--w', `${w}px`);
                    container.style.setProperty('--pill-opacity', '1');
                    setIndicatorStyle({ left: x, width: w });
                  }
                }
              }}
              data-active={isActive ? 'true' : 'false'}
              className={`u058-tab relative z-10 shrink-0 flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 2xl:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors duration-200 select-none ${
                isActive
                  ? 'is-active !text-white font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
              style={isActive ? { color: '#ffffff' } : undefined}
            >
              <IconComponent
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 transition-transform duration-300 ${
                  isActive ? 'scale-110 !text-white' : tab.inactiveColor
                }`}
                style={isActive ? { color: '#ffffff', stroke: '#ffffff' } : undefined}
              />
              <span
                className="hidden 2xl:inline whitespace-nowrap"
                style={isActive ? { color: '#ffffff' } : undefined}
              >
                {tab.label}
              </span>
              <span
                className="hidden lg:inline 2xl:hidden whitespace-nowrap"
                style={isActive ? { color: '#ffffff' } : undefined}
              >
                {tab.shortLabel}
              </span>
            </Link>
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
  const [liveClock, setLiveClock] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userPopoverOpen, setUserPopoverOpen] = useState(false);

  useEffect(() => {
    if (!showClock) return;
    const updateTime = () => setLiveClock(new Date().toLocaleTimeString('vi-VN'));
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [showClock]);

  const isIPadPortrait = deviceMode === 'ipad' && orientation === 'portrait';

  // ══════════════════════════════════════════════════════════════════════
  // PERMISSION GATES — dùng chung cho Popover, Desktop quick nav và logo click
  // ══════════════════════════════════════════════════════════════════════
  const canAccessDesk =
    hasPermission('DOC_UPLOAD') ||
    hasPermission('DOC_EDIT') ||
    hasPermission('DOC_PARSE');

  const canAccessAdmin =
    hasPermission('SYSTEM_STATS_VIEW') ||
    hasPermission('USER_VIEW') ||
    hasPermission('ROLE_VIEW') ||
    hasPermission('AUDIT_VIEW') ||
    hasPermission('SESSION_VIEW') ||
    isAdmin;

  const canAccessTrash = hasPermission('DOC_TRASH_VIEW');
  const canAccessSessions = hasPermission('SESSION_VIEW');

  // Nội dung Popover User Profile cho iPad và Desktop
  const userPopoverContent = (
    <div className="w-72 p-1 text-slate-800 dark:text-slate-200 text-xs">
      <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider shrink-0">
              {user?.user_id || 'Tài khoản'}
            </span>
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
        <div className="font-bold text-slate-900 dark:text-white mt-1.5 text-sm">
          {user?.full_name || 'Khách tra cứu'}
        </div>
        {(user?.rank_name || user?.position) && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {[user.rank_name, user.position].filter(Boolean).join(' - ')}
          </div>
        )}
        {user?.unit_name && (
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5 font-medium">
            {user.unit_name}
          </div>
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

        {/* ⭐ MỚI — Thùng rác tài liệu */}
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
        )}

        {/* ⭐ MỚI — Phiên đang hoạt động */}
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
  // BRANCH 1: GIAO DIỆN HEADER CHUYÊN BIỆT CHO IPAD AIR M4 (deviceMode === 'ipad')
  // ══════════════════════════════════════════════════════════════════════
  if (deviceMode === 'ipad') {
    return (
      <header className="sticky top-0 z-30 shrink-0 w-full max-w-full overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-4 lg:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4 text-slate-900 dark:text-white shadow-xs transition-colors duration-200 select-none">
        {/* Cụm Trái (shrink-0 z-20 flex items-center gap-2): Logo + Tên trường */}
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

        {/* Cụm Giữa (flex-1 min-w-0 overflow-hidden flex justify-center px-1 sm:px-2 lg:px-4) */}
        <div className="flex-1 flex justify-center px-1 sm:px-2 lg:px-4 min-w-0 overflow-hidden">
          <NavigationGlider activeNav={activeNav} />
        </div>

        {/* Cụm Phải (shrink-0 z-20 flex items-center gap-1.5 sm:gap-2): Switch + Theme + User Profile Pill */}
        <div id="tour-header-controls-ipad" className="shrink-0 z-20 flex items-center gap-1.5 sm:gap-2">
          {/* Live Indicator Trạng Thái Kết Nối - Chỉ cảnh báo khi mất kết nối máy chủ */}
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

          {/* User Profile Pill - Hiển thị đầy đủ họ tên quân nhân */}
          <Popover
            content={userPopoverContent}
            trigger="click"
            open={userPopoverOpen}
            onOpenChange={setUserPopoverOpen}
            placement="bottomRight"
            arrow={{ pointAtCenter: true }}
          >
            <button
              type="button"
              className="flex items-center gap-1.5 sm:gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 px-2 sm:px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer shrink-0"
            >
              <div
                className="relative w-6 h-6 rounded-lg bg-gradient-to-tr from-[#14532d] via-[#166534] to-[#15803d] border border-amber-400/40 flex items-center justify-center shrink-0 shadow-xs"
              >
                <span
                  className="!text-white font-black text-xs leading-none select-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]"
                  style={{ color: '#ffffff' }}
                >
                  {user?.full_name ? user.full_name[0].toUpperCase() : 'K'}
                </span>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ring-1 ring-white dark:ring-slate-800 ${
                    isOnline ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                  title={isOnline ? 'Đang trực tuyến' : 'Mất kết nối máy chủ'}
                />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap leading-none">
                {user?.full_name || 'Khách'}
              </span>
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
    <header className="sticky top-0 z-30 shrink-0 w-full max-w-full overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-4 lg:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4 text-slate-900 dark:text-white shadow-sm transition-colors duration-200 select-none">
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

      {/* Vùng Phải: Quick Nav Links & Controls */}
      <div id="tour-header-controls" className="flex items-center space-x-1.5 sm:space-x-2 lg:space-x-2.5 shrink-0 z-20">
        {/* Live Network Indicator - Chỉ hiển thị nút cảnh báo nếu mất kết nối máy chủ (trạng thái bình thường chuyển vào bản thông tin user để tiết kiệm diện tích khung hình) */}
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

        {/* Cụm Điều Hướng Trượt Mượt (Sliding Highlight Pill Navigation #058) */}
        <div className="hidden sm:flex items-center shrink-0">
          <NavigationGlider activeNav={activeNav} />
        </div>

        {/* Nút gạt chuyển đổi Máy tính / iPad Air M4 (Gọn trên Header) */}
        <div className="shrink-0">
          <DeviceModeSwitch compact />
        </div>

        {/* Dark / Light Mode Animated Toggle */}
        <div className="shrink-0">
          <ThemeToggle />
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
          >
            <button
              type="button"
              className="flex items-center space-x-1.5 sm:space-x-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 px-2 sm:px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 transition cursor-pointer shrink-0"
            >
              <div
                className="relative w-7 h-7 rounded-lg bg-gradient-to-tr from-[#14532d] via-[#166534] to-[#15803d] border border-amber-400/40 flex items-center justify-center shrink-0 shadow-xs"
              >
                <span
                  className="!text-white font-black text-xs leading-none select-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]"
                  style={{ color: '#ffffff' }}
                >
                  {user?.full_name ? user.full_name[0].toUpperCase() : 'K'}
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
                  {user?.full_name || 'Khách'}
                </span>
                <span className="block text-[10px] text-amber-600 dark:text-amber-400 leading-tight font-medium">
                  {user?.clearance_name || `Mức ${user?.clearance_level_id || 1}`}
                </span>
              </div>
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