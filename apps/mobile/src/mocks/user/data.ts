import type { MockUser } from './types';

export const mockUser: MockUser = {
  id: 'user-guest',
  name: '게스트',
  isLoggedIn: false,
  notificationEnabled: true,
  locationPermission: 'granted',
};
