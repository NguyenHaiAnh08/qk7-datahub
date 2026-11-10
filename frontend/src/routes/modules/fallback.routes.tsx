import React from 'react';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
import { ROUTE_PATHS } from '../routePaths';
import { RouteModuleExport } from './auth.routes';

const HttpErrorPage = lazyWithRetry(() => import('../../pages/HttpErrorPage').then((m) => ({ default: m.HttpErrorPage })));

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
