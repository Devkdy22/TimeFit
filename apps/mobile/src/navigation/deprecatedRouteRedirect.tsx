import { Redirect, useLocalSearchParams } from 'expo-router';
import type { AppRoutePath } from '../constants/routes';
import { buildDeprecatedRedirectHref } from './deprecatedRoute';

export function DeprecatedRouteRedirect({ to }: { to: AppRoutePath }) {
  const params = useLocalSearchParams();
  return <Redirect href={buildDeprecatedRedirectHref(to, params) as never} />;
}
