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
  Plus,
  Minus,
} from 'lucide-react';
import { TreeSelect } from 'antd';
import { User, MilitaryRank, MilitaryPosition } from '../../types/user';
import { Unit, SecurityLevel, Role } from '../../types';
import { usersApi } from '../../services/usersApi';
import { dashboardApi } from '../../services/dashboardApi';
import { buildUnitTree } from '../../utils/unitTree';

export interface UserFormModalProps {
  open: boolean;
  user?: User | null;
  units: Unit[];
  securityLevels: SecurityLevel[];
  roles?: Role[];
  ranks?: MilitaryRank[];
  positions?: MilitaryPosition[];
  existingUsers?: User[];
  onClose: () => void;
  onSave: (userData: Partial<User> & { username?: string; password?: string; role_id?: string }) => Promise<void>;
  onToast?: (msg: string, type?: 'success' | 'error') => void;
}

/**
 * Tự động tính toán mã quân nhân kế tiếp theo thứ tự tăng dần, lấp đầy khoảng trống (ví dụ: có 1, 3, 4 -> lấy 2; có 1, 2, 3 -> lấy 4)
 */
export const getNextUserId = (users: Array<{ user_id?: string }>): string => {
  const existingNums = new Set<number>();
  for (const u of users) {
    if (!u.user_id) continue;
    const match = u.user_id.match(/USR-(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0) {
        existingNums.add(num);
      }
    }
  }
  let candidate = 1;
  while (existingNums.has(candidate)) {
    candidate++;
  }
  return `USR-${String(candidate).padStart(3, '0')}`;
};


export const DEFAULT_USER_PASSWORD = '123456789';

export const UserFormModal: React.FC<UserFormModalProps> = ({
  open,
  user,
  units,
  securityLevels,
  roles,
  ranks,
  positions,
  existingUsers,
  onClose,
  onSave,
  onToast,
}) => {
  const isEdit = Boolean(user);

  // ── Roles ──
  const [availableRoles, setAvailableRoles] = useState<Role[]>(roles || []);

  // ── Ranks & Positions (thay vì hard-code) ──
  const [availableRanks, setAvailableRanks] = useState<MilitaryRank[]>(ranks || []);
  const [availablePositions, setAvailablePositions] = useState<MilitaryPosition[]>(positions || []);

  // ── Đồng bộ props vào state ──
  useEffect(() => {
    if (roles && roles.length > 0) {
      setAvailableRoles(roles);
    } else if (open) {
      dashboardApi.getRoles().then((res) => setAvailableRoles(res.items || [])).catch(() => {});
    }
  }, [roles, open]);

  useEffect(() => {
    if (ranks && ranks.length > 0) {
      setAvailableRanks(ranks);
    }
    if (positions && positions.length > 0) {
      setAvailablePositions(positions);
    }
    // Fallback: nếu parent không truyền, tự load từ /api/meta
    if (open && (!ranks || ranks.length === 0 || !positions || positions.length === 0)) {
      dashboardApi.getMeta()
        .then((meta: any) => {
          if (!ranks || ranks.length === 0) setAvailableRanks(meta.ranks || []);
          if (!positions || positions.length === 0) setAvailablePositions(meta.positions || []);
        })
        .catch(() => {});
    }
  }, [ranks, positions, open]);

  // ── Đơn vị công tác (Hỗ trợ mô hình phân cấp cha - con) ──
  const [availableUnits, setAvailableUnits] = useState<Unit[]>(units || []);

  useEffect(() => {
    if (units && units.length > 0) {
      setAvailableUnits(units);
    } else if (open) {
      dashboardApi
        .getUnits()
        .then((res: any) => setAvailableUnits(res.items || res || []))
        .catch(() => {});
    }
  }, [units, open]);

  const unitTree = React.useMemo(() => buildUnitTree(availableUnits), [availableUnits]);
  const rootUnitKeys = React.useMemo(() => unitTree.map((node) => String(node.key)), [unitTree]);
  const [treeExpandedKeys, setTreeExpandedKeys] = useState<string[]>([]);

  useEffect(() => {
    if (rootUnitKeys.length > 0) {
      setTreeExpandedKeys(rootUnitKeys);
    }
  }, [rootUnitKeys]);

  const [formData, setFormData] = useState<Partial<User> & { username?: string; password?: string; role_id?: string }>({
    user_id: '',
    username: '',
    password: DEFAULT_USER_PASSWORD,
    full_name: '',
    rank_name: '',
    position: '',
    unit_id: '',
    clearance_level_id: undefined,
    status: 'active',
    role_id: '',
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
        clearance_level_id: user.clearance_level_id,
        status: user.status || 'active',
        role_id: user.roles && user.roles.length > 0 ? user.roles[0] : '',
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
          unit_id: '',
          clearance_level_id: undefined,
          status: 'active',
          role_id: '',
        });
      };

      if (existingUsers && existingUsers.length > 0) {
        calculateAndSet(existingUsers);
      }
      usersApi
        .getUsers()
        .then((res) => calculateAndSet(res.items || []))
        .catch(() => {
          if (!existingUsers || existingUsers.length === 0) calculateAndSet([]);
        });
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

    if (!formData.clearance_level_id) {
      setError('Vui lòng chọn độ bảo mật!');
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
    }

    setSubmitting(true);
    try {
      const payload: Partial<User> & { username?: string; password?: string; role_id?: string } = {
        ...formData,
        user_id: formData.user_id?.trim(),
        full_name: formData.full_name?.trim(),
        username: formData.username?.trim().toLowerCase(),
        password: formData.password ? formData.password : undefined,
        clearance_level_id: Number(formData.clearance_level_id),
        role_id: formData.role_id || undefined,
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
                  className="w-full h-9.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 font-mono cursor-not-allowed opacity-80 text-sm"
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
                  className="w-full h-9.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 text-sm"
                />
              </div>
            </div>

            {/* Tài khoản xác thực cho user mới */}
            {!isEdit && (
              <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl space-y-3">
                <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold text-xs">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Thông Tin Đăng Nhập Hệ Thống</span>
                </div>

                <div className="grid grid-cols-2 gap-4 items-start">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5 text-xs whitespace-nowrap">
                      Tên đăng nhập*
                    </label>
                    <input
                      type="text"
                      value={formData.username || ''}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="Ví dụ: usr-005"
                      required
                      className="w-full h-9.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5 text-xs whitespace-nowrap">
                      Mật khẩu *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password || ''}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="Mặc định: 123456789"
                        required
                        minLength={8}
                        className="w-full h-9.5 pl-3 pr-14 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 font-mono text-sm"
                      />
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center space-x-0.5">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer"
                          title={showPassword ? 'Ẩn mật khẩu' : 'Xem mật khẩu'}
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        {formData.password && (
                          <button
                            type="button"
                            onClick={copyPassword}
                            className="p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer"
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
                <select
                  value={formData.rank_name || ''}
                  onChange={(e) => setFormData({ ...formData, rank_name: e.target.value })}
                  className="w-full h-9.5 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 cursor-pointer text-sm"
                >
                  <option value=""> Chọn cấp bậc </option>
                  {formData.rank_name && !availableRanks.some((r) => r.name === formData.rank_name) && (
                    <option value={formData.rank_name}>{formData.rank_name}</option>
                  )}
                  {availableRanks.map((r) => (
                    <option key={r.rank_id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Chức vụ</label>
                <select
                  value={formData.position || ''}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full h-9.5 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 cursor-pointer text-sm"
                >
                  <option value=""> Chọn chức vụ </option>
                  {formData.position && !availablePositions.some((p) => p.name === formData.position) && (
                    <option value={formData.position}>{formData.position}</option>
                  )}
                  {availablePositions.map((p) => (
                    <option key={p.position_id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Đơn vị công tác
                </label>
                <div
                  className="unit-treeselect-wrapper"
                  style={{ position: 'relative', width: '100%' }}
                >
                  <TreeSelect
                  value={formData.unit_id || undefined}
                  onChange={(val) => setFormData({ ...formData, unit_id: val || '' })}
                  treeData={unitTree}
                  placeholder="Chọn đơn vị công tác"
                  allowClear={{
                    clearIcon: (
                      <span
                        className="flex items-center justify-center w-4 h-4 rounded-full bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-700/70 dark:hover:bg-slate-600 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 transition-all cursor-pointer"
                        title="Xóa lựa chọn đơn vị"
                      >
                        <X className="w-2.5 h-2.5 stroke-[2]" />
                      </span>
                    ),
                  }}
                  treeExpandedKeys={treeExpandedKeys}
                  onTreeExpand={(keys) => setTreeExpandedKeys(keys as string[])}
                  onOpenChange={(visible) => {
                    if (visible && rootUnitKeys.length > 0) {
                      setTreeExpandedKeys(rootUnitKeys);
                    }
                  }}
                  treeLine={{ showLeafIcon: false }}
                  switcherIcon={(nodeProps: any) => {
                    if (nodeProps.isLeaf) return null;
                    const isExpanded = Boolean(nodeProps.expanded);
                    return (
                      <span
                        className={`qk7-tree-switcher-btn ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}
                        title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                      >
                        {isExpanded ? (
                          <Minus className="w-3 h-3 stroke-[2.5]" />
                        ) : (
                          <Plus className="w-3 h-3 stroke-[2.5]" />
                        )}
                      </span>
                    );
                  }}
                  treeNodeLabelProp="name"
                  treeNodeFilterProp="name"
                  filterTreeNode={(input: string, node: any) =>
                    String(node.name || '').toLowerCase().includes(input.toLowerCase().trim())
                  }
                  getPopupContainer={(trigger) => (trigger.parentElement as HTMLElement) || window.document.body}
                  className="qk7-treeselect w-full"
                  classNames={{ popup: { root: 'qk7-unit-treeselect-popup' } }}
                  style={{ width: '100%', height: 38 }}
                  popupMatchSelectWidth={false}
                  styles={{
                    popup: {
                      root: {
                        minWidth: 280,
                        maxWidth: 'min(520px, 90vw)',
                        maxHeight: 380,
                        overflowX: 'hidden',
                        overflowY: 'auto',
                      },
                    },
                  }}
                />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Độ bảo mật *
                </label>
                <select
                  value={formData.clearance_level_id || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, clearance_level_id: e.target.value ? Number(e.target.value) : undefined })
                  }
                  required
                  className="w-full h-9.5 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 cursor-pointer text-sm"
                >
                  <option value=""> Chọn độ bảo mật </option>
                  {securityLevels.map((lvl) => (
                    <option key={lvl.level_id} value={lvl.level_id}>
                      {lvl.name} 
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Vai trò hệ thống</label>
                <select
                  value={formData.role_id || ''}
                  onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                  className="w-full h-9.5 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 cursor-pointer text-sm"
                >
                  <option value=""> Chọn vai trò</option>
                  {availableRoles.map((r) => (
                    <option key={r.role_id} value={r.role_id}>
                      {r.name} 
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Trạng thái tài khoản</label>
                <select
                  value={formData.status === 'locked' ? 'locked' : 'active'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full h-9.5 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 text-sm"
                >
                  <option value="active">Hoạt động</option>
                  <option value="locked">Khóa</option>
                </select>
              </div>
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
                className="px-4 py-2 bg-gradient-to-r from-[#14532d] via-[#166534] to-[#15803d] hover:from-[#166534] hover:to-[#15803d] text-white font-bold rounded-xl flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-950/20 border border-amber-500/25"
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