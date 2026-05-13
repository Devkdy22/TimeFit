/**
 * 공공데이터포털 국토교통부 버스 API (경기, 인천 포함 전국)
 * 발급: https://www.data.go.kr
 * 서비스: 국토교통부_버스노선 정보 조회 서비스
 *
 * 서울 busRouteId가 실패했을 때 fallback으로 사용한다.
 */

import { LatLng } from './routeGeometry/types';

const PUBLIC_DATA_API_KEY = process.env.EXPO_PUBLIC_DATA_API_KEY ?? '';

interface PublicDataRouteStop {
  stationSeq?: string | number;
  latitude?: string | number;
  longitude?: string | number;
}

interface PublicDataResponse {
  response?: {
    body?: {
      items?: {
        item?: PublicDataRouteStop | PublicDataRouteStop[];
      };
    };
  };
}

export async function fetchPublicBusRouteStops(busRouteId: string, cityCode = '11'): Promise<LatLng[]> {
  if (!PUBLIC_DATA_API_KEY) {
    throw new Error('EXPO_PUBLIC_DATA_API_KEY is missing');
  }

  const url =
    `https://apis.data.go.kr/1613000/BusRouteInfoInqireService/getRouteAcctoThrghSttnList` +
    `?serviceKey=${PUBLIC_DATA_API_KEY}` +
    `&pageNo=1&numOfRows=200` +
    `&_type=json` +
    `&cityCode=${cityCode}` +
    `&routeId=${busRouteId}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`PublicData Bus API error: ${response.status}`);
  }

  const data = (await response.json()) as PublicDataResponse;
  const rawItems = data.response?.body?.items?.item;
  const list = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

  return list
    .sort((a, b) => Number(a.stationSeq ?? 0) - Number(b.stationSeq ?? 0))
    .map((item) => ({
      latitude: parseFloat(String(item.latitude ?? '')),
      longitude: parseFloat(String(item.longitude ?? '')),
    }))
    .filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude));
}
