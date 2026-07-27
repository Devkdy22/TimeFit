import { resolveNotificationNavigationRoute } from './notificationNavigation';

describe('resolveNotificationNavigationRoute', () => {
  it.each(['departure', 'delay', 'reroute', 'route_changed'])('opens active trip for %s', (type) => {
    expect(resolveNotificationNavigationRoute({ type })).toBe('/in-transit/moving');
  });

  it('opens routines for routine recommendations', () => {
    expect(resolveNotificationNavigationRoute({ type: 'routine_recommendation' })).toBe('/re-engagement/routines');
  });

  it('ignores malformed or unknown payloads', () => {
    expect(resolveNotificationNavigationRoute(null)).toBeNull();
    expect(resolveNotificationNavigationRoute({ type: 'unknown' })).toBeNull();
    expect(resolveNotificationNavigationRoute('route_changed')).toBeNull();
  });
});
