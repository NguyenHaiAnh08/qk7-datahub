import { systemService } from './systemService';
import { roleService } from './roleService';
import { permissionService } from './permissionService';
import { unitService } from './unitService';
import { documentTypeService } from './documentTypeService';
import { securityLevelService } from './securityLevelService';
import { logService } from './logService';

/**
 * Dashboard API (Aggregator Service)
 * Kết hợp các domain service độc lập để phục vụ trang Admin Dashboard và giữ tương thích ngược.
 */
export const dashboardApi = {
  // System
  getStats: systemService.getStats,
  getHealth: systemService.getHealth,
  getMeta: systemService.getMeta,

  // Logs
  getAccessLogs: logService.getAccessLogs,

  // Roles
  getRoles: roleService.getRoles,
  createRole: roleService.createRole,
  updateRole: roleService.updateRole,
  deleteRole: roleService.deleteRole,

  // Permissions
  getPermissions: permissionService.getPermissions,
  deletePermission: permissionService.deletePermission,

  // Units
  getUnits: unitService.getUnits,
  createUnit: unitService.createUnit,
  updateUnit: unitService.updateUnit,
  deleteUnit: unitService.deleteUnit,

  // Document Types
  getDocumentTypes: documentTypeService.getDocumentTypes,
  createDocumentType: documentTypeService.createDocumentType,
  updateDocumentType: documentTypeService.updateDocumentType,
  deleteDocumentType: documentTypeService.deleteDocumentType,

  // Security Levels
  getSecurityLevels: securityLevelService.getSecurityLevels,
  createSecurityLevel: securityLevelService.createSecurityLevel,
  updateSecurityLevel: securityLevelService.updateSecurityLevel,
  deleteSecurityLevel: securityLevelService.deleteSecurityLevel,
};

export default dashboardApi;
