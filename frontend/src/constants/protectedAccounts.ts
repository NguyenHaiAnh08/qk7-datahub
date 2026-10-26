/**
 * Tài khoản và vai trò được bảo vệ hệ thống.
 * KHÔNG THỂ gỡ các role này bằng bất kỳ cách nào.
 */
export const PROTECTED_ADMIN = {
  USER_ID: 'USR-001',
  ROLE_ID: 'ROL-01',
} as const;

/**
 * Check: roleId của userId có phải là role Admin của tài khoản bảo vệ không?
 * VD: isProtectedAdminRole('USR-001', 'ROL-01') === true
 *     isProtectedAdminRole('USR-001', 'ROL-03') === false  (gỡ role khác vẫn OK)
 *     isProtectedAdminRole('USR-002', 'ROL-01') === false  (admin khác có ROL-01? → OK, nhưng trigger trg_ProtectLastAdmin sẽ chặn)
 */
export const isProtectedAdminRole = (userId: string, roleId: string): boolean => {
  return userId === PROTECTED_ADMIN.USER_ID && roleId === PROTECTED_ADMIN.ROLE_ID;
};

/**
 * Check: user có phải là tài khoản bảo vệ không?
 * Dùng để chặn cả thao tác xóa user.
 */
export const isProtectedUser = (userId: string): boolean => {
  return userId === PROTECTED_ADMIN.USER_ID;
};