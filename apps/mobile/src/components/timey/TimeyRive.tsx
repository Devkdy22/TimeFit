import { memo, useEffect, useMemo, useRef, useState, type Ref } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import type { TimeyProps, TimeyState } from '../../types/timey.types';
import { getTimeyAccessibilityLabel } from './TimeyController';
import { TimeyAvatar } from './TimeyAvatar';
import {
  inferTimeyRiveIsMoving,
  inferTimeyRiveUrgency,
  TIMEY_RIVE_TRIGGER_STATES,
  toTimeyRiveStateNumber,
} from './timeyRiveMap';

interface RiveProps {
  ref?: Ref<RiveRefLike>;
  resourceName?: string;
  resourcePath?: number;
  stateMachineName: string;
  autoplay: boolean;
  style: { width: number; height: number };
}

interface RiveRefLike {
  setInputState?: (stateMachineName: string, inputName: string, value: number | boolean) => void;
  fireState?: (stateMachineName: string, inputName: string) => void;
}

const TIMEY_RIVE_CONTRACT = {
  file: 'apps/mobile/assets/animations/timey/timey.riv',
  stateMachineName: 'TimeyStateMachine',
} as const;

type RuntimeCache = {
  checked: boolean;
  component: React.ComponentType<RiveProps> | null;
  moduleRef: number | null;
};

const runtimeCache: RuntimeCache = {
  checked: false,
  component: null,
  moduleRef: null,
};

const warnedStatuses = new Set<TimeyRiveStatus>();

function warnOnce(status: TimeyRiveStatus) {
  if (status === 'ready' || warnedStatuses.has(status)) return;
  warnedStatuses.add(status);
  const reason = status === 'missing-library' ? 'rive-react-native not installed' : 'timey.riv missing/unresolved';
  console.warn(`[TimeyRive] Falling back to static SVG (${reason})`);
}

function ensureRuntime() {
  if (runtimeCache.checked) return runtimeCache;
  runtimeCache.checked = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    runtimeCache.component = require('rive-react-native').default;
  } catch {
    runtimeCache.component = null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    runtimeCache.moduleRef = require('../../../assets/animations/timey/timey.riv');
  } catch {
    runtimeCache.moduleRef = null;
  }
  return runtimeCache;
}

export type TimeyRiveStatus = 'ready' | 'missing-library' | 'missing-file';

export function getTimeyRiveStatus(): TimeyRiveStatus {
  const runtime = ensureRuntime();
  if (!runtime.component) return 'missing-library';
  if (!runtime.moduleRef) return 'missing-file';
  return 'ready';
}

function resolveSize(size: TimeyProps['size']) {
  if (typeof size === 'number') return size;
  if (size === 'sm') return 64;
  if (size === 'lg') return 120;
  return 96;
}

function BaseTimeyRive({
  state = 'idle',
  size = 'md',
  glow = false,
  accessibilityLabel,
  riveUrgency,
  riveIsMoving,
  riveDebugTriggerType,
  riveDebugTriggerNonce,
}: TimeyProps) {
  const resolvedSize = resolveSize(size);
  const resolvedLabel = accessibilityLabel ?? getTimeyAccessibilityLabel(state);
  const status = getTimeyRiveStatus();
  const runtime = ensureRuntime();
  const riveRef = useRef<RiveRefLike | null>(null);
  const prevStateRef = useRef<TimeyState>('idle');
  const prevDebugNonceRef = useRef<number | undefined>(undefined);
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

  if (reduceMotionEnabled || status !== 'ready' || !runtime.component || !runtime.moduleRef) {
    if (!reduceMotionEnabled) {
      warnOnce(status);
    }
    return <TimeyAvatar state={state} size={resolvedSize} glow={glow} animated accessibilityLabel={resolvedLabel} />;
  }
  const RiveComponent = runtime.component;

  const stateNumber = useMemo(() => toTimeyRiveStateNumber(state), [state]);
  const urgency = useMemo(() => inferTimeyRiveUrgency(state, riveUrgency), [riveUrgency, state]);
  const isMoving = useMemo(() => {
    if (typeof riveIsMoving === 'boolean') return riveIsMoving;
    return inferTimeyRiveIsMoving(state);
  }, [riveIsMoving, state]);

  useEffect(() => {
    const inst = riveRef.current;
    if (!inst?.setInputState) return;
    inst.setInputState(TIMEY_RIVE_CONTRACT.stateMachineName, 'stateNumber', stateNumber);
    inst.setInputState(TIMEY_RIVE_CONTRACT.stateMachineName, 'urgency', urgency);
    inst.setInputState(TIMEY_RIVE_CONTRACT.stateMachineName, 'isMoving', isMoving);

    const prev = prevStateRef.current;
    if (prev !== state) {
      // Enter-only trigger firing with debounce semantics via previous state tracking.
      const triggerName =
        state === 'success'
          ? TIMEY_RIVE_TRIGGER_STATES.success
          : state === 'rerouting'
            ? TIMEY_RIVE_TRIGGER_STATES.rerouting
            : state === 'offroute'
              ? TIMEY_RIVE_TRIGGER_STATES.offroute
              : null;
      if (triggerName && inst.fireState) {
        inst.fireState(TIMEY_RIVE_CONTRACT.stateMachineName, triggerName);
      }
      prevStateRef.current = state;
    }
  }, [isMoving, state, stateNumber, urgency]);

  useEffect(() => {
    const inst = riveRef.current;
    if (!inst?.fireState || !riveDebugTriggerType) return;
    if (riveDebugTriggerNonce == null || riveDebugTriggerNonce === prevDebugNonceRef.current) return;
    const triggerName =
      riveDebugTriggerType === 'success'
        ? TIMEY_RIVE_TRIGGER_STATES.success
        : riveDebugTriggerType === 'rerouting'
          ? TIMEY_RIVE_TRIGGER_STATES.rerouting
          : TIMEY_RIVE_TRIGGER_STATES.offroute;
    inst.fireState(TIMEY_RIVE_CONTRACT.stateMachineName, triggerName);
    prevDebugNonceRef.current = riveDebugTriggerNonce;
  }, [riveDebugTriggerNonce, riveDebugTriggerType]);

  useEffect(() => () => {
    // Ensure refs are reset on unmount so remount starts from clean trigger history.
    prevStateRef.current = 'idle';
    riveRef.current = null;
  }, []);

  return (
    <View style={{ width: resolvedSize, height: resolvedSize }} accessibilityRole="image" accessibilityLabel={resolvedLabel}>
      <RiveComponent
        ref={riveRef}
        resourcePath={runtime.moduleRef}
        stateMachineName={TIMEY_RIVE_CONTRACT.stateMachineName}
        autoplay
        style={{ width: resolvedSize, height: resolvedSize }}
      />
    </View>
  );
}

export const TimeyRive = memo(BaseTimeyRive);
