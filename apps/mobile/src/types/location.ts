// 공통 위치 샘플 타입
export interface LocationReading {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

// 카카오 좌표->주소 변환 결과 타입
export interface AddressResult {
  address: string;
  roadAddress: string | null;
  jibunAddress: string | null;
}

// 훅에서 외부로 노출하는 통일 결과 타입
export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  address: string;
  roadAddress: string | null;
  jibunAddress: string | null;
}
