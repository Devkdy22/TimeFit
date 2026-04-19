import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import type { TimiExpression } from './TimiModel';

export type TimiMood = 'question' | 'focus' | 'concerned' | 'happy';
export type TimiInteraction = 'none' | 'field' | 'time' | 'save';

interface UseTimiAnimationParams {
  mood: TimiMood;
  interaction: TimiInteraction;
  signal: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function useTimiAnimation({ mood, interaction, signal }: UseTimiAnimationParams) {
  const floatY = useRef(new Animated.Value(0)).current;
  const swayDeg = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const [phase, setPhase] = useState(0);
  const [blink, setBlink] = useState(1);
  const [gazeX, setGazeX] = useState(0);
  const [expression, setExpression] = useState<TimiExpression>('question');

  const [interactionBoost, setInteractionBoost] = useState({
    head: 0,
    leftArm: 0,
    rightArm: 0,
    eyes: 1,
  });

  useEffect(() => {
    const floatAmp = mood === 'concerned' ? 1.6 : 2.6;
    const swayAmp = mood === 'focus' ? 1.2 : 2.1;

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -floatAmp,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          toValue: floatAmp * 0.35,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const swayLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(swayDeg, {
          toValue: -swayAmp,
          duration: 2100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(swayDeg, {
          toValue: swayAmp,
          duration: 2100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    floatLoop.start();
    swayLoop.start();

    return () => {
      floatLoop.stop();
      swayLoop.stop();
    };
  }, [floatY, mood, swayDeg]);

  useEffect(() => {
    let frameId = 0;
    let previousTs = 0;
    const angularVelocity = (Math.PI * 2) / 2200;

    const tick = (timestamp: number) => {
      if (previousTs === 0) {
        previousTs = timestamp;
      }

      const deltaMs = timestamp - previousTs;
      previousTs = timestamp;

      // Keep phase continuous (no 2π wrapping) so mixed-frequency waves stay smooth.
      setPhase((prev) => prev + deltaMs * angularVelocity);

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setBlink(0.14);
      setTimeout(() => setBlink(1), 110);
    }, 2300);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (mood === 'concerned') {
      setExpression('concerned');
      setGazeX(0);
      return;
    }
    if (mood === 'focus') {
      setExpression('focus');
      setGazeX(0.8);
      return;
    }
    if (mood === 'happy') {
      setExpression('smile');
      setGazeX(0);
      return;
    }
    setExpression('question');
    setGazeX(0);
  }, [mood]);

  useEffect(() => {
    if (signal === 0 || interaction === 'none') {
      return;
    }

    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.035,
        duration: 130,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 180,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    if (interaction === 'field') {
      setExpression('focus');
      setGazeX(1.2);
      setInteractionBoost({ head: -4, leftArm: 7, rightArm: -6, eyes: 1.08 });
      setTimeout(() => {
        setInteractionBoost({ head: 0, leftArm: 0, rightArm: 0, eyes: 1 });
      }, 320);
      return;
    }

    if (interaction === 'time') {
      setExpression('question');
      setGazeX(0);
      setInteractionBoost({ head: -5, leftArm: 2, rightArm: -2, eyes: 1.15 });
      setTimeout(() => {
        setInteractionBoost({ head: 0, leftArm: 0, rightArm: 0, eyes: 1 });
      }, 300);
      return;
    }

    setExpression('smile');
    setGazeX(-0.4);
    setInteractionBoost({ head: 2, leftArm: -8, rightArm: 8, eyes: 1.04 });
    setTimeout(() => {
      setInteractionBoost({ head: 0, leftArm: 0, rightArm: 0, eyes: 1 });
    }, 350);
  }, [interaction, scale, signal]);

  const partMotion = useMemo(() => {
    const wave = Math.sin(phase);
    const secondaryWave = Math.sin(phase * 1.4 + 0.8);

    if (interaction === 'none') {
      return {
        headRotateDeg: clamp(wave * 0.8, -4, 4),
        bodyTranslateY: 0,
        leftArmRotateDeg: -10,
        // Keep the arm beside the face and make it feel like a vertical wave.
        rightArmRotateDeg: clamp(-22 + secondaryWave * 3.8, -28, -14),
        rightArmTranslateY: clamp(secondaryWave * 3.2, -3.2, 3.2),
        eyesScaleY: clamp(blink, 0.14, 1.05),
      };
    }

    return {
      headRotateDeg: clamp(wave * 2.2 + interactionBoost.head, -11, 11),
      bodyTranslateY: wave * 1.8,
      leftArmRotateDeg: clamp(-8 + secondaryWave * 4 + interactionBoost.leftArm, -28, 16),
      rightArmRotateDeg: clamp(8 - secondaryWave * 4 + interactionBoost.rightArm, -16, 28),
      rightArmTranslateY: 0,
      eyesScaleY: clamp(blink * interactionBoost.eyes, 0.14, 1.15),
    };
  }, [blink, interaction, interactionBoost, phase]);

  const containerStyle = {
    transform:
      interaction === 'none'
        ? [{ scale }]
        : [
            { translateY: floatY },
            {
              rotate: swayDeg.interpolate({
                inputRange: [-20, 20],
                outputRange: ['-20deg', '20deg'],
              }),
            },
            { scale },
          ],
  };

  return {
    containerStyle,
    blink: partMotion.eyesScaleY,
    gazeX,
    expression,
    headRotateDeg: partMotion.headRotateDeg,
    bodyTranslateY: partMotion.bodyTranslateY,
    leftArmRotateDeg: partMotion.leftArmRotateDeg,
    rightArmRotateDeg: partMotion.rightArmRotateDeg,
    rightArmTranslateY: partMotion.rightArmTranslateY,
  };
}
