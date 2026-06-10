import type { CommuteStatus } from './types';
import { CustomBottomTabBar } from '../../navigation/CustomBottomTabBar';

interface HomeTabBarProps {
  status?: CommuteStatus;
}

export function HomeTabBar({ status }: HomeTabBarProps) {
  void status;
  return <CustomBottomTabBar />;
}
