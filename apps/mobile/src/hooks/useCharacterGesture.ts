import { Gesture } from 'react-native-gesture-handler';
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { CHARACTER_SPRING_CONFIG, clamp, dampVelocity, lerp } from '../utils/physics';

export interface CharacterGestureValues {
  touchX: SharedValue<number>;
  touchY: SharedValue<number>;
  velocityX: SharedValue<number>;
  velocityY: SharedValue<number>;
  isPressed: SharedValue<boolean>;
  targetX: SharedValue<number>;
  targetY: SharedValue<number>;
  currentX: SharedValue<number>;
  currentY: SharedValue<number>;
  dragDistance: SharedValue<number>;
  gesture: ReturnType<typeof Gesture.Pan>;
}

interface UseCharacterGestureParams {
  initialX: number;
  initialY: number;
  maxDragX?: number;
  maxDragY?: number;
}

export function useCharacterGesture({
  initialX,
  initialY,
  maxDragX = 140,
  maxDragY = 180,
}: UseCharacterGestureParams): CharacterGestureValues {
  const touchX = useSharedValue(initialX);
  const touchY = useSharedValue(initialY);
  const velocityX = useSharedValue(0);
  const velocityY = useSharedValue(0);
  const isPressed = useSharedValue(false);
  const targetX = useSharedValue(initialX);
  const targetY = useSharedValue(initialY);
  const currentX = useSharedValue(initialX);
  const currentY = useSharedValue(initialY);

  const dragDistance = useDerivedValue(() => {
    const dx = targetX.value - initialX;
    const dy = targetY.value - initialY;
    return Math.sqrt(dx * dx + dy * dy);
  }, [initialX, initialY]);

  useFrameCallback(({ timeSincePreviousFrame }) => {
    const delta = timeSincePreviousFrame ?? 16;
    const dtScale = clamp(delta / 16.67, 0.2, 3);

    const alpha = isPressed.value ? clamp(0.1 * dtScale, 0.03, 0.26) : clamp(0.22 * dtScale, 0.08, 0.44);
    currentX.value = lerp(currentX.value, targetX.value, alpha);
    currentY.value = lerp(currentY.value, targetY.value, alpha);

    if (!isPressed.value) {
      const dx = Math.abs(currentX.value - targetX.value);
      const dy = Math.abs(currentY.value - targetY.value);
      if (dx < 0.35) {
        currentX.value = targetX.value;
      }
      if (dy < 0.35) {
        currentY.value = targetY.value;
      }
    }

    if (!isPressed.value) {
      velocityX.value = dampVelocity(velocityX.value, 0.9);
      velocityY.value = dampVelocity(velocityY.value, 0.9);
    }
  });

  const gesture = Gesture.Pan()
    .onBegin((event) => {
      isPressed.value = true;
      touchX.value = event.x;
      touchY.value = event.y;
      targetX.value = clamp(event.x, initialX - maxDragX, initialX + maxDragX);
      targetY.value = clamp(event.y, initialY - maxDragY, initialY + maxDragY);
    })
    .onUpdate((event) => {
      touchX.value = event.x;
      touchY.value = event.y;
      velocityX.value = event.velocityX;
      velocityY.value = event.velocityY;
      targetX.value = clamp(event.x, initialX - maxDragX, initialX + maxDragX);
      targetY.value = clamp(event.y, initialY - maxDragY, initialY + maxDragY);
    })
    .onEnd((event) => {
      isPressed.value = false;
      velocityX.value = event.velocityX;
      velocityY.value = event.velocityY;
      targetX.value = withSpring(initialX, {
        ...CHARACTER_SPRING_CONFIG,
        velocity: event.velocityX * 0.0014,
      });
      targetY.value = withSpring(initialY, {
        ...CHARACTER_SPRING_CONFIG,
        velocity: event.velocityY * 0.0014,
      });
    })
    .onFinalize(() => {
      isPressed.value = false;
      targetX.value = withSpring(initialX, CHARACTER_SPRING_CONFIG);
      targetY.value = withSpring(initialY, CHARACTER_SPRING_CONFIG);
    });

  return {
    touchX,
    touchY,
    velocityX,
    velocityY,
    isPressed,
    targetX,
    targetY,
    currentX,
    currentY,
    dragDistance,
    gesture,
  };
}
