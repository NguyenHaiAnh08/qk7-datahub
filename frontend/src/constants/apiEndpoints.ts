export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',   
    ME: '/api/auth/me',
  },

  SYSTEM: {
    HEALTH: '/api/health',
    META: '/api/meta',
    TEST_HTTP_ERROR: (code: number) => `/api/test-http-error/${code}`,
  },

  FINGERPRINT: {                              
    AGENTS_ONLINE: '/api/fingerprint/agents-online',
  },

  FILES: {
    VIEW: (fileId: string, download: '0' | '1' | boolean = '0') => {
      const dl = typeof download === 'boolean' ? (download ? '1' : '0') : download;
      return `/api/files/${encodeURIComponent(fileId)}/view?download=${dl}`;
    },
  },

    DOCUMENTS: {
    LIST: '/api/documents',
    DETAIL: (fileId: string) => `/api/documents/${encodeURIComponent(fileId)}`,
    UPLOAD: '/api/documents/upload',
    PARSE: '/api/documents/parse',
    UPDATE: (fileId: string) => `/api/documents/${encodeURIComponent(fileId)}`,
    DELETE: (fileId: string) => `/api/documents/${encodeURIComponent(fileId)}`,
    TRASH: '/api/documents/trash',
    RESTORE: (fileId: string) => `/api/documents/${encodeURIComponent(fileId)}/restore`,
    PURGE: (fileId: string) => `/api/documents/${encodeURIComponent(fileId)}/purge`,
    MY_UNIT: '/api/documents/my-unit',                                      // ← NEW (F5)
    VIEW: (fileId: string, download: '0' | '1' | boolean = '0') => {
      const dl = typeof download === 'boolean' ? (download ? '1' : '0') : download;
      return `/api/files/${encodeURIComponent(fileId)}/view?download=${dl}`;
    },
  },

  LOGS: {
    LIST: '/api/access-logs',
  },

  ADMIN: {
    STATS: '/api/admin/stats',
    USERS: '/api/admin/users',
    USER_DETAIL: (userId: string) => `/api/admin/users/${encodeURIComponent(userId)}`,
    USER_CREDENTIALS: (userId: string) => `/api/admin/users/${encodeURIComponent(userId)}/credentials`,
    USER_UNLOCK: (userId: string) => `/api/admin/users/${encodeURIComponent(userId)}/unlock`,
    USER_ROLES: (userId: string) => `/api/admin/users/${encodeURIComponent(userId)}/roles`,
    USER_ROLE_DETAIL: (userId: string, roleId: string) => `/api/admin/users/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`,
    USER_PRIMARY_ROLE: (userId: string) => `/api/admin/users/${encodeURIComponent(userId)}/primary-role`,   
    USER_PERMISSIONS: (userId: string) => `/api/admin/users/${encodeURIComponent(userId)}/permissions`,     
    USER_PERMISSION_DETAIL: (userId: string, permId: string) => `/api/admin/users/${encodeURIComponent(userId)}/permissions/${encodeURIComponent(permId)}`,  
    ROLES: '/api/admin/roles',
    ROLE_DETAIL: (roleId: string) => `/api/admin/roles/${encodeURIComponent(roleId)}`,
    ROLE_PERMISSIONS: (roleId: string) => `/api/admin/roles/${encodeURIComponent(roleId)}/permissions`,     
    ROLE_PERMISSION_DETAIL: (roleId: string, permId: string) => `/api/admin/roles/${encodeURIComponent(roleId)}/permissions/${encodeURIComponent(permId)}`,  
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
    UNIT_ALIASES: '/api/admin/unit-aliases',
    UNIT_ALIAS_DETAIL: (aliasId: number) => `/api/admin/unit-aliases/${aliasId}`,
    IP_BLOCKLIST: '/api/admin/ip-blocklist',
    IP_BLOCK_DETAIL: (ip: string) => `/api/admin/ip-blocklist/${encodeURIComponent(ip)}`,
    LOGIN_ATTEMPTS: '/api/admin/login-attempts',
    SESSIONS: '/api/admin/sessions',                                     
    SESSION_DETAIL: (sessionId: string) => `/api/admin/sessions/${encodeURIComponent(sessionId)}`,  
    USER_SESSIONS: (userId: string) => `/api/admin/sessions/user/${encodeURIComponent(userId)}`,    
    SYSTEM_CONFIG: '/api/admin/system-config',
  },
} as const;