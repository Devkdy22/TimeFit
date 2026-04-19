import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { APP_ROUTES, type AppRoutePath } from '../src/constants/routes';
import { getIsOnboardingCompleted } from '../src/features/onboarding/storage';

export default function IndexPage() {
  const [initialRoute, setInitialRoute] = useState<AppRoutePath | null>(null);

  useEffect(() => {
    let alive = true;

    async function decideInitialRoute() {
      try {
        const completed = await getIsOnboardingCompleted();
        if (!alive) {
          return;
        }
        setInitialRoute(completed ? APP_ROUTES.beforeStartHome : APP_ROUTES.beforeStartOnboarding);
      } catch {
        if (!alive) {
          return;
        }
        setInitialRoute(APP_ROUTES.beforeStartOnboarding);
      }
    }

    void decideInitialRoute();

    return () => {
      alive = false;
    };
  }, []);

  if (!initialRoute) {
    return null;
  }

  return <Redirect href={initialRoute} />;
}
