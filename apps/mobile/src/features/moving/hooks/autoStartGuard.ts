export function shouldAutoStartTracking(params: {
  trackingKey: string | null;
  isRunning: boolean;
  attemptedKey: string | null;
}): boolean {
  if (!params.trackingKey) {
    return false;
  }
  if (params.isRunning) {
    return false;
  }
  if (params.attemptedKey === params.trackingKey) {
    return false;
  }
  return true;
}
