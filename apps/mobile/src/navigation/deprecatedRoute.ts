import type { AppRoutePath } from '../constants/routes';

export function buildDeprecatedRedirectHref(
  pathname: AppRoutePath,
  params: Record<string, string | string[] | undefined>,
) {
  const preserved = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  ) as Record<string, string | string[]>;

  return {
    pathname,
    params: preserved,
  };
}
