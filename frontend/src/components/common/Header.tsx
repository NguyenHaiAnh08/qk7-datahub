import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Building,
  Clock,
  Shield,
  ShieldAlert,
  UploadCloud,
  BookOpen,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ThemeToggle } from './ThemeToggle';
import { ROUTE_PATHS } from '../../routes/routePaths';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showClock?: boolean;
  activeNav?: 'desk' | 'portal' | 'myunit' | 'admin' | 'login';
}

export const Header: React.FC<HeaderProps> = ({
  title = 'QK7 DATAHUB',
  subtitle = 'Cổng Quản Lý Dữ Liệu Tập Trung',
  showClock = true,
  activeNav
}) => {
  const { user, isAdmin, isStaff, logout } = useAuth();
  const navigate = useNavigate();
  const [liveClock, setLiveClock] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (!showClock) return;
    const updateTime = () => setLiveClock(new Date().toLocaleTimeString('vi-VN'));
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [showClock]);

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 h-16 flex items-center justify-between text-slate-900 dark:text-white shadow-sm transition-colors duration-200">
      {/* Brand */}
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

      {/* Right Controls */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Live Clock */}
        {showClock && (
          <div className="hidden xl:flex items-center space-x-2 text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            <span>{liveClock || '--:--:--'}</span>
          </div>
        )}

        {/* Quick Nav Links */}
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
          <span>Portal</span>
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

        {/* Dark / Light Mode Animated Toggle */}
        <ThemeToggle />

        {/* User profile menu */}
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
                    <span>Cổng tra cứu tài liệu</span>
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
