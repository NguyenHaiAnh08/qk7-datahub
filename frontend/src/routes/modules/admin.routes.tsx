import React from 'react';
import { Navigate } from 'react-router-dom';
import { AdminDashboardPage } from '../../pages/AdminDashboardPage';
import { UsersPage } from '../../pages/UsersPage';
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
        <ProtectedRoute adminOnly>
          <AdminDashboardPage />
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
    {
      path: ROUTE_PATHS.USERS,
      element: (
        <ProtectedRoute adminOnly>
          <UsersPage />
        </ProtectedRoute>
      ),
    },
  ],
};

export default adminRoutes;
