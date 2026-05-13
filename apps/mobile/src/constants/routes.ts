export const APP_ROUTES = {
  // Primary user-flow routes
  beforeStartOnboarding: '/before-start/onboarding',
  beforeStartHome: '/before-start/home',
  beforeStartSearch: '/before-start/search',
  beforeDepartureRecommendation: '/before-departure/recommendation',
  beforeDepartureDetail: '/before-departure/detail',
  beforeDepartureTransitPopup: '/before-departure/transit',
  transitMain: '/transit/main',
  transitArrival: '/transit/arrival',
  reengagementRoutines: '/re-engagement/routines',
  reengagementLogin: '/re-engagement/login',
  reengagementSettings: '/re-engagement/settings',

  // Legacy routes kept for gradual migration/bridge
  onboarding: '/onboarding',
  home: '/(tabs)/home',
  routine: '/(tabs)/routine',
  settings: '/(tabs)/settings',
  search: '/search',
  routeRecommend: '/route/recommend',
  routeDetail: '/route/detail',
  moving: '/moving',
  testMap: '/test-map',
} as const;

export type AppRoutePath = (typeof APP_ROUTES)[keyof typeof APP_ROUTES];
