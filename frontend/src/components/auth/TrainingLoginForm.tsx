/* <!-- Tactical Training Gateway Login Form · Trường Quân Sự Quân Khu 7 --> */
import React, { useState } from 'react';
import {
  Lock,
  GraduationCap,
  Eye,
  EyeOff,
  UserCheck,
  Loader2,
  BookOpen,
  Calendar,
  Award,
  Sparkles,
} from 'lucide-react';
import { authService } from '../../services/authService';
import { useAuth } from '../../hooks/useAuth';
import { isUserAdmin, getDestinationByRole } from '../../contexts/AuthContext';
import { User } from '../../types/user';
import { useNavigate } from 'react-router-dom';
import { ROUTE_PATHS } from '../../routes/routePaths';
import { NotchedInput } from './NotchedInput';

export interface TrainingLoginFormProps {
  onSuccess?: (user: User) => void;
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  onForgotPassword?: () => void;
}

export type TrainingDemoKey = 'giangvien' | 'quanly' | 'khoa';

export const TRAINING_DEMO_ACCOUNTS: Record<
  TrainingDemoKey,
  {
    id: string;
    title: string;
    subtitle: string;
    roleName: string;
    icon: any;
  }
> = {
  giangvien: {
    id: 'USR-004',
    title: 'Giảng viên',
    subtitle: 'Hạ sĩ Mạc Lương Thanh Tỉnh',
    roleName: 'Giảng viên / Trợ lý',
    icon: BookOpen,
  },
  quanly: {
    id: 'USR-001',
    title: 'Quản lý Đào tạo',
    subtitle: 'Toàn quyền cơ sở & lịch học',
    roleName: 'Ban Quản trị Đào tạo',
    icon: Award,
  },
  khoa: {
    id: 'USR-002',
    title: 'Chỉ huy / Khoa',
    subtitle: 'Trưởng phòng Tham mưu - HC',
    roleName: 'Chỉ huy Huấn luyện',
    icon: Calendar,
  },
};

export const TrainingLoginForm: React.FC<TrainingLoginFormProps> = ({
  onSuccess,
  onToast,
}) => {
  const navigate = useNavigate();
  const { saveUserSession } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedDemo, setSelectedDemo] = useState<TrainingDemoKey | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // States quản lý lỗi và rung lắc (Shake UX #025)
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [usernameShake, setUsernameShake] = useState(0);
  const [passwordShake, setPasswordShake] = useState(0);

  const handleUsernameChange = (val: string) => {
    setUsername(val);
    if (usernameError) setUsernameError('');
    if (passwordError) setPasswordError('');
    const upper = val.trim().toUpperCase();
    if (upper === 'USR-004') setSelectedDemo('giangvien');
    else if (upper === 'USR-001') setSelectedDemo('quanly');
    else if (upper === 'USR-002') setSelectedDemo('khoa');
    else setSelectedDemo(null);
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (passwordError) setPasswordError('');
    if (usernameError) setUsernameError('');
  };

  const quickFillDemo = (key: TrainingDemoKey) => {
    setSelectedDemo(key);
    setUsernameError('');
    setPasswordError('');
    const acc = TRAINING_DEMO_ACCOUNTS[key];
    if (acc) {
      setUsername(acc.id);
      setPassword('123456789');
      if (onToast) onToast(`Đã chọn tài khoản đào tạo: ${acc.title} (${acc.id})`, 'info');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let hasError = false;

    if (!username.trim()) {
      setUsernameError('Vui lòng nhập tài khoản cán bộ / giảng viên!');
      setUsernameShake((prev) => prev + 1);
      hasError = true;
    }

    if (!password.trim()) {
      setPasswordError('Mật khẩu đào tạo không được để trống!');
      setPasswordShake((prev) => prev + 1);
      hasError = true;
    }

    if (hasError) return;

    setUsernameError('');
    setPasswordError('');
    setLoading(true);

    try {
      const res: any = await authService.login(username, password);

      const loggedInUser = res?.user || (await authService.getMe());
      saveUserSession(loggedInUser);

      if (onToast) {
        onToast(
          `Chào mừng đồng chí ${loggedInUser.full_name || username} đã truy cập Hệ Thống Quản Lý Đào Tạo!`,
          'success'
        );
      }

      if (onSuccess) {
        onSuccess(loggedInUser);
      } else {
        if (isUserAdmin(loggedInUser)) {
          navigate(ROUTE_PATHS.ADMIN, { replace: true });
        } else {
          // Chuyển hướng tới phân hệ bài giảng số của portal
          navigate('/portal', { replace: true, state: { defaultTab: 'lectures' } });
        }
      }
    } catch (err: any) {
      console.error('[Đăng nhập Đào tạo thất bại]:', err?.message || err);
      const rawMsg = err?.message || '';
      setUsernameError('Tài khoản hoặc mật khẩu không chính xác');
      setPasswordError(rawMsg || 'Vui lòng kiểm tra lại thông tin xác thực');
      setUsernameShake((prev) => prev + 1);
      setPasswordShake((prev) => prev + 1);

      if (onToast) {
        onToast(err?.message || 'Đăng nhập phân hệ Đào tạo thất bại!', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3.5">
      <input type="hidden" name="_csrf" value="qk7_training_auth" />

      {/* Header Phân Hệ Đào Tạo: Logo Trường Quân Sự QK7 + Tên Hệ Thống (Đồng bộ với Trung Tâm Dữ Liệu Số) */}
      <div className="text-center mb-3.5">
        <div className="inline-flex items-center justify-center mb-1.5">
          <img
            src="/Logo_QSQK7.png"
            alt="Logo Trường Quân Sự Quân Khu 7"
            style={{ aspectRatio: '1074 / 1465' }}
            className="h-12 sm:h-14 w-auto object-contain drop-shadow-md"
          />
        </div>
        <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          Hệ Thống Quản Lý Đào Tạo
        </h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
          Cổng Điều Hành Giám Sát Huấn Luyện, Giảng Dạy
        </p>
      </div>

      {/* Input Fields có lớp bọc .u025-training kích hoạt sắc Xanh Cobalt trong NotchedInput */}
      <div className="u025-training space-y-3.5">
        {/* Input Tài khoản cán bộ / giảng viên */}
        <NotchedInput
          id="training-username"
          name="training_username"
          autoComplete="username"
          label="Tài khoản cán bộ / Giảng viên / Học viên"
          value={username}
          onChange={handleUsernameChange}
          icon={<GraduationCap className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />}
          errorMessage={usernameError}
          shakeKey={usernameShake}
          compact={true}
          required
        />

        {/* Input Mật khẩu */}
        <NotchedInput
          id="training-password"
          name="training_password"
          autoComplete="current-password"
          label="Mật khẩu"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={handlePasswordChange}
          icon={<Lock className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />}
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
      </div>

      {/* Tài khoản kiểm thử đào tạo nhanh */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            Tài khoản kiểm thử đào tạo:
          </span>
          <span className="text-[10px] text-slate-400 font-mono">Pass: 123456789</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(TRAINING_DEMO_ACCOUNTS) as TrainingDemoKey[]).map((key) => {
            const acc = TRAINING_DEMO_ACCOUNTS[key];
            const isSelected = selectedDemo === key;
            const Icon = acc.icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => quickFillDemo(key)}
                className={`p-2 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/90 dark:bg-blue-950/70 border-blue-500 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/30 shadow-xs'
                    : 'bg-slate-50/90 hover:bg-blue-50/50 border-slate-200/90 hover:border-blue-300 text-slate-800 dark:bg-slate-850 dark:hover:bg-slate-800 dark:border-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-1 w-full">
                  <span className="font-bold text-xs truncate">{acc.title}</span>
                  <Icon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                </div>
                <div className="text-[9px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  {acc.id}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Nút Đăng nhập chính - Màu Xanh Cobalt Quân Sự */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#1E3A8A] via-[#2563EB] to-[#3B82F6] hover:from-[#172554] hover:to-[#1D4ED8] text-white font-bold text-xs sm:text-sm shadow-lg shadow-blue-900/25 border border-blue-400/30 disabled:opacity-50 flex items-center justify-center space-x-2 transition-all duration-200 active:scale-98 cursor-pointer"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Đang xác thực Đào tạo...</span>
          </>
        ) : (
          <>
            <UserCheck className="w-4 h-4" />
            <span>Đăng Nhập Quản Lý Đào Tạo</span>
          </>
        )}
      </button>
    </form>
  );
};
