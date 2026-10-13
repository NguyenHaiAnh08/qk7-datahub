import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, KeyRound, Copy, Check, Dices } from 'lucide-react';
import { usersApi } from '../../services/usersApi';

export interface UserCredentialsModalProps {
  open: boolean;
  userId: string;
  defaultUsername?: string;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const UserCredentialsModal: React.FC<UserCredentialsModalProps> = ({
  open,
  userId,
  defaultUsername,
  onClose,
  onSuccess,
  onToast,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setUsername(defaultUsername || (userId ? userId.toLowerCase() : ''));
      setPassword('');
      setCopied(false);
    }
  }, [open, userId, defaultUsername]);

  if (!open) return null;

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let res = '';
    for (let i = 0; i < 12; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(res);
  };

  const copyPassword = () => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      onToast('Tên đăng nhập không được để trống!', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await usersApi.updateCredentials(userId, {
        username: username.trim(),
        password: password ? password : null,
      });
      onToast(`Cập nhật thông tin đăng nhập cho ${userId} thành công!`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      onToast(err.message || 'Lỗi cập nhật tài khoản!', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col transition-colors duration-200"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Cập Nhật Tài Khoản Đăng Nhập
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Quân nhân: {userId}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Tên đăng nhập (Username) *
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập username..."
                required
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 dark:text-slate-300 font-semibold">
                  Mật khẩu mới (Để trống nếu giữ nguyên)
                </label>
                <button
                  type="button"
                  onClick={generateRandomPassword}
                  className="text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 flex items-center gap-1 font-medium transition cursor-pointer"
                >
                  <Dices className="w-3.5 h-3.5" />
                  <span>Sinh ngẫu nhiên</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 8 ký tự..."
                  className="w-full pl-3 pr-10 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                />
                {password && (
                  <button
                    type="button"
                    onClick={copyPassword}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-500 transition"
                    title="Sao chép mật khẩu"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                Gợi ý: Mật khẩu nên gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition disabled:opacity-50 cursor-pointer shadow-md shadow-amber-600/30"
              >
                {submitting ? 'Đang lưu...' : 'Cập nhật tài khoản'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
