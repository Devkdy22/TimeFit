import { Redirect } from 'expo-router';
import { APP_ROUTES } from '../../src/constants/routes';

export default function RoutinePage() {
  return <Redirect href={APP_ROUTES.reengagementRoutines} />;
}
