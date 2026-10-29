import React from 'react';
import { RouteObject, Navigate } from 'react-router-dom';
import { ROUTE_PATHS } from '../routePaths';
import { LecturesPage } from '../../pages/LecturesPage';
import { MaterialsPage } from '../../pages/MaterialsPage';
import { LibraryPage } from '../../pages/LibraryPage';

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

