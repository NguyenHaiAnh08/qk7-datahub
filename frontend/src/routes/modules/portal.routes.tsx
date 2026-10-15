import React from 'react';
import { Navigate, RouteObject } from 'react-router-dom';
import { PortalPage } from '../../pages/PortalPage';
import { ROUTE_PATHS } from '../routePaths';
import { RouteModuleExport } from './auth.routes';

const portalRoutes: RouteModuleExport = {
  group: 'portal',
  order: 2,
  routes: [
    {
      path: ROUTE_PATHS.INDEX,
      element: <PortalPage />,
    },
    {
      path: ROUTE_PATHS.PORTAL,
      element: <PortalPage />,
    },
    {
      path: '/portal.html',
      element: <Navigate to={ROUTE_PATHS.PORTAL} replace />,
    },
    {
      path: '/qk7_datahub_portal.html',
      element: <Navigate to={ROUTE_PATHS.PORTAL} replace />,
    },
    {
      path: '/index.html',
      element: <Navigate to={ROUTE_PATHS.PORTAL} replace />,
    },
  ],
};

export default portalRoutes;
