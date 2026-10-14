import React from 'react';
import { Navigate, RouteObject } from 'react-router-dom';
import { DocumentDeskPage } from '../../pages/DocumentDeskPage';
import { ROUTE_PATHS } from '../routePaths';
import { RouteModuleExport } from './auth.routes';

const deskRoutes: RouteModuleExport = {
  group: 'desk',
  order: 3,
  routes: [
    {
      path: ROUTE_PATHS.DESK,
      element: <DocumentDeskPage />,
    },
    {
      path: '/document-desk.html',
      element: <Navigate to={ROUTE_PATHS.DESK} replace />,
    },
  ],
};

export default deskRoutes;
