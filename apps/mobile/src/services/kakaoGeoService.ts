import type { AddressResult } from '../types/location';
import { coord2AddressViaProxy } from './api/client';

// TimeFit backend proxy를 통해 카카오 REST API(coord2address)를 호출한다.
export async function resolveKakaoAddressFromCoord(
  latitude: number,
  longitude: number,
): Promise<AddressResult> {
  const document = await coord2AddressViaProxy(latitude, longitude);

  const roadAddress = document?.road_address?.address_name?.trim() || null;
  const jibunAddress = document?.address?.address_name?.trim() || null;
  const address = roadAddress || jibunAddress || '주소를 찾을 수 없습니다';

  return {
    address,
    roadAddress,
    jibunAddress,
  };
}
