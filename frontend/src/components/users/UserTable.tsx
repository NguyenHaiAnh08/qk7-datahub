import React from 'react';
import { User } from '../../types/user';
import { Pencil, KeyRound, Trash2, Fingerprint } from 'lucide-react';

export interface UserTableProps {
  users: User[];
  onEdit: (user: User) => void;
  onUpdateCredentials: (user: User) => void;
  onDelete: (user: User) => void;
  onEnrollFingerprint?: (user: User) => void;
  loading?: boolean;
}

export const UserTable: React.FC<UserTableProps> = ({
  users,
  onEdit,
  onUpdateCredentials,
  onDelete,
  onEnrollFingerprint,
  loading = false,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900/80 backdrop-blur-md rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
          <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-500 dark:text-slate-400 text-[11px] uppercase border-b border-slate-200 dark:border-slate-800 tracking-wider">
            <tr>
              <th className="py-3 px-4">Mã</th>
              <th className="py-3 px-4">Họ tên</th>
              <th className="py-3 px-4">Cấp bậc / Chức vụ</th>
              <th className="py-3 px-4">Đơn vị</th>
              <th className="py-3 px-4">Mức bảo mật</th>
              <th className="py-3 px-4">Trạng thái</th>
              <th className="py-3 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500 dark:text-slate-400">
                  Đang tải danh sách người dùng...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500">
                  Không tìm thấy người dùng nào phù hợp
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.user_id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3 px-4 font-mono text-amber-600 dark:text-amber-400 font-semibold">
                    {u.user_id}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                    {u.full_name}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                    {u.rank_name || ''} {u.position ? `— ${u.position}` : ''}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                    {u.unit_name || '—'}
                  </td>
                  <td className="py-3 px-4">
                    <span className="bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30 text-[10px] font-bold px-2 py-0.5 rounded">
                      {u.clearance_name || `Mức ${u.clearance_level_id}`}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        u.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {u.status || 'active'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {onEnrollFingerprint && (
                      <button
                        onClick={() => onEnrollFingerprint(u)}
                        className="p-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 dark:bg-purple-950/40 dark:hover:bg-purple-900/70 dark:text-purple-300 dark:border-transparent rounded-lg mr-1.5 transition cursor-pointer"
                        title="Đăng ký vân tay"
                      >
                        <Fingerprint className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => onEdit(u)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-transparent rounded-lg mr-1.5 transition cursor-pointer"
                      title="Sửa thông tin"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onUpdateCredentials(u)}
                      className="p-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 dark:bg-amber-900/40 dark:hover:bg-amber-900/70 dark:text-amber-300 dark:border-transparent rounded-lg mr-1.5 transition cursor-pointer"
                      title="Cập nhật tài khoản & mật khẩu"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(u)}
                      className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 dark:bg-rose-950/50 dark:hover:bg-rose-900/70 dark:text-rose-400 dark:border-transparent rounded-lg transition cursor-pointer"
                      title="Xóa người dùng"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};