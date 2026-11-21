/* <!-- Dual-Gateway Sliding Login Portal · Trường Quân Sự Quân Khu 7 --> */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  GraduationCap,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { User } from '../../types/user';
import { LoginForm } from './LoginForm';
import { TrainingLoginForm } from './TrainingLoginForm';

export interface DualGatewayPortalProps {
  activePortal: 'datahub' | 'training';
  onPortalChange: (portal: 'datahub' | 'training') => void;
  onLoginSuccess: (user: User) => void;
  onToast: (message: string, type: 'success' | 'error' | 'info') => void;
  onOpenTrainingSupport: () => void;
}

export const DualGatewayPortal: React.FC<DualGatewayPortalProps> = ({
  activePortal,
  onPortalChange,
  onLoginSuccess,
  onToast,
  onOpenTrainingSupport,
}) => {
  return (
    <div className="w-full flex flex-col items-center justify-center">
      {/* ══════════════════════════════════════════════════════════════════
          1. MORPHING PILL SELECTOR CHO MOBILE & MÀN HÌNH NHỎ (< 768px)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden w-full max-w-sm mb-3">
        <div className="p-1 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-md backdrop-blur-md flex items-center">
          <button
            type="button"
            onClick={() => onPortalChange('datahub')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activePortal === 'datahub'
                ? 'bg-gradient-to-r from-[#14532d] to-[#166534] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Dữ Liệu Số</span>
          </button>

          <button
            type="button"
            onClick={() => onPortalChange('training')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activePortal === 'training'
                ? 'bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 text-amber-300" />
            <span>Quản Lý Đào Tạo</span>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          2. MOBILE CARD VIEW (< 768px): HIỂN THỊ FORM TƯƠNG ỨNG
          ══════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xl">
        <AnimatePresence mode="wait">
          {activePortal === 'datahub' ? (
            <motion.div
              key="mobile-datahub"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
            >
              <div className="text-center mb-4">
                <img
                  src="/Logo_QSQK7.png"
                  alt="Logo Trường Quân Sự Quân Khu 7"
                  className="h-14 w-auto object-contain mx-auto drop-shadow-md mb-2"
                />
                <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Trung Tâm Dữ Liệu Số
                </h1>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Hệ Thống Quản Lý Dữ Liệu Tập Trung
                </p>
              </div>
              <LoginForm onSuccess={onLoginSuccess} onToast={onToast} compact={true} />
            </motion.div>
          ) : (
            <motion.div
              key="mobile-training"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <TrainingLoginForm
                onSuccess={onLoginSuccess}
                onToast={onToast}
                onForgotPassword={onOpenTrainingSupport}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          3. DESKTOP & TABLET: THE DOUBLE-SLIDER CONTAINER (>= 768px)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:block relative w-full max-w-[980px] min-h-[620px] rounded-[28px] overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.18)] border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all">
        {/* ── FORM BÊN TRÁI: TRUNG TÂM DỮ LIỆU SỐ ── */}
        <div
          className={`absolute top-0 left-0 w-1/2 h-full p-6 sm:p-7 flex flex-col justify-center overflow-y-auto no-scrollbar bg-white dark:bg-slate-900 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
            activePortal === 'datahub'
              ? 'translate-x-0 opacity-100 pointer-events-auto visible z-10 blur-0'
              : '-translate-x-8 opacity-0 pointer-events-none invisible z-0 blur-[1px]'
          }`}
        >
          {/* Header Form Trái */}
          <div className="text-center mb-3.5">
            <div className="inline-flex items-center justify-center mb-1.5">
              <img
                src="/Logo_QSQK7.png"
                alt="Logo Trường Quân Sự Quân Khu 7"
                style={{ aspectRatio: '1074 / 1465' }}
                className="h-12 sm:h-14 w-auto object-contain drop-shadow-md"
              />
            </div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              Trung Tâm Dữ Liệu Số
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Hệ Thống Quản Lý Dữ Liệu Tập Trung
            </p>
          </div>

          <LoginForm onSuccess={onLoginSuccess} onToast={onToast} compact={true} />
        </div>

        {/* ── FORM BÊN PHẢI: HỆ THỐNG QUẢN LÝ ĐÀO TẠO ── */}
        <div
          className={`absolute top-0 left-1/2 w-1/2 h-full p-6 sm:p-7 flex flex-col justify-center overflow-y-auto no-scrollbar bg-white dark:bg-slate-900 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
            activePortal === 'training'
              ? 'translate-x-0 opacity-100 pointer-events-auto visible z-10 blur-0'
              : 'translate-x-8 opacity-0 pointer-events-none invisible z-0 blur-[1px]'
          }`}
        >
          <TrainingLoginForm
            onSuccess={onLoginSuccess}
            onToast={onToast}
            onForgotPassword={onOpenTrainingSupport}
          />
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            4. TẤM OVERLAY TRƯỢT CHIẾN THUẬT (DOUBLE-SLIDER PARALLAX)
            ══════════════════════════════════════════════════════════════════ */}
        <div
          className={`tactical-overlay-hud absolute top-0 left-1/2 w-1/2 h-full overflow-hidden z-30 transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
            activePortal === 'training' ? '-translate-x-full' : 'translate-x-0'
          }`}
        >
          {/* Lớp nền bên trong (Rộng 200%, dịch ngược chiều tạo hiệu ứng Parallax mượt) */}
          <div
            className={`relative -left-full w-[200%] h-full transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
              activePortal === 'training' ? 'translate-x-1/2' : 'translate-x-0'
            }`}
          >
            {/* Nền Gradient chuyển sắc: Trái (Lục Quân) -> Phải (Cobalt Navy) */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#052E16] via-[#166534] via-45% to-[#0F172A] to-100%" />
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-[#1E3A8A]/40 to-blue-950/70 pointer-events-none" />

            {/* Lưới kỹ thuật số radial-gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none opacity-80" />

            {/* 4 Reticle HUD siêu mảnh */}
            <div className="absolute top-3.5 left-4 font-mono text-white/40 text-[10px] select-none">⌜</div>
            <div className="absolute top-3.5 right-4 font-mono text-white/40 text-[10px] select-none">⌝</div>
            <div className="absolute bottom-3.5 left-4 font-mono text-white/40 text-[10px] select-none">⌞</div>
            <div className="absolute bottom-3.5 right-4 font-mono text-white/40 text-[10px] select-none">⌟</div>

            {/* 2 Vòng tròn kính mờ lớn lệch pha (Neumorphic Glass Rings) */}
            <div
              className={`absolute -top-16 -right-16 w-64 h-64 rounded-full border border-[#C5A880]/30 bg-white/[0.04] backdrop-blur-md pointer-events-none transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${
                activePortal === 'training'
                  ? 'translate-x-8 translate-y-8 scale-110'
                  : 'translate-x-0 translate-y-0 scale-100'
              }`}
            />
            <div
              className={`absolute -bottom-20 -left-20 w-80 h-80 rounded-full border border-[#C5A880]/25 bg-white/[0.04] backdrop-blur-md pointer-events-none transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${
                activePortal === 'training'
                  ? '-translate-x-8 -translate-y-8 scale-110'
                  : 'translate-x-0 translate-y-0 scale-100'
              }`}
            />

            {/* ── NỬA PHẢI CỦA OVERLAY: Mời chuyển sang Quản Lý Đào Tạo (Hiện khi ở DataHub) ── */}
            <div className="absolute top-0 right-0 w-1/2 h-full flex flex-col items-center justify-center p-8 sm:p-10 text-white text-center select-none">
              <div className="w-16 h-16 rounded-3xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center mb-4 shadow-xl shadow-blue-950/40 group">
                <GraduationCap className="w-9 h-9 text-[#C5A880] stroke-[2.2] drop-shadow-md" />
              </div>

              <h2
                className="text-2xl font-black tracking-tight mb-2 text-white drop-shadow-md"
                style={{ color: '#ffffff' }}
              >
                Hệ Thống Quản Lý Đào Tạo
              </h2>

              <p
                className="overlay-subtext text-xs text-slate-100 max-w-xs leading-relaxed mb-5 font-normal"
                style={{ color: 'rgba(241, 245, 249, 0.92)' }}
              >
                Điều hành chương trình huấn luyện, quản lý học viên, lịch giảng dạy và theo dõi kết quả đào tạo toàn Trường.
              </p>

              {/* 3 chips điểm nhấn */}
              <div className="flex flex-wrap justify-center gap-1.5 mb-6 max-w-xs">
                <span className="overlay-chip px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-xs">
                  Lịch huấn luyện
                </span>
                <span className="overlay-chip px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-xs">
                  Quản lý học viên
                </span>
                <span className="overlay-chip px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-xs">
                  Đánh giá kết quả
                </span>
              </div>

              {/* Nút chuyển đổi: Chuyển sang Quản lý Đào tạo */}
              <button
                type="button"
                onClick={() => onPortalChange('training')}
                className="overlay-btn-training group relative px-6 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all duration-300 shadow-xl cursor-pointer flex items-center gap-2 overflow-hidden active:scale-95"
              >
                <span>Chuyển sang Quản lý Đào tạo</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
              
            {/* ── NỬA TRÁI CỦA OVERLAY: Mời quay lại Trung Tâm Dữ Liệu Số (Hiện khi ở Training) ── */}
            <div className="absolute top-0 left-0 w-1/2 h-full flex flex-col items-center justify-center p-8 sm:p-10 text-white text-center select-none">
              <div className="w-16 h-16 rounded-3xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center mb-4 shadow-xl shadow-emerald-950/40">
                <ShieldCheck className="w-9 h-9 text-emerald-400 stroke-[2.2] drop-shadow-md" />
              </div>

              <h2
                className="text-2xl font-black tracking-tight mb-2 text-white drop-shadow-md"
                style={{ color: '#ffffff' }}
              >
                Trung Tâm Dữ Liệu Số
              </h2>

              <p
                className="overlay-subtext text-xs text-slate-100 max-w-xs leading-relaxed mb-5 font-normal"
                style={{ color: 'rgba(241, 245, 249, 0.92)' }}
              >
                Lưu trữ, tra cứu, trình duyệt văn bản quân sự bảo mật đa cấp độ từ Công khai đến Tuyệt mật.
              </p>

              {/* 3 chips điểm nhấn */}
              <div className="flex flex-wrap justify-center gap-1.5 mb-6 max-w-xs">
                <span className="overlay-chip px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-xs">
                  Bảo mật đa cấp
                </span>
                <span className="overlay-chip px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-xs">
                  Ký duyệt phân cấp
                </span>
                <span className="overlay-chip px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-xs">
                  Watermark động
                </span>
              </div>

              {/* Nút chuyển đổi: Quay lại Trung tâm Dữ liệu số */}
              <button
                type="button"
                onClick={() => onPortalChange('datahub')}
                className="overlay-btn-datahub group relative px-6 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all duration-300 shadow-xl cursor-pointer flex items-center gap-2 overflow-hidden active:scale-95"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span>Quay lại Trung tâm Dữ liệu số</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
