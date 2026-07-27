let blinkTimerCreationCount = 0;

export function recordTimeyBlinkTimerCreated() {
  blinkTimerCreationCount += 1;
}

export function getTimeyBlinkTimerCreationCount() {
  return blinkTimerCreationCount;
}

export function resetTimeyBlinkTimerCreationCount() {
  blinkTimerCreationCount = 0;
}
