import { Redirect } from 'expo-router';
import { APP_ROUTES } from '../src/constants/routes';

export default function SearchPage() {
  return <Redirect href={APP_ROUTES.beforeStartSearch} />;
}
