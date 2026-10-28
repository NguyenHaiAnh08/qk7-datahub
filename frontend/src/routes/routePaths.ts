/**
 * Single source of truth for all route paths in the application
 */
export const ROUTE_PATHS = {
  INDEX: '/',
  LOGIN: '/login',
  PORTAL: '/portal',
  MY_UNIT: '/my-unit',
  DESK: '/document-desk',
  ADMIN: '/admin-dashboard',
  USERS: '/users',
  MY_APPROVALS: '/my-approvals',
  ADMIN_TRASH: '/admin/trash',
  ADMIN_SESSIONS: '/admin/sessions',
  ERROR_400: '/400',
  ERROR_401: '/401',
  ERROR_403: '/403',
  ERROR_404: '/404',
  ERROR_500: '/500',
  ERROR_502: '/502',
  ERROR_503: '/503',
  ERROR_DYNAMIC: '/error/:code',
  NOT_FOUND: '*',
} as const;

export type RoutePathKey = keyof typeof ROUTE_PATHS;
export type RoutePathValue = typeof ROUTE_PATHS[RoutePathKey];

