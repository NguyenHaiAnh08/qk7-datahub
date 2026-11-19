import React from 'react';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
import { RouteObject, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../../components/common/ProtectedRoute';
import { ROUTE_PATHS } from '../routePaths';

const LecturesPage = lazyWithRetry(() => import('../../pages/LecturesPage').then((m) => ({ default: m.LecturesPage })));
const ClassroomsPage = lazyWithRetry(() => import('../../pages/ClassroomsPage').then((m) => ({ default: m.ClassroomsPage })));
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
          <LecturesPage key="list" mode="list" />
        </ProtectedRoute>
      ),
    },
    {
      // Soạn & duyệt bài giảng: chỉ người có quyền soạn, duyệt hoặc xóa bài giảng
      path: ROUTE_PATHS.LECTURES_COMPOSE,
      element: (
        <ProtectedRoute requiredAnyOf={['LECTURE_CREATE', 'LECTURE_APPROVE', 'LECTURE_DELETE']}>
          <LecturesPage key="compose" mode="compose" />
        </ProtectedRoute>
      ),
    },
    {
      path: ROUTE_PATHS.LECTURES_HISTORY,
      element: (
        <ProtectedRoute requiredPermission="LECTURE_VIEW">
          <LecturesPage key="history" mode="history" />
        </ProtectedRoute>
      ),
    },
    {
      path: ROUTE_PATHS.CLASSROOMS,
      element: (
        <ProtectedRoute requiredPermission="COMMAND_VIEW">
          <ClassroomsPage />
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
      path: '/giang-duong',
      element: <Navigate to={ROUTE_PATHS.CLASSROOMS} replace />,
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
