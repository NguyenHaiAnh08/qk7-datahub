import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User as UserIcon, Save } from 'lucide-react';
import { User, Unit, SecurityLevel } from '../../types';

export interface UserFormModalProps {
  open: boolean;
  user: Partial<User> | null;
  units: Unit[];
  securityLevels: SecurityLevel[];
  onClose: () => void;
  onSave: (userData: Partial<User>) => Promise<void>;
}

export const UserFormModal: React.FC<UserFormModalProps> = ({
  open,
  user,
  units,
  securityLevels,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<User>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isEdit = Boolean(user && user.user_id);

  useEffect(() => {
    if (open) {
      if (user) {
        setFormData({ ...user });
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
    }
  }, [open, user, units]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.user_id?.trim() || !formData.full_name?.trim()) {
      setError('Mã người dùng và Họ tên là bắt buộc!');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu thông tin người dùng');
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
          className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <UserIcon className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-base text-white">
                {isEdit ? 'Chỉnh Sửa Thông Tin Quân Nhân' : 'Thêm Người Dùng Mới'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 font-medium">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Mã Quân Nhân / ID *
                </label>
                <input
                  type="text"
                  disabled={isEdit}
                  value={formData.user_id || ''}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                  placeholder="Ví dụ: USR-005"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Họ và Tên *
                </label>
                <input
                  type="text"
                  value={formData.full_name || ''}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Nguyễn Văn A"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Cấp bậc</label>
                <input
                  type="text"
                  value={formData.rank_name || ''}
                  onChange={(e) => setFormData({ ...formData, rank_name: e.target.value })}
                  placeholder="Trung tá, Thượng úy..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Chức vụ</label>
                <input
                  type="text"
                  value={formData.position || ''}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  placeholder="Trưởng phòng, Trợ lý..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Đơn vị công tác</label>
                <select
                  value={formData.unit_id || ''}
                  onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
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
                <label className="block text-slate-300 font-semibold mb-1">
                  Mức bảo mật / Clearance *
                </label>
                <select
                  value={formData.clearance_level_id || 1}
                  onChange={(e) =>
                    setFormData({ ...formData, clearance_level_id: Number(e.target.value) })
                  }
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
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
              <label className="block text-slate-300 font-semibold mb-1">Trạng thái tài khoản</label>
              <select
                value={formData.status || 'active'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="active">Hoạt động (active)</option>
                <option value="locked">Khóa tạm thời (locked)</option>
                <option value="inactive">Ngừng sử dụng (inactive)</option>
              </select>
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
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-1.5 transition disabled:opacity-50"
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
