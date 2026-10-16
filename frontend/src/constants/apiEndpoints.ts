/**
 * QK7 DATAHUB — Toàn bộ API Endpoints của hệ thống
 * Tuyệt đối không thay đổi contract với backend Express / SQL Server
 */
export const API_ENDPOINTS = {
  // Authentication & Session
  AUTH: {
    LOGIN: '/api/auth/login',
    ME: '/api/auth/me',
  },

  // Health check & System Meta
  SYSTEM: {
    HEALTH: '/api/health',
    META: '/api/meta',
    TEST_HTTP_ERROR: (code: number) => `/api/test-http-error/${code}`,
  },

  // Files (PDF streaming & downloads - Swagger: GET /api/files/{fileId}/view)
  FILES: {
    VIEW: (fileId: string, download: '0' | '1' | boolean = '0') => {
      const dl = typeof download === 'boolean' ? (download ? '1' : '0') : download;
      return `/api/files/${encodeURIComponent(fileId)}/view?download=${dl}`;
    },
  },

  // Documents
  DOCUMENTS: {
    LIST: '/api/documents',
    DETAIL: (fileId: string) => `/api/documents/${encodeURIComponent(fileId)}`,
    UPLOAD: '/api/documents/upload',
    UPDATE: (fileId: string) => `/api/documents/${encodeURIComponent(fileId)}`,
    DELETE: (fileId: string) => `/api/documents/${encodeURIComponent(fileId)}`,
    VIEW: (fileId: string, download: '0' | '1' | boolean = '0') => {
      const dl = typeof download === 'boolean' ? (download ? '1' : '0') : download;
      return `/api/files/${encodeURIComponent(fileId)}/view?download=${dl}`;
    },
  },

  // Access Logs
  LOGS: {
    LIST: '/api/access-logs',
  },

  // Admin Management
  ADMIN: {
    STATS: '/api/admin/stats',
    USERS: '/api/admin/users',
    USER_DETAIL: (userId: string) => `/api/admin/users/${encodeURIComponent(userId)}`,
    USER_CREDENTIALS: (userId: string) => `/api/admin/users/${encodeURIComponent(userId)}/credentials`,
    ROLES: '/api/admin/roles',
    ROLE_DETAIL: (roleId: string) => `/api/admin/roles/${encodeURIComponent(roleId)}`,
    PERMISSIONS: '/api/admin/permissions',
    PERMISSION_DETAIL: (permId: string) => `/api/admin/permissions/${encodeURIComponent(permId)}`,
    UNITS: '/api/admin/units',
    UNIT_DETAIL: (unitId: string) => `/api/admin/units/${encodeURIComponent(unitId)}`,
    DOCUMENT_TYPES: '/api/admin/document-types',
    DOCUMENT_TYPE_DETAIL: (typeId: string) => `/api/admin/document-types/${encodeURIComponent(typeId)}`,
    SECURITY_LEVELS: '/api/admin/security-levels',
    SECURITY_LEVEL_DETAIL: (levelId: number | string) => `/api/admin/security-levels/${encodeURIComponent(String(levelId))}`,
    RANKS: '/api/admin/ranks',
    RANK_DETAIL: (rankId: string) => `/api/admin/ranks/${encodeURIComponent(rankId)}`,
    POSITIONS: '/api/admin/positions',
    POSITION_DETAIL: (positionId: string) => `/api/admin/positions/${encodeURIComponent(positionId)}`,
  },
} as const;
