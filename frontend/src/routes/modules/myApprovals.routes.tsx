import { RouteObject } from 'react-router-dom';
import { MyApprovalsPage } from '../../pages/MyApprovalsPage';
import { ProtectedRoute } from '../../components/common/ProtectedRoute';
import { ROUTE_PATHS } from '../routePaths';
import { RouteModuleExport } from './auth.routes';

const myApprovalsRoutes: RouteModuleExport = {
  group: 'my-approvals',
  order: 35,
  routes: [
    {
      path: ROUTE_PATHS.MY_APPROVALS,
      element: (
        <ProtectedRoute>
          <MyApprovalsPage />
        </ProtectedRoute>
      ),
    },
  ],
};

export default myApprovalsRoutes;