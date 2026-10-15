import React from 'react';
import { RouteObject } from 'react-router-dom';
import { HttpErrorPage } from '../../pages/HttpErrorPage';
import { ROUTE_PATHS } from '../routePaths';
import { RouteModuleExport } from './auth.routes';

const fallbackRoutes: RouteModuleExport = {
  group: 'fallback',
  order: 999,
  routes: [
    {
      path: ROUTE_PATHS.NOT_FOUND,
      element: <HttpErrorPage code={404} />,
    },
  ],
};

export default fallbackRoutes;
