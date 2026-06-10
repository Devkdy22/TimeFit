import { memo, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { TimeyProps } from '../../types/timey.types';
import { TIMEY_FEATURES } from '../../config/features';
import { TimeyAvatar } from './TimeyAvatar';
import { TimeyRive } from './TimeyRive';

function BaseTimey({ animated = true, animationMode = 'auto', renderStyle = 'flat', ...props }: TimeyProps) {
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduceMotionEnabled(enabled);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (enabled: boolean) => {
      setReduceMotionEnabled(enabled);
    });
    return () => {
      active = false;
      subscription?.remove?.();
    };
  }, []);

  const riveAllowed = TIMEY_FEATURES.enableRive;
  const soft3dAllowed = TIMEY_FEATURES.enableSoft3D;
  const effectiveAnimationMode = reduceMotionEnabled ? 'static' : animationMode;
  const wantsRive = effectiveAnimationMode === 'rive' || (effectiveAnimationMode === 'auto' && riveAllowed);
  const wantsSoft3d = renderStyle === 'soft3d' && soft3dAllowed;

  if (wantsRive) {
    return <TimeyRive {...props} animated={animated} renderStyle={renderStyle} />;
  }

  if (wantsSoft3d) {
    // Lazy-load 3D renderer only when explicitly requested and feature-enabled.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Timey3DAvatar } = require('./Timey3DAvatar') as typeof import('./Timey3DAvatar');
    return <Timey3DAvatar {...props} animated={animated} />;
  }

  if (effectiveAnimationMode === 'static') {
    return <TimeyAvatar {...props} animated={animated} renderStyle="flat" />;
  }

  if (animated) {
    return <TimeyAvatar {...props} animated renderStyle="flat" />;
  }

  return <TimeyAvatar {...props} animated={false} renderStyle="flat" />;
}

export const Timey = memo(BaseTimey);
