import React from 'react';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
import { RouteObject, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../../components/common/ProtectedRoute';
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
      element: (
        <ProtectedRoute requiredPermission="LECTURE_VIEW">
          <LecturesPage />
        </ProtectedRoute>
      ),
    },
    {
      path: ROUTE_PATHS.MATERIALS,
      element: <MaterialsPage />,
    },
    {
      path: ROUTE_PATHS.LIBRARY,
      element: <LibraryPage />,
    },

    {
      path: '/du-lieu-so',
      element: <Navigate to={ROUTE_PATHS.PORTAL} replace />,
    },
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
