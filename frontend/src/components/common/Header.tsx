import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Clock,
  Shield,
  ShieldAlert,
  UploadCloud,
  BookOpen,
  LogOut,
  Sun,
  Moon,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showClock?: boolean;
  activeNav?: 'desk' | 'portal' | 'admin' | 'login';
}

export const Header: React.FC<HeaderProps> = ({
  title = 'QK7 DATAHUB',
  subtitle = 'Cổng Quản Lý Dữ Liệu Tập Trung',
  showClock = true,
  activeNav
}) => {
  const { user, isAdmin, logout } = useAuth();
  const [liveClock, setLiveClock] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return document.documentElement.classList.contains('dark') || true;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    if (!showClock) return;
    const updateTime = () => setLiveClock(new Date().toLocaleTimeString('vi-VN'));
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [showClock]);

  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 px-4 sm:px-6 h-16 flex items-center justify-between text-white shadow-md">
      {/* Brand */}
      <div className="flex items-center space-x-3 cursor-pointer" onClick={() => window.location.href = 'portal.html'}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center text-white border border-emerald-400/30 shadow-md">
          <Building2 className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-base sm:text-lg tracking-wider bg-gradient-to-r from-white via-slate-100 to-amber-400 bg-clip-text text-transparent">
              {title}
            </span>
          </div>
          <span className="hidden sm:block text-[10px] text-slate-400 font-medium -mt-0.5 tracking-wider uppercase">
            {subtitle}
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-3">
        {/* Live Clock */}
        {showClock && (
          <div className="hidden xl:flex items-center space-x-2 text-xs font-mono text-slate-400 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>{liveClock || '--:--:--'}</span>
          </div>
        )}

        {/* Quick Nav Links */}
        <a
          href="document-desk.html"
          className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            activeNav === 'desk'
              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
          <span>Văn thư</span>
        </a>

        <a
          href="portal.html"
          className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            activeNav === 'portal'
              ? 'bg-blue-950/80 text-blue-400 border-blue-500/50'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-400" />
          <span>Portal</span>
        </a>

        {isAdmin && (
          <a
            href="admin-dashboard.html"
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              activeNav === 'admin'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                : 'bg-amber-950/40 hover:bg-amber-950/60 text-amber-400 border-amber-500/30'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Quản trị</span>
          </a>
        )}

        {/* Dark Mode Toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          title="Đổi Dark/Light mode"
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User profile menu */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700/80 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-xs">
              {user?.full_name ? user.full_name[0] : 'K'}
            </div>
            <div className="text-left hidden md:block">
              <span className="block text-xs font-bold text-slate-200 leading-tight">
                {user?.full_name || 'Khách'}
              </span>
              <span className="block text-[10px] text-amber-400 leading-tight">
                {user?.clearance_name || `Mức ${user?.clearance_level_id || 1}`}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-2 z-50 text-slate-200 text-xs"
              >
                <div className="px-4 py-2.5 border-b border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Tài khoản</span>
                  <div className="font-bold text-white mt-0.5">{user?.full_name || 'Khách'}</div>
                  <div className="text-emerald-400 text-[11px] font-semibold">{user?.clearance_name || 'Công khai'}</div>
                </div>

                <div className="py-1">
                  <a href="portal.html" className="flex items-center px-4 py-2 hover:bg-slate-800 transition">
                    <BookOpen className="w-4 h-4 text-blue-400 mr-2.5" />
                    <span>Cổng tra cứu tài liệu</span>
                  </a>
                  <a href="document-desk.html" className="flex items-center px-4 py-2 hover:bg-slate-800 transition">
                    <UploadCloud className="w-4 h-4 text-emerald-400 mr-2.5" />
                    <span>Bàn làm việc văn thư</span>
                  </a>
                  {isAdmin && (
                    <a href="admin-dashboard.html" className="flex items-center px-4 py-2 hover:bg-slate-800 transition">
                      <ShieldAlert className="w-4 h-4 text-amber-400 mr-2.5" />
                      <span>Trung tâm quản trị hệ thống</span>
                    </a>
                  )}
                </div>

                <div className="border-t border-slate-800 pt-1">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center px-4 py-2 text-rose-400 hover:bg-rose-950/30 transition text-left cursor-pointer"
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
