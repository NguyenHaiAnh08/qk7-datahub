import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastProps {
  toast: ToastState;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  return (
    <AnimatePresence>
      {toast.show && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed bottom-6 right-6 z-[9999] max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-900 dark:text-white px-4 py-3 rounded-2xl shadow-xl shadow-slate-300/40 dark:shadow-2xl dark:shadow-slate-950/80 border border-slate-200 dark:border-slate-700/80 flex items-center space-x-3 transition-colors duration-200"
        >
          <div className="shrink-0">
            {toast.type === 'success' && (
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
              </div>
            )}
            {toast.type === 'error' && (
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center">
                <AlertCircle className="w-4.5 h-4.5 text-rose-600 dark:text-rose-400" />
              </div>
            )}
            {toast.type === 'info' && (
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center">
                <Info className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
              </div>
            )}
          </div>

          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex-1 leading-snug">
            {toast.message}
          </span>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Đóng thông báo"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
