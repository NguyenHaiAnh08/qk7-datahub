/* <!-- JolyUI & Lucian UX/UI · Animated Toast & Physics Motion System -->
 * Inspired by https://www.jolyui.dev/docs/components/feedback/animated-toast
 * Tactical & Command Center Military Theme:
 * - Success: Xanh Lục Quân (#166534 / #10b981)
 * - Warning: Vàng Kim Quân Hiệu (#d97706 / #fbbf24)
 * - Danger / Security Alert: Đỏ Quân Kỳ (#b91c1c / #f87171)
 * - Info: Tactical Deep Navy / Slate (#2563eb / #60a5fa)
 * Physics: Spring motion (--ux-spring: cubic-bezier(.34, 1.45, .64, 1))
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Info,
  X,
  Compass,
  Radio,
} from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'error' | 'danger' | 'securityAlert' | 'info';

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
  duration?: number; // ms, default 3600
  timestamp?: number;
  badge?: string;
}

export interface ToastOptions {
  title?: string;
  duration?: number;
  badge?: string;
}

// =========================================================================
// Global Event Bus & Helper Function
// Cho phép gọi toast từ bất kỳ service, hook hay event listener nào (HttpErrorListener, v.v.)
// =========================================================================
export const showAnimatedToast = (
  message: string,
  type: ToastType = 'success',
  options?: ToastOptions
) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('qk7:animated-toast', {
        detail: {
          id: 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          message,
          type,
          title: options?.title,
          duration: options?.duration || 3600,
          badge: options?.badge,
          timestamp: Date.now(),
        },
      })
    );
  }
};

export const toast = {
  success: (message: string, options?: ToastOptions) => showAnimatedToast(message, 'success', options),
  warning: (message: string, options?: ToastOptions) => showAnimatedToast(message, 'warning', options),
  error: (message: string, options?: ToastOptions) => showAnimatedToast(message, 'error', options),
  danger: (message: string, options?: ToastOptions) => showAnimatedToast(message, 'danger', options),
  securityAlert: (message: string, options?: ToastOptions) =>
    showAnimatedToast(message, 'securityAlert', {
      title: options?.title || 'CẢNH BÁO AN NINH QUÂN SỰ',
      badge: options?.badge || 'SOC-ALERT',
      duration: options?.duration || 5000,
    }),
  info: (message: string, options?: ToastOptions) => showAnimatedToast(message, 'info', options),
};

// =========================================================================
// Toast Context & Custom Hook
// =========================================================================
interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (message: string, type?: ToastType, options?: ToastOptions) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback an toàn nếu chưa bọc Provider: dùng global dispatcher
    return {
      toasts: [],
      addToast: (msg: string, type: ToastType = 'success', opts?: ToastOptions) => {
        showAnimatedToast(msg, type, opts);
        return 'temp-id';
      },
      removeToast: () => {},
      clearAll: () => {},
      toast,
    };
  }
  return { ...ctx, toast };
};

export const useAnimatedToast = useToast;

// =========================================================================
// Single Animated Toast Card Component (JolyUI & Spring Physics)
// =========================================================================
interface SingleToastCardProps {
  item: ToastItem;
  onDismiss: (id: string) => void;
}

const SingleToastCard: React.FC<SingleToastCardProps> = ({ item, onDismiss }) => {
  const duration = item.duration || 3600;
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(100);
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(duration);
  const timerIdRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Xử lý đếm ngược và tạm dừng khi hover chuột (Hover Pause)
  useEffect(() => {
    if (isHovered) {
      if (timerIdRef.current) clearTimeout(timerIdRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    startTimeRef.current = Date.now();

    const updateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const currentRemaining = Math.max(0, remainingTimeRef.current - elapsed);
      const pct = (currentRemaining / duration) * 100;
      setProgress(pct);

      if (currentRemaining > 0) {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateProgress);

    timerIdRef.current = setTimeout(() => {
      onDismiss(item.id);
    }, remainingTimeRef.current);

    return () => {
      if (timerIdRef.current) clearTimeout(timerIdRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      remainingTimeRef.current = Math.max(0, remainingTimeRef.current - (Date.now() - startTimeRef.current));
    };
  }, [isHovered, duration, item.id, onDismiss]);

  // Cấu hình giao diện chuẩn Bản sắc Quân sự & Tactical Command Center
  const getThemeConfig = () => {
    switch (item.type) {
      case 'success':
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />,
          iconBg: 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-300',
          progressBar: 'bg-gradient-to-r from-[#166534] to-[#10b981]',
          badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40',
          borderHighlight: 'border-emerald-500/30 dark:border-emerald-500/40 shadow-emerald-950/10 dark:shadow-emerald-950/40',
          defaultTitle: 'Thao tác thành công',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />,
          iconBg: 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-300',
          progressBar: 'bg-gradient-to-r from-[#d97706] to-[#fbbf24]',
          badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-500/40',
          borderHighlight: 'border-amber-500/30 dark:border-amber-500/40 shadow-amber-950/10 dark:shadow-amber-950/40',
          defaultTitle: 'Lưu ý kiểm duyệt',
        };
      case 'securityAlert':
      case 'error':
      case 'danger':
        return {
          icon: <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 animate-pulse" />,
          iconBg: 'bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-300',
          progressBar: 'bg-gradient-to-r from-[#b91c1c] via-[#dc2626] to-[#f87171]',
          badgeBg: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-500/40',
          borderHighlight: 'border-rose-500/40 dark:border-red-500/50 shadow-rose-950/20 dark:shadow-rose-950/50',
          defaultTitle: item.type === 'securityAlert' ? 'Cảnh báo an ninh' : 'Lỗi xử lý hệ thống',
        };
      case 'info':
      default:
        return {
          icon: <Compass className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />,
          iconBg: 'bg-blue-50 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-300',
          progressBar: 'bg-gradient-to-r from-blue-600 to-sky-400',
          badgeBg: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-500/40',
          borderHighlight: 'border-blue-500/30 dark:border-blue-500/40 shadow-blue-950/10 dark:shadow-blue-950/40',
          defaultTitle: 'Thông tin tác chiến',
        };
    }
  };

  const theme = getThemeConfig();
  const timeFormatted = item.timestamp
    ? new Date(item.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : undefined;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 32, scale: 0.9, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 0.92, y: 16, filter: 'blur(4px)', transition: { duration: 0.2 } }}
      transition={{
        type: 'spring',
        stiffness: 380,
        damping: 26,
        mass: 0.75,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group pointer-events-auto relative w-full overflow-hidden rounded-2xl border bg-white/95 dark:bg-[#0c1420]/95 backdrop-blur-xl shadow-xl transition-all duration-200 select-none ${theme.borderHighlight}`}
      style={{
        boxShadow: isHovered
          ? '0 16px 40px -8px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)'
          : '0 10px 30px -6px rgba(0, 0, 0, 0.35)',
      }}
    >
      <div className="flex items-start gap-3.5 p-3.5 sm:p-4">
        {/* Status Icon with Spring Pop & Glow */}
        <motion.div
          initial={{ scale: 0.6, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${theme.iconBg} shadow-xs`}
        >
          {theme.icon}
        </motion.div>

        {/* Content Body */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                {item.title || theme.defaultTitle}
              </span>
              {item.badge && (
                <span
                  className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold border ${theme.badgeBg}`}
                >
                  {item.badge}
                </span>
              )}
            </div>

            {timeFormatted && (
              <span className="text-[10px] font-mono tabular-nums text-slate-400 dark:text-slate-500 shrink-0">
                {timeFormatted}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed break-words font-medium">
            {item.message}
          </p>
        </div>

        {/* Close Button with Tactile Feedback */}
        <button
          type="button"
          onClick={() => onDismiss(item.id)}
          className="shrink-0 -mr-1 -mt-1 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all active:scale-90 cursor-pointer"
          aria-label="Đóng thông báo"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Auto-dismiss Countdown Progress Bar */}
      <div className="relative h-1 w-full bg-slate-100 dark:bg-slate-800/60 overflow-hidden">
        <motion.div
          className={`h-full ${theme.progressBar}`}
          style={{ width: `${progress}%` }}
          transition={{ ease: 'linear', duration: 0.05 }}
        />
      </div>
    </motion.div>
  );
};

// =========================================================================
// Toast Provider: Quản lý danh sách toast xếp chồng (Stacking Toast Container)
// =========================================================================
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = 'success', options?: ToastOptions) => {
      const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      const newToast: ToastItem = {
        id,
        message,
        type,
        title: options?.title,
        duration: options?.duration || 3600,
        badge: options?.badge,
        timestamp: Date.now(),
      };

      setToasts((prev) => {
        // Giới hạn tối đa 5 toast hiển thị cùng lúc để không chiếm màn hình
        const next = [...prev, newToast];
        return next.slice(-5);
      });

      return id;
    },
    []
  );

  // Lắng nghe sự kiện toàn cục qk7:animated-toast
  useEffect(() => {
    const handleGlobalToast = (event: Event) => {
      const customEvent = event as CustomEvent<ToastItem>;
      if (!customEvent.detail) return;
      const { message, type, title, duration, badge } = customEvent.detail;
      addToast(message, type, { title, duration, badge });
    };

    window.addEventListener('qk7:animated-toast', handleGlobalToast);
    return () => {
      window.removeEventListener('qk7:animated-toast', handleGlobalToast);
    };
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearAll }}>
      {children}
      {/* Container xếp chồng các Animated Toasts tại góc dưới bên phải */}
      <div
        className="fixed bottom-5 right-5 z-[99999] pointer-events-none flex flex-col items-end gap-2.5 max-w-sm sm:max-w-md w-full px-3 sm:px-0"
        aria-live="polite"
        role="region"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((item) => (
            <SingleToastCard key={item.id} item={item} onDismiss={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

// =========================================================================
// Backwards-compatible Standalone Toast Component
// Hỗ trợ nguyên vẹn cú pháp cũ <Toast toast={toast} onClose={...} />
// Giúp nâng cấp ngay toàn bộ các trang đang có mà không làm gãy props cũ
// =========================================================================
export interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface LegacyToastProps {
  toast: ToastState;
  onClose: () => void;
}

export const Toast: React.FC<LegacyToastProps> = ({ toast: state, onClose }) => {
  return (
    <AnimatePresence>
      {state.show && (
        <div className="fixed bottom-5 right-5 z-[99999] pointer-events-none max-w-sm sm:max-w-md w-full px-3 sm:px-0">
          <SingleToastCard
            item={{
              id: 'legacy-single-toast',
              message: state.message,
              type: state.type,
              duration: 3200,
              timestamp: Date.now(),
            }}
            onDismiss={onClose}
          />
        </div>
      )}
    </AnimatePresence>
  );
};

export default Toast;
