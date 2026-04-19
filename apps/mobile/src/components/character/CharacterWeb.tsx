import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import { Timi } from './Timi';

export type CharacterTone = 'mint' | 'orange' | 'red';
type CharacterState = 'idle' | 'walk' | 'run' | 'urgent' | 'happy' | 'stressed';

export interface CharacterProps {
  size?: number;
  tone?: CharacterTone;
  state?: CharacterState;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function Character({ size = 220, tone = 'mint', state = 'idle' }: CharacterProps) {
  const facePullX = useRef(new Animated.Value(0)).current;
  const facePullY = useRef(new Animated.Value(0)).current;
  const faceFocusX = useRef(new Animated.Value(0)).current;
  const faceFocusY = useRef(new Animated.Value(0)).current;
  const headTilt = useRef(new Animated.Value(0)).current;
  const faceDepth = useRef(new Animated.Value(0)).current;
  const [facePullXValue, setFacePullXValue] = useState(0);
  const [facePullYValue, setFacePullYValue] = useState(0);
  const [faceFocusXValue, setFaceFocusXValue] = useState(0);
  const [faceFocusYValue, setFaceFocusYValue] = useState(0);
  const [headTiltValue, setHeadTiltValue] = useState(0);
  const [faceDepthValue, setFaceDepthValue] = useState(0);

  const setFocusByTouch = (locationX: number, locationY: number) => {
    const nx = clamp((locationX - size * 0.5) / (size * 0.34), -1, 1);
    const nyOffset = locationY - size * 0.45;
    // Upward drag needed stronger response than downward on-device.
    const ny = clamp(nyOffset / (nyOffset < 0 ? size * 0.28 : size * 0.34), -1, 1);
    faceFocusX.setValue(nx);
    faceFocusY.setValue(ny);
  };

  useEffect(() => {
    const idX = facePullX.addListener(({ value }) => {
      setFacePullXValue(value);
    });
    const idY = facePullY.addListener(({ value }) => {
      setFacePullYValue(value);
    });
    const idFocusX = faceFocusX.addListener(({ value }) => {
      setFaceFocusXValue(value);
    });
    const idFocusY = faceFocusY.addListener(({ value }) => {
      setFaceFocusYValue(value);
    });
    const idTilt = headTilt.addListener(({ value }) => {
      setHeadTiltValue(value);
    });
    const idDepth = faceDepth.addListener(({ value }) => {
      setFaceDepthValue(value);
    });
    return () => {
      facePullX.removeListener(idX);
      facePullY.removeListener(idY);
      faceFocusX.removeListener(idFocusX);
      faceFocusY.removeListener(idFocusY);
      headTilt.removeListener(idTilt);
      faceDepth.removeListener(idDepth);
    };
  }, [faceDepth, faceFocusX, faceFocusY, facePullX, facePullY, headTilt]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: (evt) => {
          setFocusByTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
          Animated.parallel([
            Animated.spring(facePullX, { toValue: 0, useNativeDriver: false, bounciness: 6 }),
            Animated.spring(facePullY, { toValue: 0, useNativeDriver: false, bounciness: 6 }),
            Animated.spring(headTilt, { toValue: 0, useNativeDriver: false, bounciness: 6 }),
            Animated.spring(faceDepth, { toValue: 0.28, useNativeDriver: false, bounciness: 6 }),
          ]).start();
        },
        onPanResponderMove: (evt, gestureState) => {
          const dx = clamp(gestureState.dx, -48, 48);
          const dy = clamp(gestureState.dy, -48, 48);
          const magnitude = clamp(Math.sqrt(dx * dx + dy * dy) / 58, 0, 1);
          setFocusByTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
          facePullX.setValue(clamp(dx / 70, -1, 1));
          facePullY.setValue(clamp(dy / (dy < 0 ? 58 : 70), -1, 1));
          headTilt.setValue(clamp(dx * 0.05, -3.2, 3.2));
          faceDepth.setValue(0.08 + magnitude * 0.5);
        },
        onPanResponderRelease: () => {
          Animated.parallel([
            Animated.spring(facePullX, { toValue: 0, useNativeDriver: false, bounciness: 14 }),
            Animated.spring(facePullY, { toValue: 0, useNativeDriver: false, bounciness: 14 }),
            Animated.spring(faceFocusX, { toValue: 0, useNativeDriver: false, bounciness: 10 }),
            Animated.spring(faceFocusY, { toValue: 0, useNativeDriver: false, bounciness: 10 }),
            Animated.spring(headTilt, { toValue: 0, useNativeDriver: false, bounciness: 12 }),
            Animated.sequence([
              Animated.timing(faceDepth, {
                toValue: 0,
                duration: 120,
                useNativeDriver: false,
              }),
              Animated.spring(faceDepth, { toValue: 0, useNativeDriver: false, bounciness: 12 }),
            ]),
          ]).start();
        },
        onPanResponderTerminate: () => {
          Animated.parallel([
            Animated.spring(facePullX, { toValue: 0, useNativeDriver: false, bounciness: 14 }),
            Animated.spring(facePullY, { toValue: 0, useNativeDriver: false, bounciness: 14 }),
            Animated.spring(faceFocusX, { toValue: 0, useNativeDriver: false, bounciness: 10 }),
            Animated.spring(faceFocusY, { toValue: 0, useNativeDriver: false, bounciness: 10 }),
            Animated.spring(headTilt, { toValue: 0, useNativeDriver: false, bounciness: 12 }),
            Animated.spring(faceDepth, { toValue: 0, useNativeDriver: false, bounciness: 12 }),
          ]).start();
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [faceDepth, faceFocusX, faceFocusY, facePullX, facePullY, headTilt, size],
  );

  const expression = state === 'happy' ? 'smile' : state === 'urgent' ? 'focus' : 'neutral';

  return (
    <View {...responder.panHandlers} style={[styles.wrapper, { width: size, height: size }]}>
      <Animated.View>
        <Timi
          tone={tone}
          size={size}
          expression={expression}
          showShadow
          facePullX={facePullXValue}
          facePullY={facePullYValue}
          faceDepth={faceDepthValue}
          faceFocusX={faceFocusXValue}
          faceFocusY={faceFocusYValue}
          headRotateDeg={headTiltValue}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
