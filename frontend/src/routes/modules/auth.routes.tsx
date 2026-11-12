import React from 'react';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
import { Navigate, RouteObject } from 'react-router-dom';
import { ROUTE_PATHS } from '../routePaths';

const LoginPage = lazyWithRetry(() => import('../../pages/LoginPage').then(m => ({ default: m.LoginPage })));

export interface RouteModuleExport {
  group: string;
  order: number;
  routes: RouteObject[];
}

const authRoutes: RouteModuleExport = {
  group: 'auth',
  order: 1,
  routes: [
    {
      path: ROUTE_PATHS.LOGIN,
      element: <LoginPage />,
    },
    {
      path: '/login.html',
      element: <Navigate to={ROUTE_PATHS.LOGIN} replace />,
    },
    {
      path: '/qk7_datahub_login_page.html',
      element: <Navigate to={ROUTE_PATHS.LOGIN} replace />,
    },
  ],
};

export default authRoutes;
