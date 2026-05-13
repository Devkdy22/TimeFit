import { useRouter, type Router } from 'expo-router';
import { APP_ROUTES } from '../constants/routes';

type AppRouter = Pick<Router, 'push' | 'replace' | 'back'>;

export function createNavigationHelper(router: AppRouter) {
  return {
    goBack: () => router.back(),
    goToHome: () => router.push(APP_ROUTES.beforeStartHome),
    goToSearch: () => router.push(APP_ROUTES.beforeStartSearch),
    goToRecommendation: () => router.push(APP_ROUTES.beforeDepartureRecommendation),
    goToRecommendationDetail: () => router.push(APP_ROUTES.beforeDepartureDetail),
    goToBeforeDepartureTransitPopup: () => router.push(APP_ROUTES.beforeDepartureTransitPopup),
    goToTransit: () => router.push(APP_ROUTES.transitMain),
    goToArrival: () => router.push(APP_ROUTES.transitArrival),
    goToRoutines: () => router.push(APP_ROUTES.reengagementRoutines),
    goToLogin: () => router.push(APP_ROUTES.reengagementLogin),
    goToSettings: () => router.push(APP_ROUTES.reengagementSettings),
    goToOnboarding: () => router.push(APP_ROUTES.beforeStartOnboarding),
    replaceToHome: () => router.replace(APP_ROUTES.beforeStartHome),
  };
}

export function useNavigationHelper() {
  const router = useRouter();
  return createNavigationHelper(router);
}
