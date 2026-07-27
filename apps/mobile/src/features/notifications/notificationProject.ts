export interface ExpoConstantsLike {
  expoConfig?: {
    extra?: {
      eas?: {
        projectId?: string;
      };
    };
  } | null;
  easConfig?: {
    projectId?: string;
  } | null;
}

export function resolveExpoProjectId(constants: ExpoConstantsLike): string | null {
  return constants.expoConfig?.extra?.eas?.projectId ?? constants.easConfig?.projectId ?? null;
}
