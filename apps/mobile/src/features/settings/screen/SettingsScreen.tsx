import { useSettingsState } from '../hooks/useSettingsState';
import { SettingsView } from './SettingsView';
import { useNavigationHelper } from '../../../utils/navigation';

export function SettingsScreen() {
  const nav = useNavigationHelper();
  const {
    isNotificationEnabled,
    isLiveLocationEnabled,
    isLoggedIn,
    setNotificationEnabled,
    setLiveLocationEnabled,
    toggleLoggedIn,
  } = useSettingsState();

  return (
    <SettingsView
      isNotificationEnabled={isNotificationEnabled}
      isLiveLocationEnabled={isLiveLocationEnabled}
      isLoggedIn={isLoggedIn}
      onChangeNotification={setNotificationEnabled}
      onChangeLiveLocation={setLiveLocationEnabled}
      onToggleLogin={toggleLoggedIn}
      onPressTestMap={nav.goToTransit}
      onPressOnboarding={nav.goToOnboarding}
    />
  );
}
