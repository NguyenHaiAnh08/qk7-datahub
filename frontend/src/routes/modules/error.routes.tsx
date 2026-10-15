import React from 'react';
import { Navigate } from 'react-router-dom';
import { HttpErrorPage } from '../../pages/HttpErrorPage';
import { ROUTE_PATHS } from '../routePaths';
import { RouteModuleExport } from './auth.routes';

const errorRoutes: RouteModuleExport = {
  group: 'error',
  order: 90,
  routes: [
    {
      path: ROUTE_PATHS.ERROR_400,
      element: <HttpErrorPage code={400} />,
    },
    {
      path: ROUTE_PATHS.ERROR_401,
      element: <HttpErrorPage code={401} />,
    },
    {
      path: ROUTE_PATHS.ERROR_403,
      element: <HttpErrorPage code={403} />,
    },
    {
      path: '/403.html',
      element: <Navigate to={ROUTE_PATHS.ERROR_403} replace />,
    },
    {
      path: ROUTE_PATHS.ERROR_404,
      element: <HttpErrorPage code={404} />,
    },
    {
      path: '/404.html',
      element: <Navigate to={ROUTE_PATHS.ERROR_404} replace />,
    },
    {
      path: ROUTE_PATHS.ERROR_500,
      element: <HttpErrorPage code={500} />,
    },
    {
      path: '/500.html',
      element: <Navigate to={ROUTE_PATHS.ERROR_500} replace />,
    },
    {
      path: ROUTE_PATHS.ERROR_502,
      element: <HttpErrorPage code={502} />,
    },
    {
      path: ROUTE_PATHS.ERROR_503,
      element: <HttpErrorPage code={503} />,
    },
    {
      path: ROUTE_PATHS.ERROR_DYNAMIC,
      element: <HttpErrorPage />,
    },
  ],
};

export default errorRoutes;
