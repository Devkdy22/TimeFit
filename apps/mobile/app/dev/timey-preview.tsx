import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Timey, TimeyStage } from '../../src/components/timey';
import type { TimeyAnimationMode } from '../../src/types/timey.types';
import type { TimeyState } from '../../src/domain/timey/timeyTypes';
import { TIMEY_CANONICAL_SOURCE } from '../../src/components/timey/TimeyAvatar';
import { TIMEY_3D_ASSET_PATHS, TIMEY_3D_ASSET_VARIANTS, isTimey3DMissing } from '../../src/components/timey/Timey3DAvatar';
import { TIMEY_3D_BLINK_MODE } from '../../src/components/timey/timeyBlink';
import { getTimeyRiveStatus } from '../../src/components/timey/TimeyRive';
import { Timey3DAvatar } from '../../src/components/timey';
import { TIMEY_FEATURES } from '../../src/config/features';
import { getTimeyMotionProfile } from '../../src/components/timey/timeyDisplay';
import { getTimeyStatusOverlay } from '../../src/components/timey/timeyOverlay';
import { getTimeyBlinkTimerCreationCount } from '../../src/components/timey/timeyQaDiagnostics';
import { canRunTimeyGreeting } from '../../src/components/timey/timeyGreeting';

const ALL_STATES: TimeyState[] = [
  'idle',
  'searching',
  'confident',
  'waiting',
  'walking',
  'riding_bus',
  'riding_subway',
  'transfer',
  'warning',
  'urgent',
  'panic',
  'offroute',
  'rerouting',
  'success',
  'late',
];

const QA_STATES: TimeyState[] = [
  'idle',
  'searching',
  'walking',
  'riding_bus',
  'riding_subway',
  'transfer',
  'warning',
  'urgent',
  'rerouting',
  'offroute',
  'success',
];

type PreviewSize = 'sm' | 'md' | 'lg';
const SIZE_OPTIONS: PreviewSize[] = ['sm', 'md', 'lg'];
const MODE_OPTIONS: TimeyAnimationMode[] = ['static', 'auto', 'rive'];
const RENDER_OPTIONS = ['flat', 'soft3d'] as const;
const STATE_NUMBER_OPTIONS = [0, 1, 8, 9, 12, 13] as const;

function stateFromNumber(stateNumber: number): TimeyState {
  switch (stateNumber) {
    case 1:
      return 'searching';
    case 8:
      return 'warning';
    case 9:
      return 'urgent';
    case 12:
      return 'rerouting';
    case 13:
      return 'success';
    case 0:
    default:
      return 'idle';
  }
}

function PickerRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.pickerRow}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((option) => {
          const active = option === value;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              style={[styles.chip, active ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TimeyPreviewScreen() {
  const router = useRouter();
  const [selectedState, setSelectedState] = useState<TimeyState>('idle');
  const [selectedSize, setSelectedSize] = useState<PreviewSize>('md');
  const [selectedMode, setSelectedMode] = useState<TimeyAnimationMode>('static');
  const [selectedRenderStyle, setSelectedRenderStyle] = useState<'flat' | 'soft3d'>('flat');
  const [riveStateNumber, setRiveStateNumber] = useState<number>(0);
  const [riveUrgency, setRiveUrgency] = useState<number>(0);
  const [riveIsMoving, setRiveIsMoving] = useState<boolean>(false);
  const [riveTriggerType, setRiveTriggerType] = useState<'success' | 'rerouting' | 'offroute' | undefined>(undefined);
  const [riveTriggerNonce, setRiveTriggerNonce] = useState<number>(0);
  const [qaState, setQaState] = useState<TimeyState>('idle');
  const [qaSequenceEnabled, setQaSequenceEnabled] = useState(false);
  const [stageMountCount, setStageMountCount] = useState(0);
  const [blinkTimerCount, setBlinkTimerCount] = useState(0);
  const [greetingReplayNonce, setGreetingReplayNonce] = useState(0);
  const qaSequenceIndex = useRef(0);
  const riveStatus = getTimeyRiveStatus();
  const missingFlatStates: TimeyState[] = [];
  const missingSoft3dStates = ALL_STATES.filter((state) => !TIMEY_3D_ASSET_PATHS[state]);

  useEffect(() => {
    if (!qaSequenceEnabled) return;
    const timer = setInterval(() => {
      qaSequenceIndex.current = (qaSequenceIndex.current + 1) % QA_STATES.length;
      setQaState(QA_STATES[qaSequenceIndex.current]);
    }, 1100);
    return () => clearInterval(timer);
  }, [qaSequenceEnabled]);

  useEffect(() => {
    const timer = setInterval(() => setBlinkTimerCount(getTimeyBlinkTimerCreationCount()), 500);
    return () => clearInterval(timer);
  }, []);

  const selectedPreview = useMemo(
    () => (
      <Timey
        state={selectedState}
        size={selectedSize}
        animationMode={selectedMode}
        renderStyle={selectedRenderStyle}
        animated={selectedMode !== 'static'}
        glow
      />
    ),
    [selectedMode, selectedRenderStyle, selectedSize, selectedState],
  );

  const riveInputPreviewState = useMemo(() => stateFromNumber(riveStateNumber), [riveStateNumber]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Timey Dev Preview</Text>
        <Text style={styles.subtitle}>TransitView 연결 전 상태 표현 QA</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Android State Fixture</Text>
          <Text style={styles.pathText}>개발 전용: timefit://dev/timey-preview</Text>
          <Pressable onPress={() => router.push('/dev/home-timey-preview' as never)} style={styles.sequenceButton}>
            <Text style={styles.sequenceButtonText}>HomeContainer 경로 QA 열기</Text>
          </Pressable>
          <TimeyStage
            variant="route"
            state={qaState}
            animated
            glow
            animationMode="static"
            renderStyle="flat"
            greeting={canRunTimeyGreeting(qaState)}
            greetingReplayNonce={greetingReplayNonce}
            onStageMount={() => setStageMountCount((count) => count + 1)}
          />
          <Text style={styles.stateText}>active state: {qaState}</Text>
          <Text style={styles.pathText}>Stage mounts: {stageMountCount} (상태 변경 중 1 유지가 기준)</Text>
          <Text style={styles.pathText}>asset: {TIMEY_3D_ASSET_VARIANTS[qaState].asset}</Text>
          <Text style={styles.pathText}>pose: {TIMEY_3D_ASSET_VARIANTS[qaState].poseVariant} / color variant: {TIMEY_3D_ASSET_VARIANTS[qaState].colorVariant} / alternate: {TIMEY_3D_ASSET_VARIANTS[qaState].alternateColorAvailable ? 'available' : 'missing'}</Text>
          <Text style={styles.pathText}>motion: {getTimeyMotionProfile(qaState).pattern}</Text>
          <Text style={styles.pathText}>overlay: {getTimeyStatusOverlay(qaState)?.icon ?? 'none'}</Text>
          <Text style={styles.pathText}>renderer: {TIMEY_FEATURES.enableSoft3D ? 'soft3d-fallback-capable' : 'canonical-svg'} / expression: {TIMEY_FEATURES.enableSoft3D ? TIMEY_3D_BLINK_MODE : 'eyesOpen/eyesClosed'} / blink effect setup: {blinkTimerCount}</Text>
          <View style={styles.chipRow}>
            {QA_STATES.map((state) => (
              <Pressable
                key={state}
                onPress={() => {
                  setQaSequenceEnabled(false);
                  setQaState(state);
                }}
                style={[styles.chip, qaState === state ? styles.chipActive : null]}
              >
                <Text style={[styles.chipText, qaState === state ? styles.chipTextActive : null]}>{state}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => setQaSequenceEnabled((enabled) => !enabled)} style={[styles.sequenceButton, qaSequenceEnabled ? styles.sequenceButtonActive : null]}>
            <Text style={styles.sequenceButtonText}>{qaSequenceEnabled ? '연속 상태 전환 중지' : '빠른 상태 연속 전환 시작'}</Text>
          </Pressable>
          <Text style={styles.pathText}>blink: eye layer only / full renderer opacity·key 변경 없음</Text>
          <Text style={styles.pathText}>greeting fixture: canonical SVG fallback / eligible: {canRunTimeyGreeting(qaState) ? 'yes' : 'no'} / replay: {greetingReplayNonce}</Text>
          <Pressable
            onPress={() => {
              setQaSequenceEnabled(false);
              setQaState('idle');
              setGreetingReplayNonce((nonce) => nonce + 1);
            }}
            style={styles.sequenceButton}
          >
            <Text style={styles.sequenceButtonText}>Home idle greeting replay</Text>
          </Pressable>
          <Text style={styles.pathText}>Rive: {riveStatus}; invalid asset이면 canonical SVG/2.5D fallback</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Interactive</Text>
          {selectedPreview}
          <Text style={styles.stateText}>{selectedState}</Text>
          <Text style={styles.pathText}>
            source type: {selectedRenderStyle === 'soft3d' ? '3d-png' : 'svg-canonical'}
          </Text>
          <Text style={styles.pathText}>
            source key/path:{' '}
            {selectedRenderStyle === 'soft3d'
              ? (TIMEY_3D_ASSET_PATHS[selectedState] ?? '(missing)')
              : TIMEY_CANONICAL_SOURCE.component}
          </Text>
          <Text style={styles.pathText}>fallback: soft3d 실패 시 canonical svg 사용</Text>

          <PickerRow label="State" options={ALL_STATES} value={selectedState} onChange={setSelectedState} />
          <PickerRow
            label="Size"
            options={SIZE_OPTIONS}
            value={selectedSize}
            onChange={setSelectedSize}
          />
          <PickerRow
            label="Mode"
            options={MODE_OPTIONS as readonly string[] as readonly TimeyAnimationMode[]}
            value={selectedMode}
            onChange={setSelectedMode}
          />
          <PickerRow
            label="Style"
            options={RENDER_OPTIONS}
            value={selectedRenderStyle}
            onChange={setSelectedRenderStyle}
          />
          <Text style={styles.pathText}>missing(flat): {missingFlatStates.length ? missingFlatStates.join(', ') : 'none'}</Text>
          <Text style={styles.pathText}>missing(soft3d): {missingSoft3dStates.length ? missingSoft3dStates.join(', ') : 'none'}</Text>
          <Text style={styles.pathText}>rive status: {riveStatus}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rive Input Test Harness</Text>
          <Text style={styles.pathText}>RIVE {riveStatus === 'ready' ? 'READY' : 'MISSING'}</Text>
          <Text style={styles.pathText}>
            fallback reason: {riveStatus === 'ready' ? 'none' : riveStatus === 'missing-library' ? 'missing-library' : 'missing-file'}
          </Text>
          <View style={styles.chipRow}>
            {STATE_NUMBER_OPTIONS.map((num) => {
              const active = num === riveStateNumber;
              return (
                <Pressable key={num} onPress={() => setRiveStateNumber(num)} style={[styles.chip, active ? styles.chipActive : null]}>
                  <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>stateNumber {num}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.chipRow}>
            <Pressable onPress={() => setRiveUrgency((v) => Math.max(0, +(v - 0.1).toFixed(2)))} style={styles.chip}>
              <Text style={styles.chipText}>urgency -0.1</Text>
            </Pressable>
            <Pressable onPress={() => setRiveUrgency((v) => Math.min(1, +(v + 0.1).toFixed(2)))} style={styles.chip}>
              <Text style={styles.chipText}>urgency +0.1</Text>
            </Pressable>
            <Pressable onPress={() => setRiveIsMoving((v) => !v)} style={[styles.chip, riveIsMoving ? styles.chipActive : null]}>
              <Text style={[styles.chipText, riveIsMoving ? styles.chipTextActive : null]}>isMoving {riveIsMoving ? 'true' : 'false'}</Text>
            </Pressable>
          </View>
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => {
                setRiveTriggerType('success');
                setRiveTriggerNonce((n) => n + 1);
              }}
              style={styles.chip}
            >
              <Text style={styles.chipText}>triggerSuccess</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setRiveTriggerType('rerouting');
                setRiveTriggerNonce((n) => n + 1);
              }}
              style={styles.chip}
            >
              <Text style={styles.chipText}>triggerReroute</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setRiveTriggerType('offroute');
                setRiveTriggerNonce((n) => n + 1);
              }}
              style={styles.chip}
            >
              <Text style={styles.chipText}>triggerOffroute</Text>
            </Pressable>
          </View>
          <Text style={styles.pathText}>stateNumber: {riveStateNumber}</Text>
          <Text style={styles.pathText}>urgency: {riveUrgency.toFixed(2)}</Text>
          <Text style={styles.pathText}>isMoving: {riveIsMoving ? 'true' : 'false'}</Text>
          <Text style={styles.pathText}>trigger nonce: {riveTriggerNonce}</Text>
          <View style={styles.previewRow}>
            <Timey
              state={riveInputPreviewState}
              size="lg"
              animationMode="rive"
              renderStyle="flat"
              animated
              glow
              riveUrgency={riveUrgency}
              riveIsMoving={riveIsMoving}
              riveDebugTriggerType={riveTriggerType}
              riveDebugTriggerNonce={riveTriggerNonce}
            />
          </View>
        </View>

        {ALL_STATES.map((state) => (
          <View key={state} style={styles.card}>
            <Text style={styles.cardTitle}>{state}</Text>
            <Text style={styles.pathText}>flat(svg): {TIMEY_CANONICAL_SOURCE.component}</Text>
            <Text style={styles.pathText}>soft3d(png): {TIMEY_3D_ASSET_PATHS[state] ?? '(missing)'}</Text>
            <View style={styles.compareRow}>
              <View style={styles.compareColumn}>
                <Text style={styles.previewLabel}>flat</Text>
                <View style={styles.previewRow}>
                  <View style={styles.previewCell}>
                    <Text style={styles.previewLabel}>sm</Text>
                    <Timey state={state} size="sm" animationMode="static" renderStyle="flat" animated={false} glow />
                  </View>
                  <View style={styles.previewCell}>
                    <Text style={styles.previewLabel}>md</Text>
                    <Timey state={state} size="md" animationMode="static" renderStyle="flat" animated={false} glow />
                  </View>
                  <View style={styles.previewCell}>
                    <Text style={styles.previewLabel}>lg</Text>
                    <Timey state={state} size="lg" animationMode="static" renderStyle="flat" animated={false} glow />
                  </View>
                </View>
              </View>
              <View style={styles.compareColumn}>
                <Text style={styles.previewLabel}>soft3d</Text>
                {isTimey3DMissing(state) ? <Text style={styles.missingBadge}>3D MISSING</Text> : null}
                <View style={styles.previewRow}>
                  <View style={styles.previewCell}>
                    <Text style={styles.previewLabel}>sm</Text>
                    <Timey3DAvatar state={state} size="sm" animated={false} glow />
                  </View>
                  <View style={styles.previewCell}>
                    <Text style={styles.previewLabel}>md</Text>
                    <Timey3DAvatar state={state} size="md" animated={false} glow />
                  </View>
                  <View style={styles.previewCell}>
                    <Text style={styles.previewLabel}>lg</Text>
                    <Timey3DAvatar state={state} size="lg" animated={false} glow />
                  </View>
                </View>
              </View>
              <View style={styles.compareColumn}>
                <Text style={styles.previewLabel}>rive</Text>
                {riveStatus !== 'ready' ? <Text style={styles.missingBadge}>RIVE MISSING</Text> : null}
                <View style={styles.previewRow}>
                  <View style={styles.previewCell}>
                    <Text style={styles.previewLabel}>sm</Text>
                    <Timey state={state} size="sm" animationMode="rive" renderStyle="flat" animated glow />
                  </View>
                  <View style={styles.previewCell}>
                    <Text style={styles.previewLabel}>md</Text>
                    <Timey state={state} size="md" animationMode="rive" renderStyle="flat" animated glow />
                  </View>
                  <View style={styles.previewCell}>
                    <Text style={styles.previewLabel}>lg</Text>
                    <Timey state={state} size="lg" animationMode="rive" renderStyle="flat" animated glow />
                  </View>
                </View>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#05070B',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 14,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 26,
    fontFamily: 'Pretendard-SemiBold',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 4,
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 10,
  },
  cardTitle: {
    color: '#E2E8F0',
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
  },
  stateText: {
    color: '#CBD5E1',
    fontSize: 13,
  },
  pathText: {
    color: '#7E8A9C',
    fontSize: 11,
  },
  pickerRow: {
    gap: 6,
  },
  pickerLabel: {
    color: '#94A3B8',
    fontSize: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#111827',
  },
  chipActive: {
    borderColor: '#58C7C2',
    backgroundColor: 'rgba(88, 199, 194, 0.16)',
  },
  chipText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  chipTextActive: {
    color: '#CCFBF1',
  },
  sequenceButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingVertical: 10,
  },
  sequenceButtonActive: {
    backgroundColor: '#38BDF8',
  },
  sequenceButtonText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontFamily: 'Pretendard-SemiBold',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  compareRow: {
    gap: 12,
  },
  compareColumn: {
    gap: 8,
  },
  previewCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 132,
    borderRadius: 14,
    backgroundColor: '#0B1220',
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingVertical: 12,
  },
  previewLabel: {
    color: '#94A3B8',
    fontSize: 12,
  },
  missingBadge: {
    alignSelf: 'flex-start',
    color: '#FCA5A5',
    backgroundColor: 'rgba(127,29,29,0.45)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '700',
  },
});
