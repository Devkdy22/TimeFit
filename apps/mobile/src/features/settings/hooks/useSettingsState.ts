import { useState } from 'react';

export function useSettingsState() {
  const [isNotificationEnabled, setNotificationEnabled] = useState(true);
  const [isLiveLocationEnabled, setLiveLocationEnabled] = useState(true);
  const [isLoggedIn, setLoggedIn] = useState(false);

  return {
    isNotificationEnabled,
    isLiveLocationEnabled,
    isLoggedIn,
    setNotificationEnabled,
    setLiveLocationEnabled,
    toggleLoggedIn: () => setLoggedIn((prev) => !prev),
  };
}
