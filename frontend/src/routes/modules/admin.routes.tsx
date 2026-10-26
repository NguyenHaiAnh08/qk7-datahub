import React from 'react';
import { Navigate } from 'react-router-dom';
import { AdminDashboardPage } from '../../pages/AdminDashboardPage';
import { UsersPage } from '../../pages/UsersPage';
import { TrashPage } from '../../pages/TrashPage';
import { SessionsPage } from '../../pages/SessionsPage';
import { ProtectedRoute } from '../../components/common/ProtectedRoute';
import { ROUTE_PATHS } from '../routePaths';
import { RouteModuleExport } from './auth.routes';

const adminRoutes: RouteModuleExport = {
  group: 'admin',
  order: 4,
  routes: [
    {
      path: ROUTE_PATHS.ADMIN,
      element: (
        <ProtectedRoute
          requiredAnyOf={[
            'SYSTEM_STATS_VIEW', 'USER_VIEW', 'ROLE_VIEW', 'PERMISSION_VIEW',
            'UNIT_VIEW', 'DOCTYPE_VIEW', 'SECLEVEL_VIEW', 'RANK_VIEW',
            'POSITION_VIEW', 'AUDIT_VIEW', 'SESSION_VIEW',
          ]}
        >
          <AdminDashboardPage />
        </ProtectedRoute>
      ),
    },
    {
      path: ROUTE_PATHS.USERS,
      element: (
        <ProtectedRoute requiredPermission="USER_VIEW">
          <UsersPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/admin/trash',                          // ⭐ MỚI
      element: (
        <ProtectedRoute requiredPermission="DOC_TRASH_VIEW">
          <TrashPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/admin/sessions',                       // ⭐ MỚI
      element: (
        <ProtectedRoute requiredPermission="SESSION_VIEW">
          <SessionsPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/admin-dashboard.html',
      element: <Navigate to={ROUTE_PATHS.ADMIN} replace />,
    },
    {
      path: '/qk7_datahub_admin_dashboard.html',
      element: <Navigate to={ROUTE_PATHS.ADMIN} replace />,
    },
  ],
};

export default adminRoutes;