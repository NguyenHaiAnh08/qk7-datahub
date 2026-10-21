import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Popover } from 'antd';
import {
  Building2,
  Building,
  Clock,
  ShieldAlert,
  UploadCloud,
  BookOpen,
  LogOut,
  ChevronDown,
  Menu,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useDeviceMode } from '../../contexts/DeviceModeContext';
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
// COMPONENT: Cụm 4 Nút Điều Hướng Trượt Mượt (Dynamic Sliding Pill Glider)
// Đăng tải • Trung tâm thư viện số • Đơn vị của tôi • Quản trị
// ══════════════════════════════════════════════════════════════════════
const NavigationGlider: React.FC<{
  activeNav?: 'desk' | 'portal' | 'myunit' | 'admin' | 'login';
}> = ({ activeNav }) => {
  const { user, isAdmin, isStaff } = useAuth();
  const { deviceMode } = useDeviceMode();

  const allNavTabs = [
    {
      key: 'desk',
      to: ROUTE_PATHS.DESK,
      label: 'Đăng tải',
      icon: UploadCloud,
      activeColor: 'text-emerald-600 dark:text-emerald-300',
      inactiveColor: 'text-emerald-500',
      visible: Boolean(isStaff || isAdmin),
    },
    {
      key: 'portal',
      to: ROUTE_PATHS.PORTAL,
      label: 'Trung tâm thư viện số',
      icon: BookOpen,
      activeColor: 'text-purple-600 dark:text-purple-300',
      inactiveColor: 'text-blue-500',
      visible: true,
    },
    {
      key: 'myunit',
      to: ROUTE_PATHS.MY_UNIT,
      label: 'Đơn vị của tôi',
      icon: Building,
      activeColor: 'text-violet-600 dark:text-violet-300',
      inactiveColor: 'text-violet-500',
      visible: Boolean(user && user.user_id !== 'GUEST'),
    },
    {
      key: 'admin',
      to: ROUTE_PATHS.ADMIN,
      label: 'Quản trị',
      icon: ShieldAlert,
      activeColor: 'text-amber-600 dark:text-amber-400',
      inactiveColor: 'text-amber-500',
      visible: Boolean(isAdmin),
    },
  ];

  const visibleTabs = allNavTabs.filter((t) => t.visible);

  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const isInitialMount = useRef(true);

  const updateIndicator = useCallback(() => {
    if (!activeNav || !containerRef.current) return;
    const activeEl = tabRefs.current[activeNav];
    if (activeEl) {
      setIndicatorStyle({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
      });
    } else {
      setIndicatorStyle({ left: 0, width: 0 });
    }
  }, [activeNav, visibleTabs.length]);

  useEffect(() => {
    updateIndicator();
    const raf = requestAnimationFrame(() => {
      updateIndicator();
      isInitialMount.current = false;
    });
    window.addEventListener('resize', updateIndicator);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', updateIndicator);
    };
  }, [updateIndicator, deviceMode]);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center bg-slate-200/70 dark:bg-slate-800/80 p-1 sm:p-1.5 rounded-2xl border border-slate-300/50 dark:border-slate-700/60 shadow-xs w-full max-w-[660px] xl:max-w-[760px]"
    >
      {/* Sliding Pill Glider Indicator */}
      <div
        className={`
          pointer-events-none absolute top-1 bottom-1 sm:top-1.5 sm:bottom-1.5 rounded-xl
          bg-white dark:bg-[#722ED1]
          shadow-[0_2px_10px_rgba(114,46,209,0.14)] dark:shadow-[0_4px_16px_rgba(114,46,209,0.45)]
          border border-purple-500/15 dark:border-purple-400/40
          ${isInitialMount.current ? '' : 'transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]'}
        `}
        style={{
          left: `${indicatorStyle.left}px`,
          width: `${indicatorStyle.width}px`,
          opacity: indicatorStyle.width > 0 ? 1 : 0,
        }}
      />

      {visibleTabs.map((tab) => {
        const isActive = activeNav === tab.key;
        const IconComponent = tab.icon;
        return (
          <Link
            key={tab.key}
            ref={(el) => {
              tabRefs.current[tab.key] = el;
            }}
            to={tab.to}
            className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-xs font-semibold whitespace-nowrap transition-colors duration-200 select-none ${
              isActive
                ? 'text-purple-700 dark:text-white font-bold'
                : 'text-slate-600 dark:text-slate-300 hover:text-purple-700 dark:hover:text-white'
            }`}
          >
            <IconComponent
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 transition-transform duration-300 ${
                isActive ? `scale-110 ${tab.activeColor}` : tab.inactiveColor
              }`}
            />
            <span className="truncate">{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
};

export const Header: React.FC<HeaderProps> = ({
  title = 'QK7 DATAHUB',
  subtitle = 'Trung Tâm Quản Lý Dữ Liệu Tập Trung',
  showClock = true,
  activeNav,
  onToggleMobileMenu,
}) => {
  const { user, isAdmin, isStaff, logout } = useAuth();
  const { deviceMode, orientation } = useDeviceMode();
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

  // Nội dung Popover User Profile cho iPad và Desktop
  const userPopoverContent = (
    <div className="w-64 p-1 text-slate-800 dark:text-slate-200 text-xs">
      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
            {user?.user_id || 'Tài khoản'}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
              (user?.clearance_level_id || 1) >= 4
                ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {user?.clearance_name || 'Công khai'}
          </span>
        </div>
        <div className="font-bold text-slate-900 dark:text-white mt-1 text-sm">
          {user?.full_name || 'Khách tra cứu'}
        </div>
        {user?.rank_name && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {user.rank_name} {user.position ? `• ${user.position}` : ''}
          </div>
        )}
        {user?.unit_name && (
          <div className="text-[11px] text-purple-600 dark:text-purple-400 mt-0.5">
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
          <BookOpen className="w-3.5 h-3.5 text-blue-500 mr-2" />
          <span>Trung tâm thư viện số</span>
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
            <Building className="w-3.5 h-3.5 text-violet-500 mr-2" />
            <span>Đơn vị của tôi</span>
          </Link>
        )}

        {(isStaff || isAdmin) && (
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

        {isAdmin && (
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
      </div>

      <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
        <button
          onClick={() => {
            setUserPopoverOpen(false);
            setDropdownOpen(false);
            logout();
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
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3.5 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-4 text-slate-900 dark:text-white shadow-xs transition-colors duration-200 select-none">
        {/* Cụm Trái (shrink-0 flex items-center gap-2): Logo + QK7 DATAHUB trên 1 dòng, KHÔNG có subtitle dài */}
        <div className="shrink-0 flex items-center gap-2">
          {onToggleMobileMenu && isIPadPortrait && (
            <button
              onClick={onToggleMobileMenu}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              title="Danh mục menu"
              aria-label="Mở danh mục menu"
            >
              <Menu className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </button>
          )}

          <div
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => navigate(isAdmin ? ROUTE_PATHS.ADMIN : ROUTE_PATHS.PORTAL)}
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center text-white border border-emerald-400/40 shadow-xs">
              <Building2 className="w-4 h-4 text-amber-400" />
            </div>
            <span className="font-extrabold text-sm sm:text-base tracking-wider bg-gradient-to-r from-slate-900 via-slate-800 to-amber-600 dark:from-white dark:via-slate-100 dark:to-amber-400 bg-clip-text text-transparent whitespace-nowrap">
              QK7 DATAHUB
            </span>
          </div>
        </div>

        {/* Cụm Giữa (flex-1 flex justify-center px-2 sm:px-4 lg:px-6): Căn giữa tuyệt đối & Mở rộng chiều dài */}
        <div className="flex-1 flex justify-center px-2 sm:px-4 lg:px-6 min-w-0">
          <NavigationGlider activeNav={activeNav} />
        </div>

        {/* Cụm Phải (shrink-0 flex items-center gap-2): Switch + Theme + User Profile Pill */}
        <div className="shrink-0 flex items-center gap-2">
          <DeviceModeSwitch compact />
          <ThemeToggle size="sm" />

          {/* User Profile Pill gọn cho iPad */}
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
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            >
              <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                {user?.full_name ? user.full_name[0] : 'K'}
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 max-w-[100px] truncate leading-none">
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
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 h-16 flex items-center justify-between gap-4 text-slate-900 dark:text-white shadow-sm transition-colors duration-200 select-none">
      {/* Vùng Trái: Brand & Optional Drawer Hamburger Button */}
      <div className="shrink-0 flex items-center space-x-2 sm:space-x-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer flex lg:hidden"
            title="Mở thanh điều hướng"
            aria-label="Mở danh mục menu"
          >
            <Menu className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </button>
        )}

        <div
          className="flex items-center space-x-3 cursor-pointer group"
          onClick={() => navigate(isAdmin ? ROUTE_PATHS.ADMIN : ROUTE_PATHS.PORTAL)}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center text-white border border-emerald-400/40 shadow-md group-hover:scale-105 transition-transform">
            <Building2 className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-base sm:text-lg tracking-wider bg-gradient-to-r from-slate-900 via-slate-800 to-amber-600 dark:from-white dark:via-slate-100 dark:to-amber-400 bg-clip-text text-transparent">
                {title}
              </span>
            </div>
            <span className="hidden sm:block text-[10px] text-slate-500 dark:text-slate-400 font-medium -mt-0.5 tracking-wider uppercase">
              {subtitle}
            </span>
          </div>
        </div>
      </div>

      {/* Vùng Phải: Quick Nav Links & Controls */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Live Clock */}
        {showClock && (
          <div className="hidden xl:flex items-center space-x-2 text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            <span>{liveClock || '--:--:--'}</span>
          </div>
        )}

        {/* Quick Nav Links (Nút bấm chuyển trang tiêu chuẩn trên Máy tính) */}
        {(isStaff || isAdmin) && (
          <Link
            to={ROUTE_PATHS.DESK}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              activeNav === 'desk'
                ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/50 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Đăng tải</span>
          </Link>
        )}

        <Link
          to={ROUTE_PATHS.PORTAL}
          className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            activeNav === 'portal'
              ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/50 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Trung tâm thư viện số</span>
        </Link>

        {user && user.user_id !== 'GUEST' && (
          <Link
            to={ROUTE_PATHS.MY_UNIT}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              activeNav === 'myunit'
                ? 'bg-violet-50 dark:bg-violet-950/80 text-violet-700 dark:text-violet-400 border-violet-300 dark:border-violet-500/50 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            <Building className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
            <span>Đơn vị của tôi</span>
          </Link>
        )}

        {isAdmin && (
          <Link
            to={ROUTE_PATHS.ADMIN}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              activeNav === 'admin'
                ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/50 shadow-sm'
                : 'bg-amber-50/70 hover:bg-amber-100/80 dark:bg-amber-950/40 dark:hover:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Quản trị</span>
          </Link>
        )}

        {/* Nút gạt chuyển đổi Máy tính / iPad Air M4 (Gọn trên Header) */}
        <DeviceModeSwitch compact />

        {/* Dark / Light Mode Animated Toggle */}
        <ThemeToggle />

        {/* User profile menu Desktop */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 transition cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-600/20 dark:bg-emerald-600/30 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
              {user?.full_name ? user.full_name[0] : 'K'}
            </div>
            <div className="text-left hidden md:block">
              <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                {user?.full_name || 'Khách'}
              </span>
              <span className="block text-[10px] text-amber-600 dark:text-amber-400 leading-tight">
                {user?.clearance_name || `Mức ${user?.clearance_level_id || 1}`}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl py-2 z-50 text-slate-800 dark:text-slate-200 text-xs"
              >
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">
                    Tài khoản
                  </span>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {user?.full_name || 'Khách'}
                  </div>
                  <div className="text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">
                    {user?.clearance_name || 'Công khai'}
                  </div>
                </div>

                <div className="py-1">
                  <Link
                    to={ROUTE_PATHS.PORTAL}
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <BookOpen className="w-4 h-4 text-blue-500 dark:text-blue-400 mr-2.5" />
                    <span>Trung tâm thư viện số</span>
                  </Link>

                  {user && user.user_id !== 'GUEST' && (
                    <Link
                      to={ROUTE_PATHS.MY_UNIT}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <Building className="w-4 h-4 text-violet-500 dark:text-violet-400 mr-2.5" />
                      <span>Đơn vị của tôi</span>
                    </Link>
                  )}

                  {(isStaff || isAdmin) && (
                    <Link
                      to={ROUTE_PATHS.DESK}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <UploadCloud className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mr-2.5" />
                      <span>Đăng tải văn bản</span>
                    </Link>
                  )}
                  {isAdmin && (
                    <Link
                      to={ROUTE_PATHS.ADMIN}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <ShieldAlert className="w-4 h-4 text-amber-500 dark:text-amber-400 mr-2.5" />
                      <span>Trung tâm quản trị hệ thống</span>
                    </Link>
                  )}
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center px-4 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition text-left cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 mr-2.5" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

export default Header;
