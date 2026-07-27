export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

export function canPersistNotificationEnabled(
  enabled: boolean,
  permissionStatus: NotificationPermissionStatus,
): boolean {
  return !enabled || permissionStatus === 'granted';
}

export function resolveNotificationToggleValue(
  serverEnabled: boolean,
  permissionStatus: NotificationPermissionStatus,
): boolean {
  return serverEnabled && permissionStatus !== 'denied';
}
