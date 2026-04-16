export interface MockUser {
  id: string;
  name: string;
  isLoggedIn: boolean;
  notificationEnabled: boolean;
  locationPermission: 'granted' | 'denied' | 'prompt';
}
