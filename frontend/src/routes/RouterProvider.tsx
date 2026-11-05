import React, { useMemo, Suspense } from 'react';
import { useRoutes } from 'react-router-dom';
import { getAppRoutes } from './getAppRoutes';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

/**
 * Router component using React Router's useRoutes hook
 * with dynamically discovered routes wrapped in Suspense for lazy-loaded pages.
 */
export const RouterProvider: React.FC = () => {
  const routes = useMemo(() => getAppRoutes(), []);
  const elements = useRoutes(routes);

  return (
    <Suspense fallback={<LoadingSpinner fullScreen tip="Đang nạp phân hệ dữ liệu..." />}>
      {elements}
    </Suspense>
  );
};
