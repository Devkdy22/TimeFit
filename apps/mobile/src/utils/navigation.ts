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
    goToRoutineCreate: () => router.push(APP_ROUTES.reengagementRoutineCreate),
    goToLogin: () => router.push(APP_ROUTES.reengagementLogin),
    goToSettings: () => router.push(APP_ROUTES.reengagementSettings),
    goToOnboarding: () => router.push(APP_ROUTES.beforeStartOnboarding),
    goToDepartureNotificationSettings: () => router.push(APP_ROUTES.settingsDepartureNotification),
    goToRoutineNotificationSettings: () => router.push(APP_ROUTES.settingsRoutineNotification),
    goToEmergencyNotificationSettings: () => router.push(APP_ROUTES.settingsEmergencyNotification),
    goToThemeSettings: () => router.push(APP_ROUTES.settingsTheme),
    goToSettingsAccount: () => router.push(APP_ROUTES.settingsAccount),
    goToLanguageSettings: () => router.push(APP_ROUTES.settingsLanguage),
    goToUnitSettings: () => router.push(APP_ROUTES.settingsUnit),
    goToTimeFormatSettings: () => router.push(APP_ROUTES.settingsTimeFormat),
    goToTermsSettings: () => router.push(APP_ROUTES.settingsTerms),
    goToPrivacySettings: () => router.push(APP_ROUTES.settingsPrivacy),
    goToHelpSettings: () => router.push(APP_ROUTES.settingsHelp),
    goToAboutSettings: () => router.push(APP_ROUTES.settingsAbout),
    replaceToHome: () => router.replace(APP_ROUTES.beforeStartHome),
  };
}

export function useNavigationHelper() {
  const router = useRouter();
  return createNavigationHelper(router);
}
