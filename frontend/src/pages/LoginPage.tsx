import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, X, GraduationCap } from 'lucide-react';
import { DualGatewayPortal } from '../components/auth/DualGatewayPortal';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const portalQuery = searchParams.get('portal');

  const { user, isAuthenticated } = useAuth();
  const { deviceMode } = useDeviceMode();

  const [activePortal, setActivePortal] = useState<'datahub' | 'training'>(
    portalQuery === 'training' ? 'training' : 'datahub'
  );
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showTrainingSupportModal, setShowTrainingSupportModal] = useState(false);

  // Đồng bộ state khi URL param thay đổi (ví dụ ?portal=training)
  useEffect(() => {
    if (portalQuery === 'training' && activePortal !== 'training') {
      setActivePortal('training');
    } else if (portalQuery === 'datahub' && activePortal !== 'datahub') {
      setActivePortal('datahub');
    }
  }, [portalQuery]);

  const handlePortalChange = (portal: 'datahub' | 'training') => {
    setActivePortal(portal);
    setSearchParams({ portal }, { replace: true });
  };

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
    const portalName = activePortal === 'training' ? 'Hệ Thống Quản Lý Đào Tạo' : 'Trung Tâm Dữ Liệu Số';
    toast.success(
      `Chào mừng đồng chí ${loggedInUser.full_name || loggedInUser.user_id} đã đăng nhập thành công vào ${portalName}.`,
      {
        title: 'XÁC THỰC THÀNH CÔNG',
        badge: loggedInUser.clearance_name || `CẤP ${loggedInUser.clearance_level_id || 1}`,
        duration: 2000,
      }
    );

    // Khi đăng nhập Admin thì vô thẳng admin-dashboard luôn
    if (isUserAdmin(loggedInUser)) {
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
          !isUserAdmin(loggedInUser)))
    ) {
      redirectUrl = undefined;
    }

    setTimeout(() => {
      if (redirectUrl && redirectUrl !== ROUTE_PATHS.LOGIN && redirectUrl !== ROUTE_PATHS.INDEX) {
        navigate(redirectUrl, { replace: true });
      } else {
        const targetPath = getDestinationByRole(loggedInUser);
        navigate(targetPath, { replace: true });
      }
    }, 500);
  };

  return (
    <div className="h-[100dvh] min-h-[100dvh] max-h-[100dvh] w-full bg-slate-200 dark:bg-[#090e17] text-slate-900 dark:text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans selection:bg-amber-500 selection:text-slate-900 transition-colors duration-200">
      {/* ══════════════════════════════════════════════════════════════════
          LỚP z-0 (ĐÁY): THẺ VIDEO NỀN CÔNG NGHỆ CHẠY VÒNG LẶP (HTML5 VIDEO)
          ══════════════════════════════════════════════════════════════════ */}
      <TechVideoBackground />

      {/* ══════════════════════════════════════════════════════════════════
          LỚP z-10 (GIỮA): TRỐNG ĐỒNG ĐÔNG SƠN & BẢN ĐỒ CHỮ S VIỆT NAM
          ══════════════════════════════════════════════════════════════════ */}
      <DongSonDrumBackground />

      {/* ══════════════════════════════════════════════════════════════════
          LỚP z-15: AMBIENT GRADIENT CỐ ĐỊNH (GIỮ NGUYÊN MÀU TRUNG TÂM DỮ LIỆU SỐ)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="fixed inset-0 pointer-events-none z-15 bg-gradient-to-tr from-emerald-950/30 via-transparent to-amber-900/20" />

      {/* ══════════════════════════════════════════════════════════════════
          LỚP z-30 (TRÊN CÙNG): CỐ ĐỊNH TOP BAR (HEADER) & FOOTER
          ══════════════════════════════════════════════════════════════════ */}
      {/* Top Bar — Cố định 100% ở đỉnh màn hình (Fixed Top Bar) */}
      <header className="fixed top-0 left-0 right-0 z-30 px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md shadow-xs pt-[max(env(safe-area-inset-top),0.625rem)] transition-colors duration-200">
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
            <AnimatePresence mode="wait">
              <motion.span
                key={activePortal}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.2 }}
                className={`block text-[10px] font-bold tracking-wider uppercase transition-colors ${
                  activePortal === 'training'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {activePortal === 'datahub' ? 'Trung tâm dữ liệu số' : 'Hệ thống quản lý đào tạo'}
              </motion.span>
            </AnimatePresence>
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
      </header>

      {/* Center Dual-Gateway Portal Container */}
      <div className="relative z-20 flex-1 w-full overflow-y-auto overflow-x-hidden no-scrollbar flex items-center justify-center px-4 pt-[calc(3.75rem+env(safe-area-inset-top,0px))] pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] min-h-0">
        <DualGatewayPortal
          activePortal={activePortal}
          onPortalChange={handlePortalChange}
          onLoginSuccess={handleLoginSuccess}
          onToast={showToast}
          onOpenTrainingSupport={() => setShowTrainingSupportModal(true)}
        />
      </div>

      {/* Footer — Cố định 100% ở đáy màn hình */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 px-6 py-2.5 sm:py-3 border-t border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center text-[11px] text-slate-500 dark:text-slate-400 text-center pb-[max(env(safe-area-inset-bottom),0.625rem)] transition-colors duration-200">
        <div>Bản quyền © 2026 Trường Quân sự Quân khu 7.</div>
      </footer>

      {/* Support Modal Dữ Liệu Số */}
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
                  Hỗ Trợ Kỹ Thuật Dữ Liệu Số
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

      {/* Support Modal Đào Tạo & Huấn Luyện */}
      <AnimatePresence>
        {showTrainingSupportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-xs space-y-4 text-slate-700 dark:text-slate-300"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  Hỗ Trợ Quản Lý Đào Tạo
                </h3>
                <button
                  onClick={() => setShowTrainingSupportModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p>
                Trường hợp quên mật khẩu tài khoản Quản Lý Đào Tạo hoặc cần phân quyền giảng dạy, vui lòng liên hệ:
              </p>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5 font-mono text-[11px]">
                <div className="font-semibold text-slate-800 dark:text-slate-200">Phòng Đào tạo - Trường Quân sự QK7</div>
                <div>
                  • Số điện thoại:{' '}
                  <span className="text-blue-600 dark:text-blue-400 font-bold">08.68.38.78.69</span>
                  {' '}- Đ/c Tuấn - Đào tạo
                </div>
              </div>
              <button
                onClick={() => setShowTrainingSupportModal(false)}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition cursor-pointer shadow-md shadow-blue-600/30"
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

