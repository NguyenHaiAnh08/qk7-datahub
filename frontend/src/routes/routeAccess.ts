import { ROUTE_PATHS } from './routePaths';
import { User } from '../types/user';

/**
 * Route Access Control — Phân quyền truy cập các màn hình theo Cấp độ bảo mật quân sự (Clearance Level)
 * Source of truth cho việc bảo vệ các tuyến đường ở phía Frontend (Client Route Guard)
 */

export interface RouteAccessConfig {
  path: string;
  requiresAuth: boolean;
  minClearance?: number;
  description?: string;
}

export const ROUTE_ACCESS: Record<string, RouteAccessConfig> = {
  // Public - Không yêu cầu đăng nhập
  [ROUTE_PATHS.LOGIN]: {
    path: ROUTE_PATHS.LOGIN,
    requiresAuth: false,
    description: 'Trang đăng nhập xác thực quân nhân',
  },
  [ROUTE_PATHS.INDEX]: {
    path: ROUTE_PATHS.INDEX,
    requiresAuth: false,
    minClearance: 1,
    description: 'Cổng tra cứu tài liệu công khai',
  },
  [ROUTE_PATHS.PORTAL]: {
    path: ROUTE_PATHS.PORTAL,
    requiresAuth: false,
    minClearance: 1,
    description: 'Cổng tra cứu tài liệu quân sự',
  },

  // Protected - Yêu cầu đăng nhập & Cấp độ mật tối thiểu
  // Cấp 3 (Mật): Sĩ quan, trợ lý tác chiến, văn thư phụ trách số hóa
  [ROUTE_PATHS.DESK]: {
    path: ROUTE_PATHS.DESK,
    requiresAuth: true,
    minClearance: 3,
    description: 'Bàn làm việc văn thư và số hóa văn bản (Yêu cầu Mức 3 - Mật)',
  },

  // Cấp 4 (Tối mật): Chỉ huy đơn vị, ban tham mưu
  [ROUTE_PATHS.ADMIN]: {
    path: ROUTE_PATHS.ADMIN,
    requiresAuth: true,
    minClearance: 4,
    description: 'Bảng điều khiển quản trị trung tâm (Yêu cầu Mức 4 - Tối Mật)',
  },

  // Cấp 4+ (Tối mật / Tuyệt mật): Quản lý quân nhân và cấp phát mật khẩu
  [ROUTE_PATHS.USERS]: {
    path: ROUTE_PATHS.USERS,
    requiresAuth: true,
    minClearance: 4,
    description: 'Quản trị tài khoản quân nhân & phân quyền (Yêu cầu Mức 4+)',
  },

  // Error Pages - Luôn cho phép truy cập để hiển thị phản hồi lỗi
  [ROUTE_PATHS.ERROR_400]: { path: ROUTE_PATHS.ERROR_400, requiresAuth: false },
  [ROUTE_PATHS.ERROR_401]: { path: ROUTE_PATHS.ERROR_401, requiresAuth: false },
  [ROUTE_PATHS.ERROR_403]: { path: ROUTE_PATHS.ERROR_403, requiresAuth: false },
  [ROUTE_PATHS.ERROR_404]: { path: ROUTE_PATHS.ERROR_404, requiresAuth: false },
  [ROUTE_PATHS.ERROR_500]: { path: ROUTE_PATHS.ERROR_500, requiresAuth: false },
  [ROUTE_PATHS.ERROR_502]: { path: ROUTE_PATHS.ERROR_502, requiresAuth: false },
  [ROUTE_PATHS.ERROR_503]: { path: ROUTE_PATHS.ERROR_503, requiresAuth: false },
  [ROUTE_PATHS.ERROR_DYNAMIC]: { path: ROUTE_PATHS.ERROR_DYNAMIC, requiresAuth: false },
};

/**
 * Tìm cấu hình phân quyền cho đường dẫn hiện tại (Hỗ trợ tiền tố path)
 */
export function getRouteAccess(pathname: string): RouteAccessConfig | null {
  const path = pathname.replace(/\/$/, '') || '/';
  if (ROUTE_ACCESS[path]) {
    return ROUTE_ACCESS[path];
  }

  for (const key of Object.keys(ROUTE_ACCESS)) {
    const config = ROUTE_ACCESS[key];
    const configPath = config.path.replace(/\/$/, '');
    if (configPath !== '/' && path.startsWith(configPath + '/')) {
      return config;
    }
  }

  return null;
}

/**
 * Kiểm tra xem phiên làm việc hiện tại có quyền truy cập vào đường dẫn không
 */
export function canAccessRoute(
  user: User | null,
  isAuthenticated: boolean,
  pathname: string
): { allowed: boolean; reason?: 'UNAUTHENTICATED' | 'INSUFFICIENT_CLEARANCE' } {
  const config = getRouteAccess(pathname);

  // Không có cấu hình đặc biệt -> cho phép truy cập
  if (!config) return { allowed: true };

  // Chưa đăng nhập vào trang yêu cầu xác thực
  if (config.requiresAuth && !isAuthenticated) {
    return { allowed: false, reason: 'UNAUTHENTICATED' };
  }

  // Cấp độ bảo mật (Clearance Level) chưa đủ điều kiện
  if (config.minClearance && (!user || (user.clearance_level_id || 1) < config.minClearance)) {
    return { allowed: false, reason: 'INSUFFICIENT_CLEARANCE' };
  }

  return { allowed: true };
}
