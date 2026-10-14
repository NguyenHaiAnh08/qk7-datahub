import React from 'react';
import { Navigate, RouteObject } from 'react-router-dom';
import { LoginPage } from '../../pages/LoginPage';
import { ROUTE_PATHS } from '../routePaths';

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
