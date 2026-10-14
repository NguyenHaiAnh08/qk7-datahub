/**
 * Single source of truth for all route paths in the application
 */
export const ROUTE_PATHS = {
  INDEX: '/',
  LOGIN: '/login',
  PORTAL: '/portal',
  DESK: '/document-desk',
  ADMIN: '/admin-dashboard',
  USERS: '/users',
  NOT_FOUND: '*',
} as const;

export type RoutePathKey = keyof typeof ROUTE_PATHS;
export type RoutePathValue = typeof ROUTE_PATHS[RoutePathKey];
