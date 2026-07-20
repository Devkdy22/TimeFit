import { usePathname, useRouter, type Router } from 'expo-router';
import { APP_ROUTES, type AppRoutePath } from '../constants/routes';

type AppRouter = Pick<Router, 'push' | 'replace' | 'back'>;

function normalizePath(path: string) {
  return path.replace(/\/$/, '') || '/';
}

function isSamePath(currentPathname: string, nextPath: AppRoutePath) {
  return normalizePath(currentPathname) === normalizePath(nextPath);
}

export function createNavigationHelper(router: AppRouter, currentPathname = '') {
  const pushUnique = (path: AppRoutePath) => {
    if (isSamePath(currentPathname, path)) {
      return;
    }
    router.push(path);
  };

  const replaceUnique = (path: AppRoutePath) => {
    if (isSamePath(currentPathname, path)) {
      return;
    }
    router.replace(path);
  };

  return {
    goBack: () => router.back(),
    goToHome: () => pushUnique(APP_ROUTES.beforeStartHome),
    goToSearch: () => pushUnique(APP_ROUTES.beforeStartSearch),
    goToRecommendation: () => pushUnique(APP_ROUTES.beforeDepartureRecommendation),
    goToRecommendationDetail: () => pushUnique(APP_ROUTES.beforeDepartureDetail),
    goToBeforeDepartureTransitPopup: () => replaceUnique(APP_ROUTES.transitMain),
    goToTransit: () => replaceUnique(APP_ROUTES.transitMain),
    goToArrival: () => replaceUnique(APP_ROUTES.transitArrival),
    goToRoutines: () => pushUnique(APP_ROUTES.reengagementRoutines),
    goToRoutineCreate: () => pushUnique(APP_ROUTES.reengagementRoutineCreate),
    goToLogin: () => pushUnique(APP_ROUTES.reengagementLogin),
    goToSettings: () => pushUnique(APP_ROUTES.reengagementSettings),
    goToOnboarding: () => pushUnique(APP_ROUTES.beforeStartOnboarding),
    goToDepartureNotificationSettings: () => pushUnique(APP_ROUTES.settingsDepartureNotification),
    goToRoutineNotificationSettings: () => pushUnique(APP_ROUTES.settingsRoutineNotification),
    goToEmergencyNotificationSettings: () => pushUnique(APP_ROUTES.settingsEmergencyNotification),
    goToThemeSettings: () => pushUnique(APP_ROUTES.settingsTheme),
    goToSettingsAccount: () => pushUnique(APP_ROUTES.settingsAccount),
    goToLanguageSettings: () => pushUnique(APP_ROUTES.settingsLanguage),
    goToUnitSettings: () => pushUnique(APP_ROUTES.settingsUnit),
    goToTimeFormatSettings: () => pushUnique(APP_ROUTES.settingsTimeFormat),
    goToTermsSettings: () => pushUnique(APP_ROUTES.settingsTerms),
    goToPrivacySettings: () => pushUnique(APP_ROUTES.settingsPrivacy),
    goToHelpSettings: () => pushUnique(APP_ROUTES.settingsHelp),
    goToAboutSettings: () => pushUnique(APP_ROUTES.settingsAbout),
    replaceToHome: () => replaceUnique(APP_ROUTES.beforeStartHome),
    replaceToSearch: () => replaceUnique(APP_ROUTES.beforeStartSearch),
    replaceToRoutineCreate: () => replaceUnique(APP_ROUTES.reengagementRoutineCreate),
  };
}

export function useNavigationHelper() {
  const router = useRouter();
  const pathname = usePathname();
  return createNavigationHelper(router, pathname);
}
