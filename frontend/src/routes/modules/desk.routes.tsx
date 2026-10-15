import React from 'react';
import { Navigate } from 'react-router-dom';
import { DocumentDeskPage } from '../../pages/DocumentDeskPage';
import { ProtectedRoute } from '../../components/common/ProtectedRoute';
import { ROUTE_PATHS } from '../routePaths';
import { RouteModuleExport } from './auth.routes';

const deskRoutes: RouteModuleExport = {
  group: 'desk',
  order: 3,
  routes: [
    {
      path: ROUTE_PATHS.DESK,
      element: (
        <ProtectedRoute staffOnly>
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
