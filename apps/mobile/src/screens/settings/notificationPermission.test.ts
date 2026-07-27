import { canPersistNotificationEnabled, resolveNotificationToggleValue } from './notificationPermission';

describe('notification permission settings contract', () => {
  it('does not persist enabled when OS permission is not granted', () => {
    expect(canPersistNotificationEnabled(true, 'denied')).toBe(false);
    expect(canPersistNotificationEnabled(true, 'undetermined')).toBe(false);
    expect(canPersistNotificationEnabled(true, 'granted')).toBe(true);
  });

  it('always allows disabling and reflects denied permission as disabled', () => {
    expect(canPersistNotificationEnabled(false, 'denied')).toBe(true);
    expect(resolveNotificationToggleValue(true, 'denied')).toBe(false);
    expect(resolveNotificationToggleValue(true, 'granted')).toBe(true);
  });
});
