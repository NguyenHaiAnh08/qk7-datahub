import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROUTE_PATHS } from '../../routes/routePaths';
import { getDestinationByRole } from '../../contexts/AuthContext';

export interface ProtectedRouteProps {
  children?: React.ReactNode;
  adminOnly?: boolean;
  staffOnly?: boolean;
  minClearance?: number;
  redirectToLogin?: string;
  requiredPermission?: string;        // ⭐ MỚI
  requiredAnyOf?: string[];           // ⭐ MỚI
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  adminOnly,
  staffOnly,
  minClearance,
  redirectToLogin = ROUTE_PATHS.LOGIN,
  requiredPermission,
  requiredAnyOf,
}) => {
  const { user, isAuthenticated, isAdmin, isStaff, hasPermission, hasAnyPermission } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !user || user.user_id === 'GUEST') {
    return <Navigate to={redirectToLogin} state={{ from: location }} replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to={getDestinationByRole(user)} replace />;
  }

  if (staffOnly && !isStaff && !isAdmin) {
    return <Navigate to={ROUTE_PATHS.PORTAL} replace />;
  }

  if (minClearance && minClearance > 1 && (user.clearance_level_id || 1) < minClearance) {
    return <Navigate to={ROUTE_PATHS.PORTAL} replace />;
  }

  // ⭐ Permission checks
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to={getDestinationByRole(user)} replace />;
  }

  if (requiredAnyOf && requiredAnyOf.length > 0 && !hasAnyPermission(requiredAnyOf)) {
    return <Navigate to={getDestinationByRole(user)} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;