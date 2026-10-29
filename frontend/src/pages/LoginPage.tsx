import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, X } from 'lucide-react';
import { LoginForm } from '../components/auth/LoginForm';
import { Toast, ToastState, toast } from '../components/common/Toast';
import { ThemeToggle } from '../components/common/ThemeToggle';
import { DeviceModeSwitch } from '../components/common/DeviceModeSwitch';
import { User } from '../types/user';
import { ROUTE_PATHS } from '../routes/routePaths';
import { useAuth } from '../hooks/useAuth';
import { getDestinationByRole, isUserAdmin } from '../contexts/AuthContext';

import { useDeviceMode } from '../contexts/DeviceModeContext';
import { TechVideoBackground } from '../components/auth/TechVideoBackground';
import { DongSonDrumBackground } from '../components/auth/DongSonDrumBackground';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { deviceMode, orientation } = useDeviceMode();
  const isIPadLandscape = deviceMode === 'ipad' && orientation === 'landscape';

  const [showSupportModal, setShowSupportModal] = useState(false);

  // Nếu user đã đăng nhập hợp lệ, tự động chuyển về trang tương ứng theo Role
  useEffect(() => {
    if (isAuthenticated && user && user.user_id !== 'GUEST') {
      // Khi đăng nhập Admin thì vô thẳng admin-dashboard luôn
      if (isUserAdmin(user)) {
        navigate(ROUTE_PATHS.ADMIN, { replace: true });
        return;
      }

      const state = location.state as { from?: { pathname: string } } | undefined;
      let redirectUrl = state?.from?.pathname;

      if (
        redirectUrl &&
        (redirectUrl.startsWith('/403') ||
          redirectUrl.startsWith('/404') ||
          redirectUrl.startsWith('/500') ||
          ((redirectUrl.startsWith(ROUTE_PATHS.ADMIN) || redirectUrl.startsWith(ROUTE_PATHS.USERS)) &&
            !isUserAdmin(user)))
      ) {
        redirectUrl = undefined;
      }

      if (redirectUrl && redirectUrl !== ROUTE_PATHS.LOGIN && redirectUrl !== ROUTE_PATHS.INDEX) {
        navigate(redirectUrl, { replace: true });
      } else {
        const targetPath = getDestinationByRole(user);
        navigate(targetPath, { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate, location.state]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (type === 'error') toast.error(message);
    else if (type === 'info') toast.info(message);
    else toast.success(message);
  };

  const handleLoginSuccess = (loggedInUser: User) => {
    toast.success(`Chào mừng đồng chí ${loggedInUser.full_name || loggedInUser.user_id} đã đăng nhập thành công vào Trung Tâm Dữ Liệu Số.`, {
      title: 'XÁC THỰC THÀNH CÔNG',
      badge: loggedInUser.clearance_name || `CẤP ${loggedInUser.clearance_level_id || 1}`,
      duration: 4000,
    });

    // Khi đăng nhập Admin thì vô thẳng admin-dashboard luôn
    if (isUserAdmin(loggedInUser)) {
      setTimeout(() => {
        navigate(ROUTE_PATHS.ADMIN, { replace: true });
      }, 500);
      return;
    }

    const state = location.state as { from?: { pathname: string } } | undefined;
    let redirectUrl = state?.from?.pathname;

    if (
      redirectUrl &&
      (redirectUrl.startsWith('/403') ||
        redirectUrl.startsWith('/404') ||
        redirectUrl.startsWith('/500') ||
        ((redirectUrl.startsWith(ROUTE_PATHS.ADMIN) || redirectUrl.startsWith(ROUTE_PATHS.USERS)) &&
          !isUserAdmin(loggedInUser)))
    ) {
      redirectUrl = undefined;
    }

    setTimeout(() => {
      if (redirectUrl && redirectUrl !== ROUTE_PATHS.LOGIN && redirectUrl !== ROUTE_PATHS.INDEX) {
        navigate(redirectUrl, { replace: true });
      } else {
        // Phân quyền điều hướng theo Role
        const targetPath = getDestinationByRole(loggedInUser);
        navigate(targetPath, { replace: true });
      }
    }, 500);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090e17] text-slate-900 dark:text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans selection:bg-amber-500 selection:text-slate-900 transition-colors duration-200">
      {/* ══════════════════════════════════════════════════════════════════
          LỚP z-0 (ĐÁY): THẺ VIDEO NỀN CÔNG NGHỆ CHẠY VÒNG LẶP (HTML5 VIDEO)
          ══════════════════════════════════════════════════════════════════ */}
      <TechVideoBackground />

      {/* ══════════════════════════════════════════════════════════════════
          LỚP z-10 (GIỮA): TRỐNG ĐỒNG ĐÔNG SƠN & BẢN ĐỒ CHỮ S VIỆT NAM
          ══════════════════════════════════════════════════════════════════ */}
      <DongSonDrumBackground />

      {/* ══════════════════════════════════════════════════════════════════
          LỚP z-20 (TRÊN CÙNG): TOP BAR, KHUNG ĐĂNG NHẬP (LOGIN CARD) & UI
          ══════════════════════════════════════════════════════════════════ */}
      {/* Top Bar */}
      <div className="relative z-20 px-4 sm:px-6 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-900 bg-white/70 dark:bg-slate-950/60 backdrop-blur-md">
        <div className="flex items-center space-x-2.5 select-none">
          <img
            src="/Logo_QSQK7.png"
            alt="Logo Trường Quân Sự Quân Khu 7"
            style={{ aspectRatio: '1074 / 1465' }}
            className="h-8 sm:h-9 w-auto object-contain shrink-0 drop-shadow-sm"
          />
          <div>
            <span className="block font-extrabold text-sm tracking-wider text-slate-900 dark:text-white whitespace-nowrap">
              Trường Quân Sự Quân Khu 7
            </span>
            <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wider uppercase">
              Trung tâm dữ liệu số
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <DeviceModeSwitch compact={deviceMode === 'ipad'} />
          <ThemeToggle size="sm" />
          <button
            onClick={() => setShowSupportModal(true)}
            className="hidden sm:flex text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white items-center space-x-1.5 transition cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <span>Hỗ Trợ Kỹ Thuật</span>
          </button>
        </div>
      </div>

      {/* Center Login Card — Hỗ trợ 2 Cột Ngang cho iPad Landscape (1210 x 802) */}
      <div className="relative z-20 flex-1 flex items-center justify-center px-4 py-4 sm:py-6 min-h-0">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className={`w-full mx-auto bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/90 rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-xl ${
            isIPadLandscape ? 'max-w-4xl' : 'max-w-md'
          }`}
        >
          {!isIPadLandscape && (
            <div className="text-center mb-5">
              <div className="inline-flex items-center justify-center mb-2.5">
                <img
                  src="/Logo_QSQK7.png"
                  alt="Logo Trường Quân Sự Quân Khu 7"
                  style={{ aspectRatio: '1074 / 1465' }}
                  className="h-16 w-auto object-contain drop-shadow-md"
                />
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Đăng nhập
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Hệ Thống Quản Lý Dữ Liệu Tập Trung
              </p>
            </div>
          )}

          <LoginForm
            onSuccess={handleLoginSuccess}
            onToast={showToast}
            isSplitDeck={isIPadLandscape}
          />
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="relative z-20 px-6 py-4 border-t border-slate-200 dark:border-slate-900 bg-white/70 dark:bg-slate-950/60 backdrop-blur-md flex items-center justify-center text-[11px] text-slate-500 text-center">
        <div>Bản quyền © 2026 Trường Quân sự Quân khu 7.</div>
      </footer>

      {/* Support Modal */}
      <AnimatePresence>
        {showSupportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-xs space-y-4 text-slate-700 dark:text-slate-300"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  Hỗ Trợ Kỹ Thuật
                </h3>
                <button
                  onClick={() => setShowSupportModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p>
                Trường hợp quên mật khẩu, cài đặt vân tay hoặc không nhận dạng vân tay vui lòng liên hệ:
              </p>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5 font-mono text-[11px]">
                <div className="font-semibold text-slate-800 dark:text-slate-200">Tổ CNTT - Phòng TM-HC - Trường Quân sự QK7</div>
                <div>
                  • Số điện thoại:{' '}
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">08.68.38.78.68</span>
                  {' '}- Đ/c Nam - CNTT
                </div>
              </div>
              <button
                onClick={() => setShowSupportModal(false)}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition cursor-pointer shadow-md shadow-emerald-600/30"
              >
                Đã hiểu
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
