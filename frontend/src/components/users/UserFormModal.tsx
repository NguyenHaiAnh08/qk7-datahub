import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Save,
  User as UserIcon,
  KeyRound,
  Copy,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';
import { User } from '../../types/user';
import { Unit, SecurityLevel } from '../../types';
import { usersApi } from '../../services/usersApi';

export interface UserFormModalProps {
  open: boolean;
  user?: User | null;
  units: Unit[];
  securityLevels: SecurityLevel[];
  existingUsers?: User[];
  onClose: () => void;
  onSave: (userData: Partial<User> & { username?: string; password?: string }) => Promise<void>;
  onToast?: (msg: string, type?: 'success' | 'error') => void;
}

/**
 * Tự động tính toán mã quân nhân kế tiếp theo thứ tự tăng dần (ví dụ: USR-001...USR-004 -> USR-005)
 */
export const getNextUserId = (users: Array<{ user_id?: string }>): string => {
  let maxNum = 0;
  for (const u of users) {
    if (!u.user_id) continue;
    const match = u.user_id.match(/USR-(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }
  const nextNum = maxNum + 1;
  return `USR-${String(nextNum).padStart(3, '0')}`;
};

export const DEFAULT_USER_PASSWORD = 'Abc@12345';

export const UserFormModal: React.FC<UserFormModalProps> = ({
  open,
  user,
  units,
  securityLevels,
  existingUsers,
  onClose,
  onSave,
  onToast,
}) => {
  const isEdit = Boolean(user);

  const [formData, setFormData] = useState<Partial<User> & { username?: string; password?: string }>({
    user_id: '',
    username: '',
    password: DEFAULT_USER_PASSWORD,
    full_name: '',
    rank_name: '',
    position: '',
    unit_id: '',
    clearance_level_id: 1,
    status: 'active',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const copyPassword = () => {
    if (!formData.password) return;
    navigator.clipboard.writeText(formData.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (user) {
      setFormData({
        user_id: user.user_id,
        username: user.username || user.user_id.toLowerCase(),
        password: '',
        full_name: user.full_name,
        rank_name: user.rank_name || '',
        position: user.position || '',
        unit_id: user.unit_id || '',
        clearance_level_id: user.clearance_level_id || 1,
        status: user.status || 'active',
      });
    } else if (open) {
      const calculateAndSet = (list: User[]) => {
        const nextId = getNextUserId(list);
        setFormData({
          user_id: nextId,
          username: nextId.toLowerCase(),
          password: DEFAULT_USER_PASSWORD,
          full_name: '',
          rank_name: '',
          position: '',
          unit_id: units[0]?.unit_id || '',
          clearance_level_id: 1,
          status: 'active',
        });
      };

      if (existingUsers && existingUsers.length > 0) {
        calculateAndSet(existingUsers);
      } else {
        usersApi
          .getUsers()
          .then((res) => calculateAndSet(res.items || []))
          .catch(() => calculateAndSet([]));
      }
    }
    setError('');
    setCopied(false);
    setShowPassword(false);
  }, [user, open, units, existingUsers]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.user_id || !formData.full_name?.trim()) {
      setError('Mã quân nhân và Họ tên là các trường bắt buộc!');
      return;
    }

    if (!isEdit) {
      if (!formData.username || !formData.username.trim()) {
        setError('Tên đăng nhập (Username) không được để trống!');
        return;
      }
      if (!formData.password || formData.password.length < 8) {
        setError('Mật khẩu cần ít nhất 8 ký tự!');
        return;
      }
      if (!formData.clearance_level_id) {
        setError('Vui lòng chọn mức bảo mật!');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload: Partial<User> & { username?: string; password?: string } = {
        ...formData,
        user_id: formData.user_id?.trim(),
        full_name: formData.full_name?.trim(),
        username: formData.username?.trim().toLowerCase(),
        password: formData.password ? formData.password : undefined,
        clearance_level_id: Number(formData.clearance_level_id || 1),
      };

      await onSave(payload);
      if (onToast) {
        onToast(
          isEdit
            ? `Cập nhật quân nhân ${formData.user_id} thành công!`
            : `Thêm mới quân nhân ${formData.user_id} thành công!`,
          'success'
        );
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Thao tác không thành công, vui lòng kiểm tra lại!');
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
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh] transition-colors duration-200"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <UserIcon className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {isEdit ? 'Chỉnh Sửa Thông Tin Quân Nhân' : 'Thêm Người Dùng Mới'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 font-medium">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 items-start">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5 text-xs whitespace-nowrap">
                  Mã Quân Nhân / ID (Tự động) *
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={formData.user_id || ''}
                  placeholder="Ví dụ: USR-005"
                  required
                  className="w-full h-9 px-3 py-1.5 bg-slate-100 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 font-mono cursor-not-allowed opacity-80 text-xs"
                  title="Mã định danh quân nhân được hệ thống tự động khởi tạo theo thứ tự"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5 text-xs whitespace-nowrap">
                  Họ và Tên *
                </label>
                <input
                  type="text"
                  value={formData.full_name || ''}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Nguyễn Văn A"
                  required
                  className="w-full h-9 px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500 text-xs"
                />
              </div>
            </div>

            {/* Tài khoản xác thực cho user mới */}
            {!isEdit && (
              <div className="p-3.5 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 rounded-xl space-y-3">
                <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300 font-bold text-xs">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Thông Tin Đăng Nhập Hệ Thống</span>
                </div>

                <div className="grid grid-cols-2 gap-4 items-start">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5 text-xs whitespace-nowrap">
                      Tên đăng nhập (Username) *
                    </label>
                    <input
                      type="text"
                      value={formData.username || ''}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="Ví dụ: usr-005"
                      required
                      className="w-full h-9 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500 font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5 text-xs whitespace-nowrap">
                      Mật khẩu (≥ 8 ký tự) *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password || ''}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="Mặc định: Abc@12345"
                        required
                        minLength={8}
                        className="w-full h-9 pl-3 pr-14 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500 font-mono text-xs"
                      />
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center space-x-0.5">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-1 text-slate-400 hover:text-purple-500 dark:hover:text-purple-400 transition cursor-pointer"
                          title={showPassword ? 'Ẩn mật khẩu' : 'Xem mật khẩu'}
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        {formData.password && (
                          <button
                            type="button"
                            onClick={copyPassword}
                            className="p-1 text-slate-400 hover:text-purple-500 dark:hover:text-purple-400 transition cursor-pointer"
                            title="Sao chép mật khẩu"
                          >
                            {copied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Cấp bậc</label>
                <input
                  type="text"
                  value={formData.rank_name || ''}
                  onChange={(e) => setFormData({ ...formData, rank_name: e.target.value })}
                  placeholder="Trung tá, Thượng úy..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Chức vụ</label>
                <input
                  type="text"
                  value={formData.position || ''}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  placeholder="Trưởng phòng, Trợ lý..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Đơn vị công tác</label>
                <select
                  value={formData.unit_id || ''}
                  onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500"
                >
                  <option value="">-- Chọn đơn vị --</option>
                  {units.map((u) => (
                    <option key={u.unit_id} value={u.unit_id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Mức bảo mật / Clearance *
                </label>
                <select
                  value={formData.clearance_level_id || 1}
                  onChange={(e) =>
                    setFormData({ ...formData, clearance_level_id: Number(e.target.value) })
                  }
                  required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500"
                >
                  {securityLevels.map((lvl) => (
                    <option key={lvl.level_id} value={lvl.level_id}>
                      {lvl.name} (Cấp {lvl.level_id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Trạng thái tài khoản</label>
              <select
                value={formData.status || 'active'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500"
              >
                <option value="active">Hoạt động (active)</option>
                <option value="locked">Khóa tạm thời (locked)</option>
                <option value="inactive">Ngừng sử dụng (inactive)</option>
              </select>
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
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-md shadow-purple-600/30"
              >
                <Save className="w-3.5 h-3.5" />
                {submitting ? 'Đang lưu...' : 'Lưu thông tin'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

