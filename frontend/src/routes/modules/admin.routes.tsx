import React from 'react';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
import { Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../../components/common/ProtectedRoute';
import { ROUTE_PATHS } from '../routePaths';
import { RouteModuleExport } from './auth.routes';

const AdminDashboardPage = lazyWithRetry(() => import('../../pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const UsersPage = lazyWithRetry(() => import('../../pages/UsersPage').then((m) => ({ default: m.UsersPage })));
const TrashPage = lazyWithRetry(() => import('../../pages/TrashPage').then((m) => ({ default: m.TrashPage })));
const SessionsPage = lazyWithRetry(() => import('../../pages/SessionsPage').then((m) => ({ default: m.SessionsPage })));

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
            'POSITION_VIEW', 'AUDIT_VIEW', 'SESSION_VIEW', 'APPROVAL_VALIDATE', 'DOC_TRASH_VIEW',
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
      path: '/admin/trash',
      element: (
        <ProtectedRoute requiredPermission="DOC_TRASH_VIEW">
          <TrashPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/admin/sessions',
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
