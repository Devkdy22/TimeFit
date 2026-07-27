const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function readDevFlag(value: string | undefined): boolean {
  return !IS_PRODUCTION && value === 'true';
}

export function resolveProductionSafeFlag(value: string | undefined, defaultValue: boolean): boolean {
  return value === undefined ? defaultValue : value === 'true';
}

export function resolveRiveRuntimeEnabled(enabled: string | undefined, assetReady: string | undefined): boolean {
  return enabled === 'true' && assetReady === 'true';
}

export const TIMEY_FEATURES = {
  // Rive remains opt-in and asset-gated at runtime, but must be explicitly
  // switchable in production once a validated .riv handoff is available.
  enableRive: resolveProductionSafeFlag(process.env.EXPO_PUBLIC_ENABLE_RIVE, false),
  enableLiveRive: resolveProductionSafeFlag(process.env.EXPO_PUBLIC_ENABLE_LIVE_RIVE, false),
  // The validated 2.5D assets are bundled in the app and are safe for release.
  // Keep an explicit false switch for low-end devices or staged rollouts.
  enableSoft3D: resolveProductionSafeFlag(process.env.EXPO_PUBLIC_ENABLE_SOFT_3D, true),
  enableDemoMocks: readDevFlag(process.env.EXPO_PUBLIC_ENABLE_DEMO_MOCKS),
} as const;
