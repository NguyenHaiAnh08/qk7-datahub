import React from 'react';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
import { ProtectedRoute } from '../../components/common/ProtectedRoute';
import { ROUTE_PATHS } from '../routePaths';
import { RouteModuleExport } from './auth.routes';

const MyApprovalsPage = lazyWithRetry(() => import('../../pages/MyApprovalsPage').then((m) => ({ default: m.MyApprovalsPage })));

const myApprovalsRoutes: RouteModuleExport = {
  group: 'my-approvals',
  order: 35,
  routes: [
    {
      path: ROUTE_PATHS.MY_APPROVALS,
      element: (
        <ProtectedRoute>
          <MyApprovalsPage />
        </ProtectedRoute>
      ),
    },
  ],
};

export default myApprovalsRoutes;
