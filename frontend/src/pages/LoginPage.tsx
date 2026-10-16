import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, HelpCircle, Building2, Server, X } from 'lucide-react';
import { LoginForm } from '../components/auth/LoginForm';
import { Toast, ToastState } from '../components/common/Toast';
import { ThemeToggle } from '../components/common/ThemeToggle';
import { User } from '../types/user';
import { ROUTE_PATHS } from '../routes/routePaths';
import { useAuth } from '../hooks/useAuth';
import { getDestinationByRole, isUserAdmin } from '../contexts/AuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: '',
    type: 'success',
  });

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
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3000);
  };

  const handleLoginSuccess = (loggedInUser: User) => {
    // Khi đăng nhập Admin thì vô thẳng admin-dashboard luôn
    if (isUserAdmin(loggedInUser)) {
      setTimeout(() => {
        navigate(ROUTE_PATHS.ADMIN, { replace: true });
      }, 400);
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      {/* Background Military Grid & Glow */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b08_1px,transparent_1px),linear-gradient(to_bottom,#1e293b08_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:32px_32px]"></div>
      <div className="absolute top-0 -left-40 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-teal-500/10 dark:bg-teal-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Bar */}
      <div className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-900 bg-white/70 dark:bg-slate-950/60 backdrop-blur-md">
        <div className="flex items-center space-x-3 select-none">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center border border-emerald-400/30 shadow-md">
            <Building2 className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-wider bg-gradient-to-r from-slate-900 via-slate-800 to-amber-600 dark:from-white dark:to-amber-400 bg-clip-text text-transparent">
              QK7 DATAHUB
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <ThemeToggle size="sm" />
          <button
            onClick={() => setShowSupportModal(true)}
            className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center space-x-1.5 transition cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Hỗ Trợ Kỹ Thuật</span>
          </button>
        </div>
      </div>

      {/* Center Login Card */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl"
        >
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 border border-emerald-400/30 shadow-lg shadow-emerald-950/30 mb-3">
              <ShieldCheck className="w-7 h-7 text-amber-400" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Xác Thực Danh Tính Quân Sự
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Hệ Thống Quản Lý Dữ Liệu Tập Trung — Quân Khu 7
            </p>
          </div>

          <LoginForm onSuccess={handleLoginSuccess} onToast={showToast} />
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-4 border-t border-slate-200 dark:border-slate-900 bg-white/70 dark:bg-slate-950/60 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
        <div>Bản quyền © 2026 Bộ Tư Lệnh Quân Khu 7. Bảo mật cấp ngành.</div>
        <div className="flex items-center space-x-4">
          <span className="flex items-center gap-1">
            <Server className="w-3.5 h-3.5 text-emerald-500" />
            Máy chủ: QK7-NODE-01 (Hoạt động)
          </span>
          <span>Bản dựng: v2.4-PROD</span>
        </div>
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
                  Hỗ Trợ Kỹ Thuật Đăng Nhập
                </h3>
                <button
                  onClick={() => setShowSupportModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p>
                Trường hợp quên mật khẩu, không nhận dạng vân tay hoặc cần nâng cấp phân quyền truy cập,
                vui lòng liên hệ:
              </p>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5 font-mono text-[11px]">
                <div>Tổ CNTT, Tham mưu - Hành Chính </div>
                <div>
                  • Đường dây nóng nội bộ:{' '}
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">789-2244</span>
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

      {/* Toast */}
      <Toast toast={toast} onClose={() => setToast((prev) => ({ ...prev, show: false }))} />
    </div>
  );
};
