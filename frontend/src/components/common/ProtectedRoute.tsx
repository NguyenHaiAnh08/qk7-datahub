import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROUTE_PATHS } from '../../routes/routePaths';
import { canAccessRoute } from '../../routes/routeAccess';
import { getDestinationByRole } from '../../contexts/AuthContext';

export interface ProtectedRouteProps {
  children?: React.ReactNode;
  adminOnly?: boolean;
  staffOnly?: boolean;
  minClearance?: number;
  redirectToLogin?: string;
  redirectToForbidden?: string;
}

/**
 * ProtectedRoute Component — Bảo vệ các trang theo Trạng thái Đăng nhập và Role
 * - Chưa đăng nhập: Chuyển hướng về /login
 * - Không đủ quyền hạn role (ví dụ không phải Admin hoặc không phải Văn thư):
 *   Tự động chuyển hướng về trang làm việc tương ứng theo Role của họ (KHÔNG để trạng thái 403)
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  adminOnly,
  staffOnly,
  minClearance,
  redirectToLogin = ROUTE_PATHS.LOGIN,
}) => {
  const { user, isAuthenticated, isAdmin, isStaff } = useAuth();
  const location = useLocation();

  // 1. Kiểm tra đăng nhập
  if (!isAuthenticated || !user || user.user_id === 'GUEST') {
    return <Navigate to={redirectToLogin} state={{ from: location }} replace />;
  }

  // 2. Kiểm tra quyền Admin nếu trang yêu cầu adminOnly
  // Nếu không phải Admin: Tự động chuyển hướng về trang làm việc đúng theo Role của họ, KHÔNG hiển thị 403
  if (adminOnly && !isAdmin) {
    const target = getDestinationByRole(user);
    const destination = target === location.pathname ? ROUTE_PATHS.PORTAL : target;
    return <Navigate to={destination} replace />;
  }

  // 3. Kiểm tra quyền Văn thư / Thư ký nếu trang yêu cầu staffOnly
  // Nếu không phải Văn thư/Thư ký và không phải Admin: Tự động chuyển hướng về /portal
  if (staffOnly && !isStaff && !isAdmin) {
    return <Navigate to={ROUTE_PATHS.PORTAL} replace />;
  }

  // 4. Kiểm tra cấp độ mật trực tiếp từ prop (nếu có yêu cầu đặc biệt)
  if (minClearance && minClearance > 1) {
    const userClearance = user.clearance_level_id || 1;
    if (userClearance < minClearance) {
      return <Navigate to={ROUTE_PATHS.PORTAL} replace />;
    }
  }

  // 5. Kiểm tra theo ma trận canAccessRoute
  const accessCheck = canAccessRoute(user, isAuthenticated, location.pathname);
  if (!accessCheck.allowed) {
    if (accessCheck.reason === 'UNAUTHENTICATED') {
      return <Navigate to={redirectToLogin} state={{ from: location }} replace />;
    }
    const target = getDestinationByRole(user);
    const destination = target === location.pathname ? ROUTE_PATHS.PORTAL : target;
    return <Navigate to={destination} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;

