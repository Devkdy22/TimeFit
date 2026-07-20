import { APP_ROUTES } from '../../../src/constants/routes';
import { DeprecatedRouteRedirect } from '../../../src/navigation/deprecatedRouteRedirect';

export default function ReengageRoutineCreatePage() {
  return <DeprecatedRouteRedirect to={APP_ROUTES.reengagementRoutineCreate} />;
}
