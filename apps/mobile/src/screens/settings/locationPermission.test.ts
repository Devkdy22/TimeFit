import { getLocationPermissionLabel } from './locationPermission';

describe('getLocationPermissionLabel', () => {
  it('maps granted permission', () => {
    expect(getLocationPermissionLabel('granted')).toBe('허용됨');
  });

  it('maps denied and restricted permission', () => {
    expect(getLocationPermissionLabel('denied')).toBe('허용 필요');
    expect(getLocationPermissionLabel('restricted')).toBe('제한됨');
  });

  it('keeps unknown states non-committal', () => {
    expect(getLocationPermissionLabel('undetermined')).toBe('확인 중');
  });
});
