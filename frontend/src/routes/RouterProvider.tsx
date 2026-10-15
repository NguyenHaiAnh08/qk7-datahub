import React, { useMemo } from 'react';
import { useRoutes } from 'react-router-dom';
import { getAppRoutes } from './getAppRoutes';

/**
 * Router component using React Router's useRoutes hook
 * with dynamically discovered routes.
 */
export const RouterProvider: React.FC = () => {
  const routes = useMemo(() => getAppRoutes(), []);
  return useRoutes(routes);
};
