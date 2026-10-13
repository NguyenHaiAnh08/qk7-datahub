import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, KeyRound, Dices, Copy, Check, Save } from 'lucide-react';
import { usersApi } from '../../services/usersApi';

export interface UserCredentialsModalProps {
  open: boolean;
  userId: string;
  defaultUsername?: string;
  onClose: () => void;
  onSuccess: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const UserCredentialsModal: React.FC<UserCredentialsModalProps> = ({
  open,
  userId,
  defaultUsername = '',
  onClose,
  onSuccess,
  onToast,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setUsername(defaultUsername || userId.toLowerCase());
      setPassword('');
      setCopied(false);
    }
  }, [open, userId, defaultUsername]);

  if (!open) return null;

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    setPassword(pwd);
    navigator.clipboard.writeText(pwd).then(
      () => onToast('Đã sinh và sao chép mật khẩu vào clipboard!', 'success'),
      () => onToast(`Đã sinh mật khẩu: ${pwd}`, 'info')
    );
  };

  const copyPassword = () => {
    if (!password) return;
    navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onToast('Đã sao chép mật khẩu', 'success');
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      onToast('Vui lòng nhập tên đăng nhập', 'error');
      return;
    }
    if (password && password.length < 8) {
      onToast('Mật khẩu cần tối thiểu 8 ký tự', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await usersApi.updateCredentials(userId, {
        username: username.trim().toLowerCase(),
        password: password || undefined,
      });
      onToast('Đã cập nhật thông tin xác thực thành công!', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      onToast('Lỗi cập nhật: ' + err.message, 'error');
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
          className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Cập Nhật Tài Khoản Đăng Nhập</h3>
                <p className="text-[11px] text-slate-400">Quân nhân: {userId}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Tên đăng nhập (Username) *
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập username..."
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-300 font-semibold">
                  Mật khẩu mới (Để trống nếu giữ nguyên)
                </label>
                <button
                  type="button"
                  onClick={generateRandomPassword}
                  className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium transition"
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
                  className="w-full pl-3 pr-10 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                />
                {password && (
                  <button
                    type="button"
                    onClick={copyPassword}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-400 transition"
                    title="Sao chép mật khẩu"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Gợi ý: Mật khẩu nên gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {submitting ? 'Đang lưu...' : 'Lưu tài khoản'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
