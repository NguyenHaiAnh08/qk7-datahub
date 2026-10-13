import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  UserCheck,
  Zap,
  Loader2,
  AlertCircle,
  Shield
} from 'lucide-react';
import { authService } from '../../services/authService';
import { useAuth } from '../../hooks/useAuth';
import { User } from '../../types/user';

export interface LoginFormProps {
  onSuccess?: (user: User) => void;
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onToast }) => {
  const { saveUserSession } = useAuth();
  const [username, setUsername] = useState('USR-004');
  const [password, setPassword] = useState('123456789');
  const [selectedRole, setSelectedRole] = useState<'staff' | 'manager' | 'admin' | null>('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const quickFillRole = (role: 'staff' | 'manager' | 'admin') => {
    setSelectedRole(role);
    setErrorMessage('');
    const map = {
      staff: { id: 'USR-002', label: 'Cán bộ (Cấp 1)' },
      manager: { id: 'USR-001', label: 'Trưởng phòng (Cấp 2)' },
      admin: { id: 'USR-004', label: 'Quản trị viên / Thủ trưởng (Cấp 3 - Tối Mật)' },
    };

    const target = map[role];
    if (target) {
      setUsername(target.id);
      setPassword('123456789');
      if (onToast) onToast(`Đã điền ${target.label}`, 'info');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Vui lòng điền đầy đủ Mã định danh và Mật khẩu!');
      return;
    }

    setErrorMessage('');
    setLoading(true);

    try {
      const res = await authService.login(username, password);
      if (!res.success || !res.user) {
        throw new Error('Đăng nhập không thành công');
      }

      saveUserSession(res.user);
      if (onToast) {
        onToast(`Xin chào ${res.user.full_name} (${res.user.clearance_name || 'Đã xác thực'})`, 'success');
      }
      if (onSuccess) {
        onSuccess(res.user);
      } else {
        setTimeout(() => {
          window.location.href = 'portal.html';
        }, 800);
      }
    } catch (err: any) {
      console.error('[login error]', err);
      setErrorMessage(err.message || 'Mã định danh hoặc mật khẩu không chính xác!');
    } finally {
      setLoading(false);
    }
  };

  const continueAsGuest = () => {
    authService.clearSession();
    if (onToast) onToast('Đang chuyển hướng chế độ Khách tra cứu...', 'info');
    setTimeout(() => {
      window.location.href = 'portal.html';
    }, 600);
  };

  return (
    <form onSubmit={handleLoginSubmit} className="space-y-5">
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center space-x-3 text-rose-400 text-xs font-medium"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
          Mã Số Quân Nhân / Định Danh
        </label>
        <div className="relative rounded-xl shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <UserIcon className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={username}
            onChange={(e) => {
              const val = e.target.value;
              setUsername(val);
              const upper = val.trim().toUpperCase();
              if (upper === 'USR-002') setSelectedRole('staff');
              else if (upper === 'USR-001') setSelectedRole('manager');
              else if (upper === 'USR-004') setSelectedRole('admin');
              else setSelectedRole(null);
            }}
            placeholder="Ví dụ: USR-004, USR-001..."
            required
            className="block w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition-all"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
          Mật Khẩu Xác Thực
        </label>
        <div className="relative rounded-xl shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Lock className="w-5 h-5" />
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nhập mật khẩu..."
            required
            className="block w-full pl-10 pr-10 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Quick Fill Demo Roles */}
      <div className="space-y-2.5 pt-1">
        <p className="text-center text-[12px] text-slate-400 font-medium">
          Dùng thử tài khoản kiểm thử nhanh (Demo):
        </p>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => quickFillRole('staff')}
            className={`px-3.5 py-2.5 rounded-xl border text-xs transition flex items-center justify-between cursor-pointer ${
              selectedRole === 'staff'
                ? 'bg-emerald-950/60 hover:bg-emerald-900/60 border-emerald-500/60 text-emerald-300 ring-1 ring-emerald-500/40 font-semibold shadow-sm shadow-emerald-950/50'
                : 'bg-slate-900/70 hover:bg-slate-800/80 border-slate-700/80 text-slate-300'
            }`}
          >
            <span>Cán bộ (Cấp 1)</span>
            <Zap className="w-3.5 h-3.5 text-blue-400 shrink-0 fill-blue-400/20" />
          </button>

          <button
            type="button"
            onClick={() => quickFillRole('manager')}
            className={`px-3.5 py-2.5 rounded-xl border text-xs transition flex items-center justify-between cursor-pointer ${
              selectedRole === 'manager'
                ? 'bg-emerald-950/60 hover:bg-emerald-900/60 border-emerald-500/60 text-emerald-300 ring-1 ring-emerald-500/40 font-semibold shadow-sm shadow-emerald-950/50'
                : 'bg-slate-900/70 hover:bg-slate-800/80 border-slate-700/80 text-slate-300'
            }`}
          >
            <span>Trưởng phòng (Cấp 2)</span>
            <Zap className="w-3.5 h-3.5 text-purple-400 shrink-0 fill-purple-400/20" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => quickFillRole('admin')}
          className={`w-full px-3.5 py-2.5 rounded-xl border text-xs transition flex items-center justify-between cursor-pointer ${
            selectedRole === 'admin'
              ? 'bg-emerald-950/60 hover:bg-emerald-900/60 border-emerald-500/60 text-emerald-300 ring-1 ring-emerald-500/40 font-semibold shadow-sm shadow-emerald-950/50'
              : 'bg-slate-900/70 hover:bg-slate-800/80 border-slate-700/80 text-slate-300'
          }`}
        >
          <span>Quản trị viên / Thủ trưởng (Cấp 3 - Tối Mật)</span>
          <Shield className="w-3.5 h-3.5 text-rose-400 shrink-0 fill-rose-500/20" />
        </button>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-sm shadow-lg shadow-emerald-900/20 disabled:opacity-50 flex items-center justify-center space-x-2 transition-all duration-200"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Đang xác thực thông tin...</span>
          </>
        ) : (
          <>
            <UserCheck className="w-4 h-4" />
            <span>Đăng Nhập Hệ Thống</span>
          </>
        )}
      </button>

      <div className="relative flex py-1 items-center">
        <div className="flex-grow border-t border-slate-800"></div>
        <span className="flex-shrink mx-4 text-slate-500 text-xs">hoặc</span>
        <div className="flex-grow border-t border-slate-800"></div>
      </div>

      <button
        type="button"
        onClick={continueAsGuest}
        className="w-full py-2 px-4 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white font-medium text-xs border border-slate-700/60 transition-colors"
      >
        Khách Tra Cứu (Tài Liệu Công Khai)
      </button>
    </form>
  );
};
