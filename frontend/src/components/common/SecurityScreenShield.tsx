import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, CameraOff, AlertTriangle, CheckCircle2, Lock, LogOut } from 'lucide-react';
import { DocumentItem } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { ViolationInfo } from '../../hooks/useAntiScreenshot';

export interface SecurityScreenShieldProps {
  active: boolean;
  document: DocumentItem | null;
  violationInfo: ViolationInfo | null;
  violationCount?: number;
  isAccountLocked?: boolean;
  onDismiss: () => void;
  onLockoutLogout?: () => void;
}

/**
 * 🛡️ GIAO DIỆN CẢNH BÁO PHÁT HIỆN HÀNH VI CHỤP MÀN HÌNH (SECURITY SCREEN SHIELD)
 * 
 * - Kích thước nhỏ gọn (Compact 390px), tuyệt đối không tràn viền hay che khuất trên PC / iPad / Laptop.
 * - Nhận diện chính xác từng loại thao tác chụp ảnh (Win + Shift + S, Zalo, PrintScreen).
 * - Chuẩn hóa màu sắc hài hòa theo Giao thức Ngày & Đêm (Light Mode: chữ đen rõ nét; Dark Mode: chữ trắng sáng rõ nét).
 * - CƠ CHẾ BẢO VỆ 3 LẦN:
 *   + Lần 1/3: Cảnh báo an ninh quân sự.
 *   + Lần 2/3: Cảnh báo nghiêm trọng.
 *   + Lần 3/3: Cảnh báo khẩn cấp (Ngưỡng tối đa).
 *   + Quá 3 lần (> 3 lần): KHÓA TÀI KHOẢN TOÀN HỆ THỐNG, buộc liên hệ Quản trị viên để mở khóa.
 */
export const SecurityScreenShield: React.FC<SecurityScreenShieldProps> = ({
  active,
  document,
  violationInfo,
  violationCount = 1,
  isAccountLocked = false,
  onDismiss,
  onLockoutLogout,
}) => {
  const { user } = useAuth();

  if (!active) return null;

  const locked = isAccountLocked || violationCount > 3;

  const getTriggerLabel = () => {
    switch (violationInfo?.triggerType) {
      case 'WIN_SHIFT_S':
        return 'Tổ hợp phím Win + Shift + S (Snipping Tool)';
      case 'ZALO_CAPTURE':
        return 'Tổ hợp phím Ctrl + Alt + S (Chụp ảnh Zalo)';
      case 'PRINT_SCREEN':
        return 'Phím PrintScreen (Chụp toàn màn hình)';
      case 'OS_SNIPPING':
        return 'Công cụ cắt ảnh màn hình (Snipping Tool)';
      case 'CLIPBOARD_PASTE':
        return 'Trích xuất hình ảnh trái phép vào bộ nhớ tạm';
      default:
        return 'Phím tắt chụp màn hình hệ điều hành';
    }
  };

  const triggerLabel = getTriggerLabel();

  // Tên và mã quân nhân hiển thị chuẩn theo ngày và đêm
  const userName = user?.full_name || sessionStorage.getItem('qk7_name') || 'Quân nhân';
  const userId = user?.user_id || sessionStorage.getItem('qk7_username') || '';

  // Định dạng Huy hiệu theo cấp độ vi phạm
  const getBadgeContent = () => {
    if (locked) {
      return {
        text: '🚨 TÀI KHOẢN ĐÃ BỊ KHÓA TOÀN HỆ THỐNG',
        classes: 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-400 border-red-300 dark:border-red-600/60 font-black animate-pulse',
      };
    }
    if (violationCount === 3) {
      return {
        text: '⚠️ LẦN 3 / 3 — CẢNH BÁO KHẨN CẤP (NGƯỠNG TỐI ĐA)',
        classes: 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500 font-extrabold',
      };
    }
    if (violationCount === 2) {
      return {
        text: '⚠️ LẦN 2 / 3 — CẢNH BÁO NGHIÊM TRỌNG',
        classes: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/50 font-bold',
      };
    }
    return {
      text: '🛡️ LẦN 1 / 3 — CẢNH BÁO AN NINH QUÂN SỰ',
      classes: 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/40 font-bold',
    };
  };

  const badge = getBadgeContent();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/65 dark:bg-slate-950/95 backdrop-blur-md select-none"
      >
        <div className={`relative max-w-[450px] w-full bg-white dark:bg-slate-900 border-2 ${
          locked ? 'border-red-600 dark:border-red-500' : 'border-rose-300 dark:border-rose-600/70'
        } rounded-2xl p-3.5 sm:p-4 text-center shadow-[0_10px_35px_rgba(244,63,94,0.25)] dark:shadow-[0_0_40px_rgba(225,29,72,0.4)] space-y-2.5 max-h-[88vh] overflow-y-auto transition-colors`}>
          
          {/* Pulsating Security Badge */}
          <div className="relative inline-flex items-center justify-center mt-0.5">
            <span className={`animate-ping absolute inline-flex h-10 w-10 rounded-full ${
              locked ? 'bg-red-500 opacity-40' : 'bg-rose-400 opacity-25 dark:bg-rose-500 dark:opacity-30'
            }`} />
            <div className={`relative w-10 h-10 rounded-xl ${
              locked
                ? 'bg-red-100 dark:bg-red-950 border border-red-500 text-red-600 dark:text-red-400'
                : 'bg-rose-50 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/50 text-rose-600 dark:text-rose-400'
            } flex items-center justify-center shadow-xs`}>
              {locked ? <Lock className="w-5 h-5 animate-bounce" /> : <CameraOff className="w-5 h-5" />}
            </div>
          </div>

          <div className="space-y-1">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wider uppercase border ${badge.classes}`}>
              <ShieldAlert className="w-3 h-3 shrink-0" />
              <span>{badge.text}</span>
            </div>

            <h3 className={`text-sm sm:text-base font-black tracking-tight uppercase ${
              locked ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-white'
            }`}>
              {locked ? 'Đình Chỉ Truy Cập Do Vi Phạm Bảo Mật' : 'Phát Hiện Hành Vi Chụp Màn Hình'}
            </h3>

            <p className="text-[10.5px] text-rose-700 dark:text-rose-300 font-medium leading-relaxed max-w-xs mx-auto">
              {locked
                ? `Đồng chí đã thực hiện hành vi chụp / trích xuất tài liệu quân sự vượt quá 3 lần (${violationCount} lần). Toàn bộ quyền truy cập đã bị đình chỉ.`
                : violationCount === 3
                ? 'ĐÂY LÀ LẦN CẢNH BÁO THỨ 3 (NGƯỠNG TỐI ĐA)! Nếu tiếp tục vi phạm thêm 1 lần nữa, tài khoản sẽ lập tức BỊ KHÓA TOÀN HỆ THỐNG.'
                : violationCount === 2
                ? 'Đã phát hiện vi phạm lần 2. Nếu vi phạm quá 3 lần, tài khoản của đồng chí sẽ tự động bị khóa toàn hệ thống.'
                : 'Văn bản quân sự được bảo vệ nghiêm ngặt. Nội dung tài liệu tạm thời bị khóa che mờ để ngăn chặn thất thoát dữ liệu.'}
            </p>
          </div>

          {/* Chi tiết sự kiện vi phạm (Đảm bảo độ tương phản hoàn hảo giữa Ngày & Đêm) */}
          <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-left text-xs space-y-1.5 font-mono text-slate-800 dark:text-slate-200 shadow-xs">
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800/80 pb-1">
              <span className="text-slate-500 dark:text-slate-400 font-medium text-[10.5px]">Văn bản:</span>
              <span className="font-bold text-amber-700 dark:text-amber-400 text-right text-[11px]">
                {document?.document_code || 'VĂN BẢN'}
              </span>
            </div>
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800/80 pb-1">
              <span className="text-slate-500 dark:text-slate-400 font-medium text-[10.5px]">Quân nhân:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 text-right text-[11px]">
                {userName}{userId ? ` (${userId})` : ''}
              </span>
            </div>
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800/80 pb-1">
              <span className="text-slate-500 dark:text-slate-400 font-medium text-[10.5px]">Số lần vi phạm:</span>
              <span className={`font-black text-right text-[11px] ${
                locked ? 'text-red-600 dark:text-red-400' : violationCount === 3 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'
              }`}>
                {violationCount} / 3 lần {locked ? '(QUÁ HẠN MỨC - ĐÃ KHÓA)' : ''}
              </span>
            </div>
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800/80 pb-1">
              <span className="text-slate-500 dark:text-slate-400 font-medium text-[10.5px]">Thao tác:</span>
              <span className="text-rose-600 dark:text-rose-400 font-bold text-right text-[11px] max-w-[210px] truncate" title={triggerLabel}>
                {triggerLabel}
              </span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-slate-500 dark:text-slate-400 font-medium text-[10.5px]">Thời gian:</span>
              <span className="text-slate-700 dark:text-slate-300 text-right font-medium text-[10.5px]">
                {violationInfo?.time || new Date().toLocaleTimeString('vi-VN')}
              </span>
            </div>
          </div>
    
          {/* Lời nhắc điều lệnh */}
          <div className={`flex items-start gap-1.5 border rounded-xl p-2 text-left text-[10px] shadow-xs leading-snug ${
            locked
              ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
              : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25 text-amber-900 dark:text-amber-300'
          }`}>
            <AlertTriangle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
              locked ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
            }`} />
            <p>
              {locked ? (
                <span>
                  <strong>YÊU CẦU:</strong> Tài khoản đã bị khóa trong Cơ sở Dữ liệu. Đồng chí buộc phải liên hệ <strong>Quản trị viên hệ thống</strong> để làm thủ tục mở khóa.
                </span>
              ) : (
                <span>
                  Sự kiện ghi nhận tự động vào <strong>Nhật ký kiểm toán an ninh</strong> và gửi cảnh báo tới Quản trị viên.
                </span>
              )}
            </p>
          </div>

          {/* Nút hành động - Chuẩn 1 dòng duy nhất (whitespace-nowrap) */}
          {locked ? (
            <button
              type="button"
              onClick={onLockoutLogout}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-red-700 via-rose-800 to-red-700 hover:from-red-600 hover:to-red-700 text-white text-[11px] font-bold rounded-xl transition cursor-pointer shadow-md shadow-rose-950/40 border border-rose-500/50 flex items-center justify-center gap-1.5 active:scale-[0.98] whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap truncate">Đăng xuất (Liên hệ Quản trị viên mở khóa)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onDismiss}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-rose-600 via-rose-700 to-rose-600 hover:from-rose-500 hover:to-rose-600 text-white text-[11px] font-bold rounded-xl transition cursor-pointer shadow-md shadow-rose-600/20 dark:shadow-rose-950/30 border border-rose-500/40 flex items-center justify-center gap-1.5 active:scale-[0.98] whitespace-nowrap"
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap truncate">
                {violationCount >= 3
                  ? 'Tôi đã hiểu và cam kết không tái phạm (Lần 3/3)'
                  : violationCount === 2
                  ? 'Tôi đã hiểu và cam kết không tái phạm (Lần 2/3)'
                  : 'Tôi đã hiểu và cam kết không tái phạm (Lần 1/3)'}
              </span>
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
