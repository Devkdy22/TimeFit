import { Redirect } from 'expo-router';
import { APP_ROUTES } from '../../src/constants/routes';

export default function SettingsPage() {
  return <Redirect href={APP_ROUTES.reengagementSettings} />;
}
