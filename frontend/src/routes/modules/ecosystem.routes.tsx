import React from 'react';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
import { RouteObject, Navigate } from 'react-router-dom';
import { ROUTE_PATHS } from '../routePaths';

const LecturesPage = lazyWithRetry(() => import('../../pages/LecturesPage').then((m) => ({ default: m.LecturesPage })));
const MaterialsPage = lazyWithRetry(() => import('../../pages/MaterialsPage').then((m) => ({ default: m.MaterialsPage })));
const LibraryPage = lazyWithRetry(() => import('../../pages/LibraryPage').then((m) => ({ default: m.LibraryPage })));

export interface RouteModuleExport {
  group?: string;
  order: number;
  routes: RouteObject[];
}

const ecosystemRoutes: RouteModuleExport = {
  group: 'ecosystem',
  order: 2.8,
  routes: [
    {
      path: ROUTE_PATHS.LECTURES,
      element: <LecturesPage />,
    },
    {
      path: ROUTE_PATHS.MATERIALS,
      element: <MaterialsPage />,
    },
    {
      path: ROUTE_PATHS.LIBRARY,
      element: <LibraryPage />,
    },
    // Vietnamese URL slug aliases
    {
      path: '/bai-giang-so',
      element: <Navigate to={ROUTE_PATHS.LECTURES} replace />,
    },
    {
      path: '/hoc-lieu-so',
      element: <Navigate to={ROUTE_PATHS.MATERIALS} replace />,
    },
    {
      path: '/thu-vien-so',
      element: <Navigate to={ROUTE_PATHS.LIBRARY} replace />,
    },
  ],
};

export default ecosystemRoutes;
