import React from 'react';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
import { Navigate } from 'react-router-dom';
import { ROUTE_PATHS } from '../routePaths';
import { RouteModuleExport } from './auth.routes';
import { useAuth } from '../../hooks/useAuth';
import { getDestinationByRole } from '../../contexts/AuthContext';

const PortalPage = lazyWithRetry(() => import('../../pages/PortalPage').then((m) => ({ default: m.PortalPage })));

const RootIndexRoute: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  if (isAuthenticated && user && user.user_id !== 'GUEST') {
    const dest = getDestinationByRole(user);
    if (dest !== ROUTE_PATHS.INDEX) {
      return <Navigate to={dest} replace />;
    }
  }
  return <Navigate to={ROUTE_PATHS.LOGIN} replace />;
};

const portalRoutes: RouteModuleExport = {
  group: 'portal',
  order: 2,
  routes: [
    {
      path: ROUTE_PATHS.INDEX,
      element: <RootIndexRoute />,
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
      element: <Navigate to={ROUTE_PATHS.LOGIN} replace />,
    },
  ],
};

export default portalRoutes;
