import { APP_ROUTES } from '../../../src/constants/routes';
import { DeprecatedRouteRedirect } from '../../../src/navigation/deprecatedRouteRedirect';

export default function BeforeDepartureTransitPopupPage() {
  return <DeprecatedRouteRedirect to={APP_ROUTES.transitMain} />;
}
