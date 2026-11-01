import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, CameraOff, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { DocumentItem } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { ViolationInfo } from '../../hooks/useAntiScreenshot';

export interface SecurityScreenShieldProps {
  active: boolean;
  document: DocumentItem | null;
  violationInfo: ViolationInfo | null;
  onDismiss: () => void;
}

export const SecurityScreenShield: React.FC<SecurityScreenShieldProps> = ({
  active,
  document,
  violationInfo,
  onDismiss,
}) => {
  const { user } = useAuth();

  if (!active) return null;

  const triggerLabel =
    violationInfo?.triggerType === 'WIN_SHIFT_S'
      ? 'Tổ hợp phím Win + Shift + S / Công cụ cắt ảnh màn hình (Snipping Tool)'
      : 'Phím PrintScreen (Chụp toàn bộ màn hình)';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/98 backdrop-blur-3xl select-none"
      >
        <div className="relative max-w-lg w-full bg-slate-900 border-2 border-rose-600/70 rounded-2xl p-6 sm:p-8 text-center shadow-[0_0_50px_rgba(225,29,72,0.35)] space-y-5">
          {/* Pulsating Security Badge */}
          <div className="relative inline-flex items-center justify-center">
            <span className="animate-ping absolute inline-flex h-16 w-16 rounded-full bg-rose-500 opacity-30" />
            <div className="relative w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-500 shadow-lg">
              <CameraOff className="w-8 h-8" />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider uppercase bg-rose-500/20 text-rose-400 border border-rose-500/40">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>CẢNH BÁO AN NINH TRƯỜNG QUÂN SỰ QUÂN KHU 7</span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white tracking-tight uppercase">
              Phát Hiện Hành Vi Chụp Màn Hình
            </h3>
            <p className="text-xs text-rose-300 font-medium leading-relaxed">
              Văn bản quân sự được bảo vệ nghiêm ngặt. Nội dung tài liệu tạm thời bị khóa che mờ để ngăn chặn thất thoát dữ liệu.
            </p>
          </div>

          {/* Chi tiết sự kiện vi phạm */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-left text-xs space-y-2 font-mono text-slate-300">
            <div className="flex justify-between items-start border-b border-slate-800/80 pb-2">
              <span className="text-slate-400">Văn bản:</span>
              <span className="font-bold text-amber-400 text-right">
                {document?.document_code || 'VĂN BẢN'}
              </span>
            </div>
            <div className="flex justify-between items-start border-b border-slate-800/80 pb-2">
              <span className="text-slate-400">Quân nhân:</span>
              <span className="font-semibold text-white text-right">
                {user?.full_name || 'Khách'} ({user?.user_id || 'USR'})
              </span>
            </div>
            <div className="flex justify-between items-start border-b border-slate-800/80 pb-2">
              <span className="text-slate-400">Thao tác:</span>
              <span className="text-rose-400 font-semibold text-right max-w-[240px] truncate" title={triggerLabel}>
                {triggerLabel}
              </span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-slate-400">Thời gian:</span>
              <span className="text-slate-300 text-right">
                {violationInfo?.time || new Date().toLocaleTimeString('vi-VN')}
              </span>
            </div>
          </div>
    
          {/* Lời nhắc điều lệnh */}
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/25 rounded-xl p-2.5 text-left text-[11px] text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-tight">
              Sự kiện đã được ghi nhận tự động vào <strong>Nhật ký kiểm toán an ninh </strong> và gửi cảnh báo tới Quản trị viên hệ thống.
            </p>
          </div>

          {/* Nút cam kết & gỡ màn chắn */}
          <button
            type="button"
            onClick={onDismiss}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-rose-700 via-rose-600 to-rose-700 hover:from-rose-600 hover:to-rose-500 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-lg shadow-rose-950/40 border border-rose-500/50 flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Tôi đã hiểu và cam kết không tái phạm</span>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

