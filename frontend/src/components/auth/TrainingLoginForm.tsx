/* <!-- Tactical Training Gateway Login Form · Trường Quân Sự Quân Khu 7 --> */
import React, { useState } from 'react';
import {
  Lock,
  GraduationCap,
  Eye,
  EyeOff,
  UserCheck,
  Loader2,
  Monitor,
  ShieldAlert,
} from 'lucide-react';
import { authService } from '../../services/authService';
import { useAuth } from '../../hooks/useAuth';
import { isUserAdmin, getDestinationByRole } from '../../contexts/AuthContext';
import { User } from '../../types/user';
import { useNavigate } from 'react-router-dom';
import { ROUTE_PATHS } from '../../routes/routePaths';
import { NotchedInput } from './NotchedInput';
import { FingerprintScanModal } from '../users/FingerprintScanModal';
import { DEMO_ACCOUNTS } from './LoginForm';

export interface TrainingLoginFormProps {
  onSuccess?: (user: User) => void;
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  onForgotPassword?: () => void;
}

// Danh sách tài khoản kiểm thử được cấp quyền đăng nhập vào Hệ Thống Quản Lý Đào Tạo (bỏ Trợ lý, thêm các tài khoản Giáo viên USR-012 & USR-013)
export type TrainingDemoKey = 'chihuy' | 'giaovien1' | 'giaovien2' | 'it' | 'admin';

export const TRAINING_DEMO_ACCOUNTS: Record<
  TrainingDemoKey,
  {
    id: string;
    code: string;
    title: string;
    subtitle: string;
    label: string;
    roleName: string;
  }
> = {
  chihuy: {
    id: DEMO_ACCOUNTS.chihuy.id,
    code: '002',
    title: DEMO_ACCOUNTS.chihuy.title,
    subtitle: 'Cấp 5 • Tuyệt Mật',
    label: DEMO_ACCOUNTS.chihuy.label,
    roleName: DEMO_ACCOUNTS.chihuy.roleName,
  },
  giaovien1: {
    id: 'USR-012',
    code: '012',
    title: 'Giáo viên',
    subtitle: 'Cấp 4 • Tối Mật, Chỉ huy',
    label: 'Thượng tá Lê Minh Tiến - Trưởng khoa Binh Chủng',
    roleName: 'Chỉ huy / Giáo viên',
  },
  giaovien2: {
    id: 'USR-013',
    code: '013',
    title: 'Giáo viên',
    subtitle: 'Cấp 2 • Nội bộ',
    label: 'Đại úy Đoàn Quang Linh - Giáo viên Khoa Binh Chủng',
    roleName: 'Giáo viên',
  },
  it: {
    id: DEMO_ACCOUNTS.it.id,
    code: '006',
    title: DEMO_ACCOUNTS.it.title,
    subtitle: 'Cấp 5 • Kỹ thuật, Toàn quyền',
    label: DEMO_ACCOUNTS.it.label,
    roleName: DEMO_ACCOUNTS.it.roleName,
  },
  admin: {
    id: DEMO_ACCOUNTS.admin.id,
    code: '001',
    title: 'Quản trị viên',
    subtitle: 'Toàn quyền Admin',
    label: DEMO_ACCOUNTS.admin.label,
    roleName: DEMO_ACCOUNTS.admin.roleName,
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
  // Admin bắt buộc quét vân tay 2FA (backend trả 202) — dùng chung modal với cổng Dữ liệu số
  const [adminFpModalOpen, setAdminFpModalOpen] = useState(false);
  const [tempTicket, setTempTicket] = useState('');

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
    if (upper === 'USR-002') setSelectedDemo('chihuy');
    else if (upper === 'USR-012') setSelectedDemo('giaovien1');
    else if (upper === 'USR-013') setSelectedDemo('giaovien2');
    else if (upper === 'USR-006') setSelectedDemo('it');
    else if (upper === 'USR-001') setSelectedDemo('admin');
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
      if (onToast) onToast(`Đã chọn tài khoản: ${acc.label}`, 'info');
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
      const res: any = await authService.login(username, password, 'training');

      // Admin cần quét vân tay 2FA (HTTP 202)
      if (res && res.require_admin_fp) {
        setTempTicket(res.temp_ticket);
        setAdminFpModalOpen(true);
        setLoading(false);
        return;
      }

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
        // Cổng giám sát chỉ có Admin / Chỉ huy (backend đã chặn vai trò khác)
        if (isUserAdmin(loggedInUser)) {
          navigate(ROUTE_PATHS.ADMIN, { replace: true });
        } else {
          navigate(getDestinationByRole(loggedInUser), { replace: true });
        }
      }
    } catch (err: any) {
      console.error('[Đăng nhập Đào tạo thất bại]:', err?.message || err);
      const rawMsg = err?.message || '';
      if (err?.data?.code === 'PORTAL_FORBIDDEN') {
        // Mật khẩu đúng nhưng tài khoản không được vào cổng này → không báo "sai mật khẩu"
        setUsernameError('');
        setPasswordError(rawMsg);
      } else {
        setUsernameError('Tài khoản hoặc mật khẩu không chính xác');
        setPasswordError(rawMsg || 'Vui lòng kiểm tra lại thông tin xác thực');
      }
      setUsernameShake((prev) => prev + 1);
      setPasswordShake((prev) => prev + 1);

      if (onToast) {
        onToast(err?.message || 'Đăng nhập phân hệ Đào tạo thất bại!', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Sau khi quét vân tay Admin thành công: lưu token, lấy thông tin, vào trang quản trị
  const handleAdminFpSuccess = async (finalToken: string) => {
    setAdminFpModalOpen(false);
    if (!finalToken) return;
    try {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('qk7_fp_token')) sessionStorage.removeItem(key);
      });
    } catch (_) {}
    sessionStorage.setItem('qk7_token', finalToken);
    try {
      const me = await authService.getMe();
      saveUserSession(me);
      if (onToast) onToast('Xác thực vân tay Quản trị viên thành công!', 'success');
      if (onSuccess) onSuccess(me);
      else navigate(isUserAdmin(me) ? ROUTE_PATHS.ADMIN : getDestinationByRole(me), { replace: true });
    } catch (err: any) {
      if (onToast) onToast('Lỗi khi lấy thông tin người dùng sau khi xác thực: ' + err.message, 'error');
    }
  };

  return (
    <>
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

      {/* Tài khoản kiểm thử đào tạo nhanh — Đồng bộ 100% UX/UI với Trung Tâm Dữ Liệu Số */}
      <div className="space-y-1.5 pt-0.5">
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-400">
            Tài khoản kiểm thử nhanh:
          </span>
          <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono font-medium">Pass: 123456789</span>
        </div>

        {/* 5 Tài khoản được cấp quyền đăng nhập Hệ Thống Quản Lý Đào Tạo (Lưới 2 cột chuẩn Double-Slider) */}
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
          {/* 1. Chỉ huy (002) */}
          <button
            type="button"
            onClick={() => quickFillDemo('chihuy')}
            title="Đại tá Lương Nhật Thăng - Trưởng phòng Tham mưu - Hành chính"
            className={`p-1.5 sm:p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
              selectedDemo === 'chihuy'
                ? 'bg-blue-50 dark:bg-blue-950/70 border-blue-500/60 text-blue-800 dark:text-blue-200 ring-1 ring-blue-500/40 shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:border-slate-700/80 dark:text-slate-200'
            }`}
          >
            <div className="min-w-0 pr-1">
              <div className="font-bold text-xs flex items-center gap-1">
                <span>Chỉ huy</span>
                <span className="text-[10px] font-mono text-slate-400">002</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Cấp 5 • Tuyệt Mật</div>
            </div>
            <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 dark:text-blue-400 shrink-0" />
          </button>

          {/* 2. Giáo viên (012 - Lê Minh Tiến: Chỉ huy & Giáo viên) */}
          <button
            type="button"
            onClick={() => quickFillDemo('giaovien1')}
            title="Thượng tá Lê Minh Tiến - Trưởng khoa Binh Chủng"
            className={`p-1.5 sm:p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
              selectedDemo === 'giaovien1'
                ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-500/60 text-indigo-800 dark:text-indigo-200 ring-1 ring-indigo-500/40 shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:border-slate-700/80 dark:text-slate-200'
            }`}
          >
            <div className="min-w-0 pr-1">
              <div className="font-bold text-xs flex items-center gap-1">
                <span>Giáo viên</span>
                <span className="text-[10px] font-mono text-slate-400">012</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Cấp 4 • Tối Mật, Chỉ huy</div>
            </div>
            <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
          </button>

          {/* 3. Giáo viên (013 - Đoàn Quang Linh: Giáo viên) */}
          <button
            type="button"
            onClick={() => quickFillDemo('giaovien2')}
            title="Đại úy Đoàn Quang Linh - Giáo viên Khoa Binh Chủng"
            className={`p-1.5 sm:p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
              selectedDemo === 'giaovien2'
                ? 'bg-teal-50 dark:bg-teal-950/70 border-teal-500/60 text-teal-800 dark:text-teal-200 ring-1 ring-teal-500/40 shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:border-slate-700/80 dark:text-slate-200'
            }`}
          >
            <div className="min-w-0 pr-1">
              <div className="font-bold text-xs flex items-center gap-1">
                <span>Giáo viên</span>
                <span className="text-[10px] font-mono text-slate-400">013</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Cấp 2 • Nội bộ</div>
            </div>
            <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-500 dark:text-teal-400 shrink-0" />
          </button>

          {/* 4. Nhân viên IT (006) */}
          <button
            type="button"
            onClick={() => quickFillDemo('it')}
            title="Trung sĩ Nguyễn Hải Anh - Nhân viên IT"
            className={`p-1.5 sm:p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
              selectedDemo === 'it'
                ? 'bg-cyan-50 dark:bg-cyan-950/70 border-cyan-500/60 text-cyan-800 dark:text-cyan-200 ring-1 ring-cyan-500/40 shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:border-slate-700/80 dark:text-slate-200'
            }`}
          >
            <div className="min-w-0 pr-1">
              <div className="font-bold text-xs flex items-center gap-1">
                <span>Nhân viên IT</span>
                <span className="text-[10px] font-mono text-slate-400">006</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Cấp 5 • Kỹ thuật, Toàn quyền</div>
            </div>
            <Monitor className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-500 dark:text-cyan-400 shrink-0" />
          </button>

          {/* 5. Quản trị viên (001) */}
          <button
            type="button"
            onClick={() => quickFillDemo('admin')}
            title="Thiếu tá QNCN Nguyễn Mạnh Nam - Quản trị viên"
            className={`p-1.5 sm:p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
              selectedDemo === 'admin'
                ? 'bg-amber-50 dark:bg-amber-950/70 border-amber-500/60 text-amber-800 dark:text-amber-200 ring-1 ring-amber-500/40 shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:border-slate-700/80 dark:text-slate-200'
            }`}
          >
            <div className="min-w-0 pr-1">
              <div className="font-bold text-xs flex items-center gap-1">
                <span>Quản trị viên</span>
                <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400 font-semibold bg-amber-500/10 px-1 rounded">001</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Toàn quyền Admin</div>
            </div>
            <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 dark:text-amber-400 shrink-0" />
          </button>
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

    {/* Modal quét vân tay 2FA cho Admin (cổng Đào tạo) */}
    <FingerprintScanModal
      open={adminFpModalOpen}
      purpose="admin_login"
      tempTicket={tempTicket}
      portal="training"
      onSuccess={handleAdminFpSuccess}
      onCancel={() => setAdminFpModalOpen(false)}
    />
    </>
  );
};
