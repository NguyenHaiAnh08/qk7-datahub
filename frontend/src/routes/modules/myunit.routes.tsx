import { RouteObject } from 'react-router-dom';
import { ROUTE_PATHS } from '../routePaths';
import { MyUnitPage } from '../../pages/MyUnitPage';
import { ProtectedRoute } from '../../components/common/ProtectedRoute';

export interface RouteModuleExport {
  order: number;
  routes: RouteObject[];
}

const myUnitRoutes: RouteModuleExport = {
  order: 2.5,
  routes: [
    {
      path: ROUTE_PATHS.MY_UNIT,
      element: (
        <ProtectedRoute>
          <MyUnitPage />
        </ProtectedRoute>
      ),
    },
  ],
};

export default myUnitRoutes;