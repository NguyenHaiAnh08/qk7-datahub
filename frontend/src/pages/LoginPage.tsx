import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, HelpCircle, Building2, Server, X } from 'lucide-react';
import { LoginForm } from '../components/auth/LoginForm';
import { Toast, ToastState } from '../components/common/Toast';
import { User } from '../types/user';

export const LoginPage: React.FC = () => {
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: '',
    type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3000);
  };

  const handleLoginSuccess = (user: User) => {
    // If admin or clearance >= 4, can go to admin or desk or portal
    setTimeout(() => {
      if (user.clearance_level_id >= 5) {
        window.location.href = 'admin-dashboard.html';
      } else if (user.clearance_level_id >= 3) {
        window.location.href = 'document-desk.html';
      } else {
        window.location.href = 'portal.html';
      }
    }, 700);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between relative overflow-hidden font-sans selection:bg-emerald-500 selection:text-white">
      {/* Background Military Grid & Glow */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:32px_32px]"></div>
      <div className="absolute top-0 -left-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Bar */}
      <div className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-slate-900 bg-slate-950/60 backdrop-blur-md">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => window.location.href = 'portal.html'}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center border border-emerald-400/30">
            <Building2 className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-wider bg-gradient-to-r from-white to-amber-400 bg-clip-text text-transparent">
              QK7 DATAHUB
            </span>
            <span className="hidden sm:inline-block text-[10px] text-slate-400 ml-2 font-mono">
              SECURE ACCESS GATEWAY
            </span>
          </div>
        </div>

        <button
          onClick={() => setShowSupportModal(true)}
          className="text-xs text-slate-400 hover:text-white flex items-center space-x-1.5 transition"
        >
          <HelpCircle className="w-4 h-4 text-emerald-400" />
          <span>Hỗ Trợ Kỹ Thuật</span>
        </button>
      </div>

      {/* Center Login Card */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl"
        >
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 border border-emerald-400/30 shadow-lg shadow-emerald-950/50 mb-3">
              <ShieldCheck className="w-7 h-7 text-amber-400" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Xác Thực Danh Tính Quân Sự
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Hệ Thống Quản Lý Dữ Liệu Tập Trung — Quân Khu 7
            </p>
          </div>

          <LoginForm onSuccess={handleLoginSuccess} onToast={showToast} />
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-4 border-t border-slate-900 bg-slate-950/60 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
        <div>
          Bản quyền © 2026 Bộ Tư Lệnh Quân Khu 7. Bảo mật cấp ngành.
        </div>
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
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-xs space-y-4 text-slate-300"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-emerald-400" />
                  Hỗ Trợ Kỹ Thuật Đăng Nhập
                </h3>
                <button
                  onClick={() => setShowSupportModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p>
                Trường hợp quên mật khẩu, thẻ nhận dạng hỏng hoặc cần nâng cấp phân quyền truy cập, vui lòng liên hệ:
              </p>
              <div className="p-3 bg-slate-950 rounded-xl space-y-1.5 font-mono text-[11px]">
                <div>• Ban Cơ Yếu — Bộ Tham Mưu Quân Khu 7</div>
                <div>• Đường dây nóng nội bộ: <span className="text-emerald-400 font-bold">789-2244</span></div>
                <div>• Trực ban tác chiến: <span className="text-amber-400 font-bold">028.3844.xxxx</span></div>
              </div>
              <button
                onClick={() => setShowSupportModal(false)}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition"
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
