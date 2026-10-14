import React from 'react';
import { Navigate, RouteObject } from 'react-router-dom';
import { ROUTE_PATHS } from '../routePaths';
import { RouteModuleExport } from './auth.routes';

const fallbackRoutes: RouteModuleExport = {
  group: 'fallback',
  order: 999,
  routes: [
    {
      path: ROUTE_PATHS.NOT_FOUND,
      element: <Navigate to={ROUTE_PATHS.PORTAL} replace />,
    },
  ],
};

export default fallbackRoutes;
