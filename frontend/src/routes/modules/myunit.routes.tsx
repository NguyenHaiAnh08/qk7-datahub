import React from 'react';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
import { RouteObject } from 'react-router-dom';
import { ROUTE_PATHS } from '../routePaths';
import { ProtectedRoute } from '../../components/common/ProtectedRoute';

const MyUnitPage = lazyWithRetry(() => import('../../pages/MyUnitPage').then((m) => ({ default: m.MyUnitPage })));

export interface RouteModuleExport {
  order: number;
  routes: RouteObject[];
}

const myUnitRoutes: RouteModuleExport = {
  order: 2.5,
  routes: [
    {
      path: ROUTE_PATHS.MY_UNIT,
      element: (
        <ProtectedRoute>
          <MyUnitPage />
        </ProtectedRoute>
      ),
    },
  ],
};

export default myUnitRoutes;
