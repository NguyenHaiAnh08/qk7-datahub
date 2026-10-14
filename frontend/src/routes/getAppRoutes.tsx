import { RouteObject } from 'react-router-dom';
import { RouteModuleExport } from './modules/auth.routes';

interface GlobModule {
  default: RouteModuleExport;
}

/**
 * Auto-discovers all route modules in src/routes/modules/*.routes.tsx
 * using Vite's import.meta.glob, sorts them by `order`, and flattens into RouteObject[]
 */
export function getAppRoutes(): RouteObject[] {
  const modules = import.meta.glob<GlobModule>(
    './modules/*.routes.tsx',
    { eager: true }
  );

  const moduleList = Object.values(modules) as GlobModule[];

  const sortedModules = moduleList.sort(
    (a, b) => (a.default?.order || 0) - (b.default?.order || 0)
  );

  const allRoutes: RouteObject[] = [];
  for (const mod of sortedModules) {
    if (mod.default?.routes && Array.isArray(mod.default.routes)) {
      allRoutes.push(...mod.default.routes);
    }
  }

  return allRoutes;
}
