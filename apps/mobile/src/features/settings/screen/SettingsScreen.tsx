import { useAuth } from '../../auth/context';
import { useSettingsState } from '../hooks/useSettingsState';
import { SettingsView } from './SettingsView';
import { useNavigationHelper } from '../../../utils/navigation';

export function SettingsScreen() {
  const nav = useNavigationHelper();
  const { isLoggedIn, logout, profile } = useAuth();
  const { isNotificationEnabled, isLiveLocationEnabled, setNotificationEnabled, setLiveLocationEnabled } = useSettingsState();

  return (
    <SettingsView
      isNotificationEnabled={isNotificationEnabled}
      isLiveLocationEnabled={isLiveLocationEnabled}
      isLoggedIn={isLoggedIn}
      loginEmail={profile?.email ?? null}
      onChangeNotification={setNotificationEnabled}
      onChangeLiveLocation={setLiveLocationEnabled}
      onToggleLogin={() => {
        if (isLoggedIn) {
          logout();
          return;
        }
        nav.goToLogin();
      }}
      onPressTestMap={nav.goToTransit}
      onPressOnboarding={nav.goToOnboarding}
    />
  );
}
