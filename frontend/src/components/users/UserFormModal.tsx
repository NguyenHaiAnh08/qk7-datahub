import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, User as UserIcon } from 'lucide-react';
import { User } from '../../types/user';
import { Unit, SecurityLevel } from '../../types';

export interface UserFormModalProps {
  open: boolean;
  user?: User | null;
  units: Unit[];
  securityLevels: SecurityLevel[];
  onClose: () => void;
  onSave: (userData: Partial<User>) => Promise<void>;
  onToast?: (msg: string, type?: 'success' | 'error') => void;
}

export const UserFormModal: React.FC<UserFormModalProps> = ({
  open,
  user,
  units,
  securityLevels,
  onClose,
  onSave,
  onToast,
}) => {
  const isEdit = Boolean(user);

  const [formData, setFormData] = useState<Partial<User>>({
    user_id: '',
    full_name: '',
    rank_name: '',
    position: '',
    unit_id: '',
    clearance_level_id: 1,
    status: 'active',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        user_id: user.user_id,
        full_name: user.full_name,
        rank_name: user.rank_name || '',
        position: user.position || '',
        unit_id: user.unit_id || '',
        clearance_level_id: user.clearance_level_id || 1,
        status: user.status || 'active',
      });
    } else {
      setFormData({
        user_id: '',
        full_name: '',
        rank_name: '',
        position: '',
        unit_id: units[0]?.unit_id || '',
        clearance_level_id: 1,
        status: 'active',
      });
    }
    setError('');
  }, [user, open, units]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.user_id || !formData.full_name) {
      setError('Mã quân nhân và Họ tên là các trường bắt buộc!');
      return;
    }

    setSubmitting(true);
    try {
      await onSave(formData);
      if (onToast) {
        onToast(isEdit ? `Cập nhật quân nhân ${formData.user_id} thành công!` : `Thêm mới quân nhân ${formData.user_id} thành công!`, 'success');
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
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] transition-colors duration-200"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Mã Quân Nhân / ID *
                </label>
                <input
                  type="text"
                  disabled={isEdit}
                  value={formData.user_id || ''}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                  placeholder="Ví dụ: USR-005"
                  required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Họ và Tên *
                </label>
                <input
                  type="text"
                  value={formData.full_name || ''}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Nguyễn Văn A"
                  required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Cấp bậc</label>
                <input
                  type="text"
                  value={formData.rank_name || ''}
                  onChange={(e) => setFormData({ ...formData, rank_name: e.target.value })}
                  placeholder="Trung tá, Thượng úy..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Chức vụ</label>
                <input
                  type="text"
                  value={formData.position || ''}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  placeholder="Trưởng phòng, Trợ lý..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Đơn vị công tác</label>
                <select
                  value={formData.unit_id || ''}
                  onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
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
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
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
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
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
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-600/30"
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
