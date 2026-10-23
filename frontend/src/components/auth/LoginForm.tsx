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
  FileText,
  FileEdit,
  ShieldAlert,
} from 'lucide-react';
import { authService } from '../../services/authService';
import { useAuth } from '../../hooks/useAuth';
import { isUserAdmin, getDestinationByRole } from '../../contexts/AuthContext';
import { User } from '../../types/user';
import { useNavigate } from 'react-router-dom';
import { ROUTE_PATHS } from '../../routes/routePaths';

export interface LoginFormProps {
  onSuccess?: (user: User) => void;
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  isSplitDeck?: boolean;
}

export type DemoRoleKey = 'canbo' | 'thutruong' | 'admin' | 'vanthu' | 'thuky';

export const DEMO_ACCOUNTS: Record<
  DemoRoleKey,
  {
    id: string;
    title: string;
    subtitle: string;
    label: string;
    roleName: string;
  }
> = {
  canbo: {
    id: 'USR-005',
    title: 'Cán bộ',
    subtitle: 'Cấp 3 • Trung tâm thư viện số',
    label: 'Cán bộ tuyên huấn (USR-005 - Cấp 3)',
    roleName: 'Cán bộ',
  },
  thutruong: {
    id: 'USR-003',
    title: 'Thủ trưởng',
    subtitle: 'Cấp 4 • Tối Mật / Duyệt',
    label: 'Thủ trưởng / Chỉ huy (USR-003 - Cấp 4)',
    roleName: 'Thủ trưởng',
  },
  admin: {
    id: 'USR-001',
    title: 'Admin',
    subtitle: 'Toàn quyền • Dashboard',
    label: 'Quản trị viên hệ thống (USR-001)',
    roleName: 'Admin',
  },
  vanthu: {
    id: 'USR-002',
    title: 'Văn thư',
    subtitle: 'Cấp 3 • Bàn làm việc',
    label: 'Cán bộ Văn thư (USR-002 - Bàn làm việc)',
    roleName: 'Văn thư',
  },
  thuky: {
    id: 'USR-004',
    title: 'Thư ký',
    subtitle: 'Cấp 5 • Tổng hợp công văn',
    label: 'Thư ký tổng hợp (USR-004 - Bàn làm việc)',
    roleName: 'Thư ký',
  },
};

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onToast, isSplitDeck = false }) => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const isDev = import.meta.env.DEV;
  const [username, setUsername] = useState(isDev ? 'USR-001' : '');
  const [password, setPassword] = useState(isDev ? '123456789' : '');
  const [selectedRole, setSelectedRole] = useState<DemoRoleKey | null>(isDev ? 'admin' : null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const quickFillRole = (role: DemoRoleKey) => {
    setSelectedRole(role);
    setErrorMessage('');
    const target = DEMO_ACCOUNTS[role];
    if (target) {
      setUsername(target.id);
      setPassword('123456789');
      if (onToast) onToast(`Đã chọn tài khoản: ${target.label}`, 'info');
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
      const loggedInUser = await login(username, password);

      if (onToast) {
        onToast(`Xin chào ${loggedInUser.full_name} (${loggedInUser.clearance_name || 'Đã xác thực'})`, 'success');
      }
      if (onSuccess) {
        onSuccess(loggedInUser);
      } else {
        setTimeout(() => {
          if (isUserAdmin(loggedInUser)) {
            navigate(ROUTE_PATHS.ADMIN, { replace: true });
          } else {
            navigate(getDestinationByRole(loggedInUser), { replace: true });
          }
        }, 500);
      }
    } catch (err: any) {
      console.error('[Đăng nhập thất bại]:', err?.message || err);
      const isLoadFailed =
        err?.name === 'TypeError' ||
        err?.message === 'Load failed' ||
        (err?.message && (err.message.includes('fetch') || err.message.includes('Load failed')));
      const friendlyMsg = isLoadFailed
        ? 'Không thể kết nối đến máy chủ backend (Port 8000). Vui lòng đảm bảo backend đang chạy!'
        : (err.message || 'Mã định danh hoặc mật khẩu không chính xác!');
      setErrorMessage(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  const continueAsGuest = () => {
    authService.clearSession();
    if (onToast) onToast('Đang chuyển hướng chế độ Đại biểu (Dữ liệu công khai)...', 'info');
    setTimeout(() => {
      navigate(ROUTE_PATHS.PORTAL);
    }, 600);
  };

  // ══════════════════════════════════════════════════════════════════════
  // BRANCH A: BỐ CỤC 2 CỘT NGANG CHO IPAD AIR M4 LANDSCAPE (1210 x 802)
  // Vừa vặn 100% trong khung hình 802px, KHÔNG cần cuộn trang!
  // ══════════════════════════════════════════════════════════════════════
  if (isSplitDeck) {
    return (
      <form onSubmit={handleLoginSubmit} className="w-full">
        <div className="grid grid-cols-12 gap-6 items-stretch">
          {/* CỘT TRÁI (col-span-7): Tiêu đề nhỏ + Form nhập + Nút đăng nhập + Khách */}
          <div className="col-span-7 flex flex-col justify-between space-y-3.5">
            {/* Header gọn */}
            <div className="flex items-center gap-3">
              <img
                src="/Logo_QSQK7.png"
                alt="Logo Trường Quân Sự Quân Khu 7"
                style={{ aspectRatio: '1074 / 1465' }}
                className="h-12 w-auto object-contain shrink-0 drop-shadow-md"
              />
              <div>
                <h1 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
                  Đăng nhập
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Hệ Thống Quản Lý Dữ Liệu Tập Trung
                </p>
              </div>
            </div>

            {/* Thông báo lỗi nếu có */}
            <AnimatePresence>
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center space-x-2 text-rose-600 dark:text-rose-400 text-xs font-medium"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input Mã định danh */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Tài khoản quân nhân
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    const val = e.target.value;
                    setUsername(val);
                    const upper = val.trim().toUpperCase();
                    if (upper === 'USR-001') setSelectedRole('admin');
                    else if (upper === 'USR-002') setSelectedRole('vanthu');
                    else if (upper === 'USR-003' || upper === 'USR-006') setSelectedRole('thutruong');
                    else if (upper === 'USR-004') setSelectedRole('thuky');
                    else if (upper === 'USR-005') setSelectedRole('canbo');
                    else setSelectedRole(null);
                  }}
                  placeholder="Nhập tài khoản quân nhân..."
                  required
                  className="block w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs font-sans"
                />
              </div>
            </div>

            {/* Input Mật khẩu */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Mật khẩu
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu..."
                  required
                  className="block w-full pl-9 pr-9 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Nút Đăng nhập */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-purple-900/25 disabled:opacity-50 flex items-center justify-center space-x-2 transition cursor-pointer"
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

            {/* Nút Khách Tra Cứu */}
            <button
              type="button"
              onClick={continueAsGuest}
              className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-300 font-medium text-xs border border-slate-200 dark:border-slate-700/60 transition cursor-pointer"
            >
              Đại biểu (Dữ liệu công khai)
            </button>
          </div>

          {/* CỘT PHẢI (col-span-5): 5 Thẻ Chọn Nhanh Tài Khoản Kiểm Thử */}
          <div className="col-span-5 flex flex-col justify-between border-l border-slate-200 dark:border-slate-800/80 pl-6 space-y-2">
            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-2.5">
                <span className="font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                  Tài khoản kiểm thử nhanh
                </span>
                <span className="text-[10px] font-mono text-slate-400">Pass: 123456789</span>
              </div>

              <div className="space-y-1.5">
                {/* 1. Cán bộ */}
                <button
                  type="button"
                  onClick={() => quickFillRole('canbo')}
                  className={`w-full p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    selectedRole === 'canbo'
                      ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500/60 text-blue-800 dark:text-blue-300 ring-1 ring-blue-500/40 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 dark:border-slate-800 dark:text-slate-300'
                  }`}
                >
                  <div className="min-w-0 pr-1">
                    <div className="font-bold text-xs flex items-center gap-1">
                      <span>Cán bộ</span>
                      <span className="text-[10px] font-mono text-slate-400">005</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Cấp 3 • Trung tâm thư viện số</div>
                  </div>
                  <UserCheck className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0" />
                </button>

                {/* 2. Thủ trưởng */}
                <button
                  type="button"
                  onClick={() => quickFillRole('thutruong')}
                  className={`w-full p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    selectedRole === 'thutruong'
                      ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-500/60 text-purple-800 dark:text-purple-300 ring-1 ring-purple-500/40 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 dark:border-slate-800 dark:text-slate-300'
                  }`}
                >
                  <div className="min-w-0 pr-1">
                    <div className="font-bold text-xs flex items-center gap-1">
                      <span>Thủ trưởng</span>
                      <span className="text-[10px] font-mono text-slate-400">003</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Cấp 4 • Tối Mật</div>
                  </div>
                  <Zap className="w-4 h-4 text-purple-500 dark:text-purple-400 shrink-0 fill-purple-400/20" />
                </button>

                {/* 3. Văn thư */}
                <button
                  type="button"
                  onClick={() => quickFillRole('vanthu')}
                  className={`w-full p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    selectedRole === 'vanthu'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500/60 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/40 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 dark:border-slate-800 dark:text-slate-300'
                  }`}
                >
                  <div className="min-w-0 pr-1">
                    <div className="font-bold text-xs flex items-center gap-1">
                      <span>Văn thư</span>
                      <span className="text-[10px] font-mono text-slate-400">002</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Cấp 3 • Bàn làm việc</div>
                  </div>
                  <FileText className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                </button>

                {/* 4. Thư ký */}
                <button
                  type="button"
                  onClick={() => quickFillRole('thuky')}
                  className={`w-full p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    selectedRole === 'thuky'
                      ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-500/60 text-teal-800 dark:text-teal-300 ring-1 ring-teal-500/40 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 dark:border-slate-800 dark:text-slate-300'
                  }`}
                >
                  <div className="min-w-0 pr-1">
                    <div className="font-bold text-xs flex items-center gap-1">
                      <span>Thư ký</span>
                      <span className="text-[10px] font-mono text-slate-400">004</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Cấp 5 • Tổng hợp</div>
                  </div>
                  <FileEdit className="w-4 h-4 text-teal-500 dark:text-teal-400 shrink-0" />
                </button>

                {/* 5. Quản trị viên (Admin) */}
                <button
                  type="button"
                  onClick={() => quickFillRole('admin')}
                  className={`w-full p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    selectedRole === 'admin'
                      ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500/60 text-amber-800 dark:text-amber-300 ring-1 ring-amber-500/40 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 dark:border-slate-800 dark:text-slate-300'
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <span>Quản trị viên (Admin)</span>
                      <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400 font-semibold bg-amber-500/10 px-1 rounded">USR-001</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Toàn quyền hệ thống • Quản lý</div>
                  </div>
                  <ShieldAlert className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // BRANCH B: BỐ CỤC ĐỨNG TRUYỀN THỐNG (PC HOẶC IPAD PORTRAIT 834 x 1178)
  // ══════════════════════════════════════════════════════════════════════
  return (
    <form onSubmit={handleLoginSubmit} className="space-y-4">
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center space-x-3 text-rose-600 dark:text-rose-400 text-xs font-medium"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
          Tài khoản quân nhân
        </label>
        <div className="relative rounded-xl shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
            <UserIcon className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={username}
            onChange={(e) => {
              const val = e.target.value;
              setUsername(val);
              const upper = val.trim().toUpperCase();
              if (upper === 'USR-001') setSelectedRole('admin');
              else if (upper === 'USR-002') setSelectedRole('vanthu');
              else if (upper === 'USR-003' || upper === 'USR-006') setSelectedRole('thutruong');
              else if (upper === 'USR-004') setSelectedRole('thuky');
              else if (upper === 'USR-005') setSelectedRole('canbo');
              else setSelectedRole(null);
            }}
            placeholder="Nhập tài khoản quân nhân..."
            required
            className="block w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm transition-all font-sans"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
          Mật khẩu
        </label>
        <div className="relative rounded-xl shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
            <Lock className="w-5 h-5" />
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nhập mật khẩu..."
            required
            className="block w-full pl-10 pr-10 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Quick Fill Demo Roles - 5 Roles: Cán bộ, Thủ trưởng, Admin, Văn thư, Thư ký */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-semibold uppercase tracking-wider">Tài khoản kiểm thử nhanh:</span>
          <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono font-medium">Mật khẩu: 123456789</span>
        </div>

        {/* 4 Roles in 2x2 Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* 1. Cán bộ */}
          <button
            type="button"
            onClick={() => quickFillRole('canbo')}
            className={`p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
              selectedRole === 'canbo'
                ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500/60 text-blue-800 dark:text-blue-300 ring-1 ring-blue-500/40 shadow-sm'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 dark:border-slate-800 dark:text-slate-300'
            }`}
          >
            <div className="min-w-0 pr-1">
              <div className="font-bold text-xs flex items-center gap-1">
                <span>Cán bộ</span>
                <span className="text-[10px] font-mono text-slate-400">005</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Cấp 3 • Trung tâm thư viện số</div>
            </div>
            <UserCheck className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0" />
          </button>

          {/* 2. Thủ trưởng */}
          <button
            type="button"
            onClick={() => quickFillRole('thutruong')}
            className={`p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
              selectedRole === 'thutruong'
                ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-500/60 text-purple-800 dark:text-purple-300 ring-1 ring-purple-500/40 shadow-sm'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 dark:border-slate-800 dark:text-slate-300'
            }`}
          >
            <div className="min-w-0 pr-1">
              <div className="font-bold text-xs flex items-center gap-1">
                <span>Thủ trưởng</span>
                <span className="text-[10px] font-mono text-slate-400">003</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Cấp 4 • Tối Mật</div>
            </div>
            <Zap className="w-4 h-4 text-purple-500 dark:text-purple-400 shrink-0 fill-purple-400/20" />
          </button>

          {/* 3. Văn thư */}
          <button
            type="button"
            onClick={() => quickFillRole('vanthu')}
            className={`p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
              selectedRole === 'vanthu'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500/60 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/40 shadow-sm'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 dark:border-slate-800 dark:text-slate-300'
            }`}
          >
            <div className="min-w-0 pr-1">
              <div className="font-bold text-xs flex items-center gap-1">
                <span>Văn thư</span>
                <span className="text-[10px] font-mono text-slate-400">002</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Cấp 3 • Bàn làm việc</div>
            </div>
            <FileText className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
          </button>

          {/* 4. Thư ký */}
          <button
            type="button"
            onClick={() => quickFillRole('thuky')}
            className={`p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
              selectedRole === 'thuky'
                ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-500/60 text-teal-800 dark:text-teal-300 ring-1 ring-teal-500/40 shadow-sm'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 dark:border-slate-800 dark:text-slate-300'
            }`}
          >
            <div className="min-w-0 pr-1">
              <div className="font-bold text-xs flex items-center gap-1">
                <span>Thư ký</span>
                <span className="text-[10px] font-mono text-slate-400">004</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Cấp 5 • Tổng hợp</div>
            </div>
            <FileEdit className="w-4 h-4 text-teal-500 dark:text-teal-400 shrink-0" />
          </button>
        </div>

        {/* 5. Admin (Full width) */}
        <button
          type="button"
          onClick={() => quickFillRole('admin')}
          className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
            selectedRole === 'admin'
              ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500/60 text-amber-800 dark:text-amber-300 ring-1 ring-amber-500/40 shadow-sm'
              : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 dark:border-slate-800 dark:text-slate-300'
          }`}
        >
          <div>
            <div className="font-bold text-xs flex items-center gap-1.5">
              <span>Quản trị viên (Admin)</span>
              <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400 font-semibold bg-amber-500/10 px-1 rounded">USR-001</span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">Toàn quyền hệ thống • Admin Dashboard & Quản lý User</div>
          </div>
          <ShieldAlert className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
        </button>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-sm shadow-lg shadow-purple-900/25 disabled:opacity-50 flex items-center justify-center space-x-2 transition-all duration-200 cursor-pointer"
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
        <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
        <span className="flex-shrink mx-4 text-slate-400 text-xs">hoặc</span>
        <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
      </div>

      <button
        type="button"
        onClick={continueAsGuest}
        className="w-full py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-300 dark:hover:text-white font-medium text-xs border border-slate-200 dark:border-slate-700/60 transition-colors cursor-pointer"
      >
        Đại biểu (Dữ liệu công khai)
      </button>
    </form>
  );
};
