import React from 'react';
import { Navigate, RouteObject } from 'react-router-dom';
import { AdminDashboardPage } from '../../pages/AdminDashboardPage';
import { UsersPage } from '../../pages/UsersPage';
import { ROUTE_PATHS } from '../routePaths';
import { RouteModuleExport } from './auth.routes';

const adminRoutes: RouteModuleExport = {
  group: 'admin',
  order: 4,
  routes: [
    {
      path: ROUTE_PATHS.ADMIN,
      element: <AdminDashboardPage />,
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
      element: <UsersPage />,
    },
  ],
};

export default adminRoutes;
