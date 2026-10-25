import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, AlertTriangle } from 'lucide-react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  confirmVariant?: 'danger' | 'warning' | 'primary' | string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  message,
  confirmText = 'Xác nhận xóa',
  cancelText = 'Hủy',
  isDestructive = true,
  confirmVariant,
  onConfirm,
  onCancel
}) => {
  const isDanger = confirmVariant ? confirmVariant === 'danger' : isDestructive;
  const displayText = message || description || '';

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 26, mass: 0.75 }}
            className="w-full max-w-sm bg-white/95 dark:bg-[#0c1420]/95 backdrop-blur-xl rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-2xl relative text-left"
          >
            <div className="flex items-center space-x-3 mb-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                  isDanger
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400'
                    : 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
                }`}
              >
                {isDanger ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">{title}</h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-5 leading-relaxed font-medium">
              {displayText}
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer btn-tactile active:scale-95"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`px-4 py-2 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-md btn-tactile active:scale-95 ${
                  isDanger
                    ? 'bg-gradient-to-r from-[#b91c1c] to-[#dc2626] hover:from-[#dc2626] hover:to-[#ef4444] shadow-rose-950/30'
                    : 'bg-gradient-to-r from-[#d97706] to-[#f59e0b] hover:from-[#f59e0b] hover:to-[#fbbf24] shadow-amber-950/30'
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
