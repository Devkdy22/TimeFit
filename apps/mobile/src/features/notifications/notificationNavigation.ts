export type NotificationNavigationRoute = '/in-transit/moving' | '/re-engagement/routines' | null;

export function resolveNotificationNavigationRoute(data: unknown): NotificationNavigationRoute {
  if (!data || typeof data !== 'object') return null;
  const type = (data as { type?: unknown }).type;

  if (type === 'routine_recommendation') return '/re-engagement/routines';
  if (type === 'departure' || type === 'delay' || type === 'reroute' || type === 'route_changed') {
    return '/in-transit/moving';
  }
  return null;
}
