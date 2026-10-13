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
  const isDanger = isDestructive || confirmVariant === 'danger';
  const displayText = message || description || '';

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-sm bg-slate-900 rounded-2xl p-6 border border-slate-700 shadow-2xl relative text-left"
          >
            <div className="flex items-center space-x-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isDanger ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {isDanger ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>
              <h3 className="font-bold text-sm text-white">{title}</h3>
            </div>

            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              {displayText}
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-3.5 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs hover:bg-slate-700 transition cursor-pointer"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`px-3.5 py-2 text-white font-bold rounded-xl text-xs transition cursor-pointer ${
                  isDanger
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-amber-600 hover:bg-amber-500'
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
