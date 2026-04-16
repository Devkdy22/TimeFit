import { OnboardingView } from './OnboardingView';
import { useNavigationHelper } from '../../../utils/navigation';
import { setOnboardingCompleted } from '../storage';

export function OnboardingScreen() {
  const nav = useNavigationHelper();

  const handlePressStart = async () => {
    await setOnboardingCompleted();
    nav.replaceToHome();
  };

  return <OnboardingView onPressStart={handlePressStart} />;
}
