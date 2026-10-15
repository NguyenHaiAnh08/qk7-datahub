import { authService } from './authService';
import { documentService } from './documentService';
import { userService } from './userService';
import { roleService } from './roleService';
import { permissionService } from './permissionService';
import { unitService } from './unitService';
import { documentTypeService } from './documentTypeService';
import { securityLevelService } from './securityLevelService';
import { logService } from './logService';
import { systemService } from './systemService';

/**
 * Unified API Client (Legacy / Aggregate Facade)
 */
export const api = {
  ...authService,
  ...documentService,
  ...userService,
  ...roleService,
  ...permissionService,
  ...unitService,
  ...documentTypeService,
  ...securityLevelService,
  ...logService,
  ...systemService,
};

export default api;
