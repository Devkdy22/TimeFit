import { SettingsScreen } from './SettingsScreen';

/**
 * Kept as a route-compatible entry point while notification controls live in
 * the single source-of-truth settings screen.
 */
export function DepartureNotificationSettingsScreen() {
  return <SettingsScreen />;
}
