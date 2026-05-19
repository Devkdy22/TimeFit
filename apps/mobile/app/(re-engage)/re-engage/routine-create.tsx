import { Redirect } from 'expo-router';
import { APP_ROUTES } from '../../../src/constants/routes';

export default function ReengageRoutineCreatePage() {
  return <Redirect href={APP_ROUTES.reengagementRoutineCreate} />;
}
