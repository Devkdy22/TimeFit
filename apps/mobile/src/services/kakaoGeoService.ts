import type { AddressResult } from '../types/location';

const KAKAO_COORD2ADDRESS_ENDPOINT = 'https://dapi.kakao.com/v2/local/geo/coord2address.json';

interface KakaoCoord2AddressDocument {
  road_address?: {
    address_name?: string;
  };
  address?: {
    address_name?: string;
  };
}

interface KakaoCoord2AddressResponse {
  documents?: KakaoCoord2AddressDocument[];
}

// 카카오 REST API(coord2address)로 좌표를 주소로 변환한다.
export async function resolveKakaoAddressFromCoord(
  latitude: number,
  longitude: number,
): Promise<AddressResult> {
  const restApiKey = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY?.trim();

  if (!restApiKey) {
    throw new Error('카카오 REST API 키가 없습니다. EXPO_PUBLIC_KAKAO_REST_API_KEY를 설정해주세요.');
  }

  const url = new URL(KAKAO_COORD2ADDRESS_ENDPOINT);
  url.searchParams.set('x', String(longitude));
  url.searchParams.set('y', String(latitude));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `KakaoAK ${restApiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`카카오 주소 변환 실패 (${response.status})`);
  }

  const payload = (await response.json()) as KakaoCoord2AddressResponse;
  const document = payload.documents?.[0];

  const roadAddress = document?.road_address?.address_name?.trim() || null;
  const jibunAddress = document?.address?.address_name?.trim() || null;
  const address = roadAddress || jibunAddress || '주소를 찾을 수 없습니다';

  return {
    address,
    roadAddress,
    jibunAddress,
  };
}
