import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROUTE_PATHS } from '../../routes/routePaths';
import { canAccessRoute } from '../../routes/routeAccess';

export interface ProtectedRouteProps {
  children?: React.ReactNode;
  minClearance?: number;
  redirectToLogin?: string;
  redirectToForbidden?: string;
}

/**
 * ProtectedRoute Component — Bảo vệ các trang theo Trạng thái Đăng nhập và Cấp độ bảo mật (Clearance Level)
 * - Nếu chưa đăng nhập: Chuyển hướng về /login (lưu lại đường dẫn cũ để quay lại sau khi login)
 * - Nếu cấp độ bảo mật thấp hơn yêu cầu: Chuyển hướng sang /403 kèm thông điệp giải thích
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  minClearance,
  redirectToLogin = ROUTE_PATHS.LOGIN,
  redirectToForbidden = ROUTE_PATHS.ERROR_403,
}) => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  // 1. Kiểm tra đăng nhập
  if (!isAuthenticated || !user || user.user_id === 'GUEST') {
    return <Navigate to={redirectToLogin} state={{ from: location }} replace />;
  }

  // 2. Kiểm tra cấp độ mật trực tiếp từ prop hoặc routeAccess matrix
  const requiredClearance = minClearance || 1;
  const userClearance = user.clearance_level_id || 1;

  if (userClearance < requiredClearance) {
    return (
      <Navigate
        to={redirectToForbidden}
        state={{
          code: 403,
          message: `Cấp độ bảo mật hiện tại của bạn (Cấp ${userClearance} - ${user.clearance_name || 'Nội bộ'}) không đủ quyền truy cập. Khu vực này yêu cầu tối thiểu Cấp ${requiredClearance}.`,
          url: location.pathname,
        }}
        replace
      />
    );
  }

  // 3. Kiểm tra theo ma trận canAccessRoute
  const accessCheck = canAccessRoute(user, isAuthenticated, location.pathname);
  if (!accessCheck.allowed) {
    if (accessCheck.reason === 'UNAUTHENTICATED') {
      return <Navigate to={redirectToLogin} state={{ from: location }} replace />;
    }
    return (
      <Navigate
        to={redirectToForbidden}
        state={{
          code: 403,
          message: 'Quyền hạn bảo mật của bạn không đủ điều kiện truy cập vào tài nguyên này.',
          url: location.pathname,
        }}
        replace
      />
    );
  }

  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
