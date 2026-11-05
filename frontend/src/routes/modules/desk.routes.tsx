import React from 'react';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
import { Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../../components/common/ProtectedRoute';
import { ROUTE_PATHS } from '../routePaths';
import { RouteModuleExport } from './auth.routes';

const DocumentDeskPage = lazyWithRetry(() => import('../../pages/DocumentDeskPage').then((m) => ({ default: m.DocumentDeskPage })));

const deskRoutes: RouteModuleExport = {
  group: 'desk',
  order: 3,
  routes: [
    {
      path: ROUTE_PATHS.DESK,
      element: (
        <ProtectedRoute
          requiredAnyOf={['DOC_UPLOAD', 'DOC_EDIT', 'DOC_DELETE', 'DOC_PARSE']}
        >
          <DocumentDeskPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/document-desk.html',
      element: <Navigate to={ROUTE_PATHS.DESK} replace />,
    },
  ],
};

export default deskRoutes;
