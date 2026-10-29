/* <!-- Lucian UX/UI Prompt #025 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#025 --> */
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
  KeyRound,
  Monitor,
} from 'lucide-react';
import { authService } from '../../services/authService';
import { useAuth } from '../../hooks/useAuth';
import { isUserAdmin, getDestinationByRole } from '../../contexts/AuthContext';
import { User } from '../../types/user';
import { useNavigate } from 'react-router-dom';
import { ROUTE_PATHS } from '../../routes/routePaths';
import { NotchedInput } from './NotchedInput';

export interface LoginFormProps {
  onSuccess?: (user: User) => void;
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  isSplitDeck?: boolean;
}

export type DemoRoleKey = 'chihuy' | 'coyeu' | 'troly' | 'vanthu' | 'it' | 'admin';

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
  chihuy: {
    id: 'USR-002',
    title: 'Chỉ huy',
    subtitle: 'Cấp 5 • Tuyệt Mật',
    label: 'Chỉ huy - Lương Nhật Thăng (USR-002 - Cấp 5)',
    roleName: 'Chỉ huy',
  },
  coyeu: {
    id: 'USR-003',
    title: 'Cơ yếu',
    subtitle: 'Cấp 5 • Tuyệt Mật',
    label: 'Cơ yếu - Phạm Trường Sơn (USR-003 - Cấp 5)',
    roleName: 'Cơ yếu',
  },
  troly: {
    id: 'USR-004',
    title: 'Trợ lý',
    subtitle: 'Cấp 2 • Nội bộ',
    label: 'Trợ lý - Nguyễn Xuân Thanh (USR-004 - Cấp 2)',
    roleName: 'Trợ lý',
  },
  vanthu: {
    id: 'USR-005',
    title: 'Văn thư',
    subtitle: 'Cấp 3 • Mật',
    label: 'Cán bộ Văn thư - Trần Thị Ánh Tuyết (USR-005 - Cấp 3)',
    roleName: 'Văn thư',
  },
  it: {
    id: 'USR-006',
    title: 'Nhân viên IT',
    subtitle: 'Cấp 1 • Công khai • Kỹ thuật hệ thống',
    label: 'Nhân viên IT - Nguyễn Hải Anh (USR-006 - Cấp 1)',
    roleName: 'Nhân viên IT',
  },
  admin: {
    id: 'USR-001',
    title: 'Admin',
    subtitle: 'Toàn quyền • Dashboard',
    label: 'Quản trị viên (Admin - USR-001)',
    roleName: 'Admin',
  },
};

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onToast, isSplitDeck = false }) => {
  const navigate = useNavigate();
  const { login, continueAsGuest: authContinueAsGuest } = useAuth();
  const isDev = import.meta.env.DEV;
  const [username, setUsername] = useState(isDev ? 'USR-001' : '');
  const [password, setPassword] = useState(isDev ? '123456789' : '');
  const [selectedRole, setSelectedRole] = useState<DemoRoleKey | null>(isDev ? 'admin' : null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // States quản lý lỗi và rung lắc (Shake UX #025) cho từng ô
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [usernameShake, setUsernameShake] = useState(0);
  const [passwordShake, setPasswordShake] = useState(0);

  const handleUsernameChange = (val: string) => {
    setUsername(val);
    if (usernameError) setUsernameError('');
    if (passwordError) setPasswordError('');
    const upper = val.trim().toUpperCase();
    if (upper === 'USR-001') setSelectedRole('admin');
    else if (upper === 'USR-002') setSelectedRole('chihuy');
    else if (upper === 'USR-003') setSelectedRole('coyeu');
    else if (upper === 'USR-004') setSelectedRole('troly');
    else if (upper === 'USR-005') setSelectedRole('vanthu');
    else if (upper === 'USR-006') setSelectedRole('it');
    else setSelectedRole(null);
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (passwordError) setPasswordError('');
    if (usernameError) setUsernameError('');
  };

  const quickFillRole = (role: DemoRoleKey) => {
    setSelectedRole(role);
    setUsernameError('');
    setPasswordError('');
    const target = DEMO_ACCOUNTS[role];
    if (target) {
      setUsername(target.id);
      setPassword('123456789');
      if (onToast) onToast(`Đã chọn tài khoản: ${target.label}`, 'info');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let hasError = false;

    // Kích hoạt rung lắc ngang nếu để trống tài khoản hoặc mật khẩu
    if (!username.trim()) {
      setUsernameError('Vui lòng nhập tài khoản quân nhân!');
      setUsernameShake((prev) => prev + 1);
      hasError = true;
    }

    if (!password.trim()) {
      setPasswordError('Mật khẩu không được để trống!');
      setPasswordShake((prev) => prev + 1);
      hasError = true;
    }

    if (hasError) {
      return;
    }

    setUsernameError('');
    setPasswordError('');
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
      // Kích hoạt rung lắc và hiển thị dòng lỗi trượt mượt (.u025-help) trực tiếp dưới ô bị lỗi
      const rawMsg = err?.message || '';
      const lower = rawMsg.toLowerCase();

      // 1. Lỗi xác thực tài khoản/mật khẩu chung (chống user enumeration hoặc sai cặp thông tin)
      const isGeneralAuthFail =
        lower.includes('tên đăng nhập hoặc mật khẩu') ||
        lower.includes('tài khoản hoặc mật khẩu') ||
        lower.includes('sai tài khoản') ||
        lower.includes('không chính xác') ||
        lower.includes('invalid credential') ||
        (lower.includes('đăng nhập') && lower.includes('mật khẩu'));

      // 2. Lỗi riêng mật khẩu (chỉ khi tài khoản đúng nhưng mật khẩu sai)
      const isPasswordSpecific =
        !isGeneralAuthFail &&
        (lower.includes('mật khẩu không đúng') ||
          lower.includes('sai mật khẩu') ||
          (lower.includes('mật khẩu') && !lower.includes('tài khoản') && !lower.includes('đăng nhập')));

      // 3. Lỗi riêng tài khoản (tài khoản bị khóa, vô hiệu hóa...)
      const isUsernameSpecific =
        !isGeneralAuthFail &&
        (lower.includes('bị khóa') ||
          lower.includes('vô hiệu hóa') ||
          lower.includes('không tìm thấy') ||
          ((lower.includes('tài khoản') || lower.includes('tên đăng nhập') || lower.includes('username')) &&
            !lower.includes('mật khẩu')));

      if (isGeneralAuthFail) {
        // Cả 2 ô đều chuyển sang trạng thái lỗi và rung lắc đồng bộ
        setUsernameError('Tên đăng nhập hoặc mật khẩu không chính xác');
        setPasswordError('Vui lòng kiểm tra lại tài khoản và mật khẩu');
        setUsernameShake((prev) => prev + 1);
        setPasswordShake((prev) => prev + 1);
      } else if (isPasswordSpecific && !isUsernameSpecific) {
        setPasswordError(rawMsg || 'Mật khẩu không đúng. Vui lòng kiểm tra lại!');
        setPasswordShake((prev) => prev + 1);
      } else if (isUsernameSpecific && !isPasswordSpecific) {
        setUsernameError(rawMsg || 'Tài khoản quân nhân không chính xác!');
        setUsernameShake((prev) => prev + 1);
      } else {
        setUsernameError('Sai tài khoản hoặc mật khẩu quân nhân');
        setPasswordError('Vui lòng kiểm tra lại thông tin mật khẩu');
        setUsernameShake((prev) => prev + 1);
        setPasswordShake((prev) => prev + 1);
      }

      if (isLoadFailed && onToast) {
        onToast('Không thể kết nối đến máy chủ backend (Port 8000). Vui lòng đảm bảo backend đang chạy!', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

    const handleContinueAsGuest = () => {
    if (onToast) onToast('Đang chuyển hướng chế độ Đại biểu (Dữ liệu công khai)...', 'info');
    authContinueAsGuest();
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

            {/* Input Tài khoản quân nhân */}
            <NotchedInput
              id="username-split"
              name="username"
              autoComplete="username"
              label="Tài khoản quân nhân"
              value={username}
              onChange={handleUsernameChange}
              icon={<UserIcon className="w-4 h-4" />}
              errorMessage={usernameError}
              shakeKey={usernameShake}
              compact={true}
              required
            />

            {/* Input Mật khẩu */}
            <NotchedInput
              id="password-split"
              name="password"
              autoComplete="current-password"
              label="Mật khẩu"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={handlePasswordChange}
              icon={<Lock className="w-4 h-4" />}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              }
              errorMessage={passwordError}
              shakeKey={passwordShake}
              compact={true}
              required
            />

            {/* Nút Đăng nhập */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#14532d] via-[#166534] to-[#15803d] hover:from-[#166534] hover:to-[#15803d] text-white font-semibold text-xs shadow-md shadow-emerald-950/20 border border-amber-500/25 disabled:opacity-50 flex items-center justify-center space-x-2 transition cursor-pointer"
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
              onClick={handleContinueAsGuest}
              className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-300 font-medium text-xs border border-slate-200 dark:border-slate-700/60 transition cursor-pointer"
            >
              Đại biểu (Dữ liệu công khai)
            </button>
          </div>

          {/* CỘT PHẢI (col-span-5): 6 Thẻ Chọn Nhanh Tài Khoản Kiểm Thử */}
          <div className="col-span-5 flex flex-col justify-between border-l border-slate-200 dark:border-slate-800/80 pl-6 space-y-2">
            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-2.5">
                <span className="font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                  Tài khoản kiểm thử nhanh
                </span>
                <span className="text-[10px] font-mono text-slate-400">Pass: 123456789</span>
              </div>

              <div className="space-y-1.5">
                {/* 1. Chỉ huy (002) */}
                <button
                  type="button"
                  onClick={() => quickFillRole('chihuy')}
                  title="Lương Nhật Thăng - Trưởng phòng Tham mưu - Hành chính (Cấp 5 - Tuyệt Mật)"
                  className={`w-full p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    selectedRole === 'chihuy'
                      ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500/60 text-blue-800 dark:text-blue-300 ring-1 ring-blue-500/40 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 dark:border-slate-800 dark:text-slate-300'
                  }`}
                >
                  <div className="min-w-0 pr-1">
                    <div className="font-bold text-xs flex items-center gap-1">
                      <span>Chỉ huy</span>
                      <span className="text-[10px] font-mono text-slate-400">002</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Cấp 5 • Tuyệt Mật</div>
                  </div>
                  <UserCheck className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0" />
                </button>

                {/* 2. Cơ yếu (003) */}
                <button
                  type="button"
                  onClick={() => quickFillRole('coyeu')}
                  title="Phạm Trường Sơn - Cơ yếu (Cấp 5 - Tuyệt Mật)"
                  className={`w-full p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    selectedRole === 'coyeu'
                      ? 'bg-red-50 dark:bg-red-950/60 border-red-500/60 text-red-800 dark:text-red-300 ring-1 ring-red-500/40 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 dark:border-slate-800 dark:text-slate-300'
                  }`}
                >
                  <div className="min-w-0 pr-1">
                    <div className="font-bold text-xs flex items-center gap-1">
                      <span>Cơ yếu</span>
                      <span className="text-[10px] font-mono text-slate-400">003</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Cấp 5 • Tuyệt Mật</div>
                  </div>
                  <KeyRound className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0" />
                </button>

                {/* 3. Trợ lý (004) */}
                <button
                  type="button"
                  onClick={() => quickFillRole('troly')}
                  title="Nguyễn Xuân Thanh - Trợ lý tác chiến (Cấp 2 - Nội bộ)"
                  className={`w-full p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    selectedRole === 'troly'
                      ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-500/60 text-teal-800 dark:text-teal-300 ring-1 ring-teal-500/40 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 dark:border-slate-800 dark:text-slate-300'
                  }`}
                >
                  <div className="min-w-0 pr-1">
                    <div className="font-bold text-xs flex items-center gap-1">
                      <span>Trợ lý</span>
                      <span className="text-[10px] font-mono text-slate-400">004</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Cấp 2 • Nội bộ</div>
                  </div>
                  <FileEdit className="w-4 h-4 text-teal-500 dark:text-teal-400 shrink-0" />
                </button>

                {/* 4. Văn thư (005) */}
                <button
                  type="button"
                  onClick={() => quickFillRole('vanthu')}
                  title="Trần Thị Ánh Tuyết - Cán bộ Văn thư (Cấp 3 - Mật)"
                  className={`w-full p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    selectedRole === 'vanthu'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500/60 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/40 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 dark:border-slate-800 dark:text-slate-300'
                  }`}
                >
                  <div className="min-w-0 pr-1">
                    <div className="font-bold text-xs flex items-center gap-1">
                      <span>Văn thư</span>
                      <span className="text-[10px] font-mono text-slate-400">005</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Cấp 3 • Mật</div>
                  </div>
                  <FileText className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                </button>

                {/* 5. Nhân viên IT (006) */}
                <button
                  type="button"
                  onClick={() => quickFillRole('it')}
                  title="Nguyễn Hải Anh - Nhân viên IT (Cấp 1 - Công khai)"
                  className={`w-full p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    selectedRole === 'it'
                      ? 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-500/60 text-cyan-800 dark:text-cyan-300 ring-1 ring-cyan-500/40 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 dark:border-slate-800 dark:text-slate-300'
                  }`}
                >
                  <div className="min-w-0 pr-1">
                    <div className="font-bold text-xs flex items-center gap-1">
                      <span>Nhân viên IT</span>
                      <span className="text-[10px] font-mono text-slate-400">006</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Cấp 1 • Công khai</div>
                  </div>
                  <Monitor className="w-4 h-4 text-cyan-500 dark:text-cyan-400 shrink-0" />
                </button>

                {/* 6. Quản trị viên (Admin) */}
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
      {/* Input Tài khoản quân nhân */}
      <NotchedInput
        id="username-vertical"
        name="username"
        autoComplete="username"
        label="Tài khoản quân nhân"
        value={username}
        onChange={handleUsernameChange}
        icon={<UserIcon className="w-4.5 h-4.5" />}
        errorMessage={usernameError}
        shakeKey={usernameShake}
        required
      />

      {/* Input Mật khẩu */}
      <NotchedInput
        id="password-vertical"
        name="password"
        autoComplete="current-password"
        label="Mật khẩu"
        type={showPassword ? 'text' : 'password'}
        value={password}
        onChange={handlePasswordChange}
        icon={<Lock className="w-4.5 h-4.5" />}
        rightElement={
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        }
        errorMessage={passwordError}
        shakeKey={passwordShake}
        required
      />

      {/* Quick Fill Demo Roles - 6 Roles: Cán bộ, Thư ký, Văn thư, Cơ yếu, Nhân viên IT, Admin */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-semibold uppercase tracking-wider">Tài khoản kiểm thử nhanh:</span>
          <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono font-medium">Mật khẩu: 123456789</span>
        </div>

        {/* 4 Roles in 2x2 Grid + Nhân viên IT */}
        <div className="grid grid-cols-2 gap-2">
          {/* 1. Chỉ huy (002) */}
          <button
            type="button"
            onClick={() => quickFillRole('chihuy')}
            title="Lương Nhật Thăng - Trưởng phòng Tham mưu - Hành chính (Cấp 5 - Tuyệt Mật)"
            className={`p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
              selectedRole === 'chihuy'
                ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500/60 text-blue-800 dark:text-blue-300 ring-1 ring-blue-500/40 shadow-sm'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 dark:border-slate-800 dark:text-slate-300'
            }`}
          >
            <div className="min-w-0 pr-1">
              <div className="font-bold text-xs flex items-center gap-1">
                <span>Chỉ huy</span>
                <span className="text-[10px] font-mono text-slate-400">002</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Cấp 5 • Tuyệt Mật</div>
            </div>
            <UserCheck className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0" />
          </button>

          {/* 2. Cơ yếu (003) */}
          <button
            type="button"
            onClick={() => quickFillRole('coyeu')}
            title="Phạm Trường Sơn - Cơ yếu (Cấp 5 - Tuyệt Mật)"
            className={`p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
              selectedRole === 'coyeu'
                ? 'bg-red-50 dark:bg-red-950/60 border-red-500/60 text-red-800 dark:text-red-300 ring-1 ring-red-500/40 shadow-sm'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 dark:border-slate-800 dark:text-slate-300'
            }`}
          >
            <div className="min-w-0 pr-1">
              <div className="font-bold text-xs flex items-center gap-1">
                <span>Cơ yếu</span>
                <span className="text-[10px] font-mono text-slate-400">003</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Cấp 5 • Tuyệt Mật</div>
            </div>
            <KeyRound className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0" />
          </button>

          {/* 3. Trợ lý (004) */}
          <button
            type="button"
            onClick={() => quickFillRole('troly')}
            title="Nguyễn Xuân Thanh - Trợ lý tác chiến (Cấp 2 - Nội bộ)"
            className={`p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
              selectedRole === 'troly'
                ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-500/60 text-teal-800 dark:text-teal-300 ring-1 ring-teal-500/40 shadow-sm'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 dark:border-slate-800 dark:text-slate-300'
            }`}
          >
            <div className="min-w-0 pr-1">
              <div className="font-bold text-xs flex items-center gap-1">
                <span>Trợ lý</span>
                <span className="text-[10px] font-mono text-slate-400">004</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Cấp 2 • Nội bộ</div>
            </div>
            <FileEdit className="w-4 h-4 text-teal-500 dark:text-teal-400 shrink-0" />
          </button>

          {/* 4. Văn thư (005) */}
          <button
            type="button"
            onClick={() => quickFillRole('vanthu')}
            title="Trần Thị Ánh Tuyết - Cán bộ Văn thư (Cấp 3 - Mật)"
            className={`p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
              selectedRole === 'vanthu'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500/60 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/40 shadow-sm'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 dark:border-slate-800 dark:text-slate-300'
            }`}
          >
            <div className="min-w-0 pr-1">
              <div className="font-bold text-xs flex items-center gap-1">
                <span>Văn thư</span>
                <span className="text-[10px] font-mono text-slate-400">005</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Cấp 3 • Mật</div>
            </div>
            <FileText className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
          </button>

          {/* 5. Nhân viên IT (006) - Col-span-2 */}
          <button
            type="button"
            onClick={() => quickFillRole('it')}
            title="Nguyễn Hải Anh - Nhân viên IT (Cấp 1 - Công khai)"
            className={`col-span-2 p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
              selectedRole === 'it'
                ? 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-500/60 text-cyan-800 dark:text-cyan-300 ring-1 ring-cyan-500/40 shadow-sm'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 dark:border-slate-800 dark:text-slate-300'
            }`}
          >
            <div className="min-w-0 pr-1">
              <div className="font-bold text-xs flex items-center gap-1.5">
                <span>Nhân viên IT</span>
                <span className="text-[10px] font-mono text-cyan-700 dark:text-cyan-400 font-semibold bg-cyan-500/10 px-1 rounded">006</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Cấp 1 • Công khai • Kỹ thuật hệ thống</div>
            </div>
            <Monitor className="w-4 h-4 text-cyan-500 dark:text-cyan-400 shrink-0" />
          </button>
        </div>

        {/* 6. Admin (Full width) - Giữ nguyên không đổi */}
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
        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#14532d] via-[#166534] to-[#15803d] hover:from-[#166534] hover:to-[#15803d] text-white font-medium text-sm shadow-md shadow-emerald-950/20 border border-amber-500/25 disabled:opacity-50 flex items-center justify-center space-x-2 transition-all duration-200 cursor-pointer"
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
        onClick={handleContinueAsGuest}
        className="w-full py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-300 dark:hover:text-white font-medium text-xs border border-slate-200 dark:border-slate-700/60 transition-colors cursor-pointer"
      >
        Đại biểu (Dữ liệu công khai)
      </button>
    </form>
  );
};
