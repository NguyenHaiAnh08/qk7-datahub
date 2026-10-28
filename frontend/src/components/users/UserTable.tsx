import React, { useState, useEffect, useMemo } from 'react';
import { Pagination, Tooltip } from 'antd';
import { User } from '../../types/user';
import { useAuth } from '../../hooks/useAuth';
import { Pencil, KeyRound, Trash2, Fingerprint, Shield } from 'lucide-react';

export interface UserTableProps {
  users: User[];
  onEdit: (user: User) => void;
  onUpdateCredentials: (user: User) => void;
  onDelete: (user: User) => void;
  onEnrollFingerprint?: (user: User) => void;
  onGrantPermission?: (user: User) => void; // ⭐ MỚI
  onViewPermissions?: (user: User) => void; // ⭐ MỚI
  loading?: boolean;
  pageSize?: number;
}

export const UserTable: React.FC<UserTableProps> = ({
  users,
  onEdit,
  onUpdateCredentials,
  onDelete,
  onEnrollFingerprint,
  onGrantPermission,
  onViewPermissions,
  loading = false,
  pageSize = 5,
}) => {
  // ⭐ Lấy trạng thái quyền của user đang đăng nhập
  const { user, hasPermission } = useAuth();
  const isAdminUser = (user?.roles || []).includes('ROL-01');
  const canDeleteUser = hasPermission('USER_DELETE');

  const [currentPage, setCurrentPage] = useState<number>(1);

  // Tự động reset trang về 1 khi số lượng users thay đổi (do search/filter)
  useEffect(() => {
    setCurrentPage(1);
  }, [users.length]);

  const totalPages = Math.ceil(users.length / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const pagedUsers = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return users.slice(start, start + pageSize);
  }, [users, safeCurrentPage, pageSize]);

  return (
    <div className="bg-white dark:bg-slate-900/80 backdrop-blur-md rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
      <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 min-w-[1060px]">
          <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-500 dark:text-slate-400 text-[11px] uppercase border-b border-slate-200 dark:border-slate-800 tracking-wider">
            <tr>
              <th className="py-3 px-4 whitespace-nowrap">Mã</th>
              <th className="py-3 px-4 whitespace-nowrap">Họ và tên</th>
              <th className="py-3 px-4 whitespace-nowrap">Cấp bậc</th>
              <th className="py-3 px-4 whitespace-nowrap">Chức vụ</th>
              <th className="py-3 px-4 whitespace-nowrap">Vai trò</th>
              <th className="py-3 px-4 whitespace-nowrap">Đơn vị</th>
              <th className="py-3 px-4 whitespace-nowrap">Mức bảo mật</th>
              <th className="py-3 px-4">Quyền</th>
              <th className="py-3 px-4 whitespace-nowrap">Trạng thái</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
            {loading ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-500 dark:text-slate-400">
                  Đang tải danh sách người dùng...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-slate-500">
                  Không tìm thấy người dùng nào phù hợp
                </td>
              </tr>
            ) : (
              pagedUsers.map((u) => (
                <tr
                  key={u.user_id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3 px-4 font-mono tabular-nums font-semibold whitespace-nowrap">
                    <span className="font-mono tabular-nums text-xs px-2.5 py-1 rounded-md text-amber-800 bg-amber-500/10 border border-amber-600/25 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/25 font-bold tracking-wider inline-block">
                      {u.user_id}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                    {u.full_name}
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                    {u.rank_name || '—'}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {u.position || '—'}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {(() => {
                      const roles = (u.role_names && u.role_names.length > 0)
                        ? u.role_names
                        : (u.roles && u.roles.length > 0)
                        ? u.roles
                        : [];
                      if (roles.length === 0) {
                        return <span className="text-slate-400 dark:text-slate-600">—</span>;
                      }
                      return (
                        <div className="flex flex-wrap items-center gap-1 max-w-[200px]">
                          {roles.map((rn, idx) => {
                            const isAdmin = rn.toLowerCase().includes('admin');
                            return (
                              <span
                                key={idx}
                                className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap border ${
                                  isAdmin
                                    ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30'
                                    : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25'
                                }`}
                              >
                                {rn}
                              </span>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {u.unit_name || '—'}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap border ${
                        (u.clearance_level_id || 1) >= 4
                           ? 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30'
                          : (u.clearance_level_id || 1) === 3
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      {u.clearance_name || `Mức ${u.clearance_level_id}`}
                    </span>
                  </td>
                  {/* ⭐ Cột Quyền — click để xem chi tiết (nếu có onViewPermissions) */}
                  <td className="py-3 px-4">
                    <div
                      className={`flex items-center gap-1.5 ${
                        onViewPermissions
                          ? 'cursor-pointer hover:opacity-80 transition'
                          : ''
                      }`}
                      onClick={onViewPermissions ? () => onViewPermissions(u) : undefined}
                      title={onViewPermissions ? 'Xem chi tiết quyền' : undefined}
                      role={onViewPermissions ? 'button' : undefined}
                    >
                      <span className="text-[11px] font-mono font-bold text-purple-600 dark:text-purple-400">
                        {(u.permissions || []).length}
                      </span>
                      {(u.roles || []).length > 0 && (
                        <span className="text-[10px] text-slate-400">
                          +{(u.roles || []).length} role
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap border ${
                        u.status === 'active' || !u.status
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {u.status === 'active' || !u.status ? 'Hoạt động' : 'Khóa'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {onEnrollFingerprint && (
                      <button
                        onClick={() => onEnrollFingerprint(u)}
                        className={`p-1.5 rounded-lg mr-1.5 transition-all cursor-pointer btn-tactile active:scale-95 ${
                          u.has_fingerprint
                            ? 'bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-800/50'
                            : 'bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:hover:bg-amber-900/70 dark:text-amber-300 dark:border-amber-800/50'
                        }`}
                        title={
                          u.has_fingerprint
                            ? 'Đã có vân tay (Nhấn để thay thế / dán đè)'
                            : 'Chưa có vân tay (Nhấn để thêm vân tay)'
                        }
                      >
                        <Fingerprint className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* ⭐ MỚI — Nút Gán quyền trực tiếp */}
                    {onGrantPermission && (
                      <button
                        onClick={() => onGrantPermission(u)}
                        className="p-1.5 rounded-lg mr-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/70 dark:text-indigo-300 dark:border-indigo-800/50 transition cursor-pointer"
                        title="Gán quyền trực tiếp"
                      >
                        <Shield className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => onEdit(u)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-transparent rounded-lg mr-1.5 transition-all cursor-pointer btn-tactile active:scale-95"
                      title="Sửa thông tin"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onUpdateCredentials(u)}
                      className="p-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 dark:bg-amber-900/40 dark:hover:bg-amber-900/70 dark:text-amber-300 dark:border-transparent rounded-lg mr-1.5 transition-all cursor-pointer btn-tactile active:scale-95"
                      title="Cập nhật tài khoản & mật khẩu"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>

                    {/* ⭐ Nút Xóa — chỉ hiển thị khi có quyền USER_DELETE,
                        nếu không phải Admin sẽ hiện cảnh báo "cần phê duyệt" */}
                    {canDeleteUser && (() => {
                      const needsApproval = !isAdminUser;
                      const tooltip = needsApproval
                        ? '⚠️ Yêu cầu quyền Admin để xóa — bấm để gửi yêu cầu phê duyệt'
                        : 'Xóa người dùng (đưa vào thùng rác)';

                      return (
                        <Tooltip title={tooltip} placement="top" arrow>
                          <button
                            type="button"
                            onClick={() => onDelete(u)}
                            aria-label={needsApproval ? 'Yêu cầu duyệt xóa người dùng' : 'Xóa người dùng'}
                            className={`
                              p-1.5 rounded-lg transition-all duration-200 cursor-pointer
                              btn-tactile active:scale-95
                              ${
                                needsApproval
                                  ? 'bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-500 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-400 dark:border-slate-700 hover:text-amber-600 dark:hover:text-amber-400'
                                  : 'bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 dark:bg-rose-950/50 dark:hover:bg-rose-900/70 dark:text-rose-400 dark:border-transparent'
                              }
                            `}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      );
                    })()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Phân trang 5 quân nhân / trang */}
      {!loading && users.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 text-xs bg-slate-50/60 dark:bg-slate-900/60">
          <div className="text-slate-500 dark:text-slate-400">
            Hiển thị <span className="font-semibold text-slate-800 dark:text-slate-200">{(safeCurrentPage - 1) * pageSize + 1}</span> -{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{Math.min(safeCurrentPage * pageSize, users.length)}</span> trên{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{users.length}</span> quân nhân
          </div>
          <Pagination
            size="small"
            current={safeCurrentPage}
            pageSize={pageSize}
            total={users.length}
            onChange={(page) => setCurrentPage(page)}
            showSizeChanger={false}
          />
        </div>
      )}
    </div>
  );
};