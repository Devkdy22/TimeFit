export function getLocationPermissionLabel(status: string): string {
  if (status === 'granted') return '허용됨';
  if (status === 'denied') return '허용 필요';
  if (status === 'restricted') return '제한됨';
  return '확인 중';
}
