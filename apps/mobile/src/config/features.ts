const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function readDevFlag(value: string | undefined): boolean {
  return !IS_PRODUCTION && value === 'true';
}

export const TIMEY_FEATURES = {
  enableRive: readDevFlag(process.env.EXPO_PUBLIC_ENABLE_RIVE),
  enableLiveRive: readDevFlag(process.env.EXPO_PUBLIC_ENABLE_LIVE_RIVE),
  enableSoft3D: readDevFlag(process.env.EXPO_PUBLIC_ENABLE_SOFT_3D),
  enableDemoMocks: readDevFlag(process.env.EXPO_PUBLIC_ENABLE_DEMO_MOCKS),
} as const;
