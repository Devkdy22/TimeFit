import { resolveExpoProjectId } from './notificationProject';

describe('resolveExpoProjectId', () => {
  it('prefers the Expo config project ID', () => {
    expect(resolveExpoProjectId({
      expoConfig: { extra: { eas: { projectId: 'expo-project' } } },
      easConfig: { projectId: 'legacy-project' },
    })).toBe('expo-project');
  });

  it('falls back to the legacy EAS config', () => {
    expect(resolveExpoProjectId({ easConfig: { projectId: 'legacy-project' } })).toBe('legacy-project');
  });

  it('returns null when no project ID is configured', () => {
    expect(resolveExpoProjectId({})).toBeNull();
  });
});
