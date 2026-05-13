/**
 * 서울 열린데이터광장 버스 API
 * 발급: https://data.seoul.go.kr
 * API: 버스노선 경유정류소 목록 조회 (getRoutePathList)
 * 응답: 정류장 순서대로 gpsX(경도), gpsY(위도) 반환
 */

import { LatLng } from './routeGeometry/types';

const SEOUL_BUS_API_KEY = process.env.EXPO_PUBLIC_SEOUL_BUS_API_KEY ?? '';
const BASE_URL = 'http://ws.bus.go.kr/api/rest/busRouteInfo';

interface SeoulRoutePathItem {
  busRouteId?: string;
  gpsX?: string;
  gpsY?: string;
  seq?: string;
}

interface SeoulStationItem {
  busRouteId?: string;
  busRouteNm?: string;
  gpsX?: string;
  gpsY?: string;
  seq?: string;
  station?: string;
  stationNm?: string;
  stationNo?: string;
  stationId?: string;
  arsId?: string;
}

interface SeoulBusResponse<T> {
  msgBody?: {
    itemList?: T[] | T;
  };
}

export interface SeoulBusStation {
  id?: string;
  name?: string;
  seq?: number;
  lat: number;
  lng: number;
}

function toItemArray<T>(value: T[] | T | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * getRoutePathList 기반 노선 전체 geometry
 */
export async function fetchSeoulBusRoutePathGeometry(busRouteId: string): Promise<LatLng[]> {
  if (!SEOUL_BUS_API_KEY) {
    throw new Error('EXPO_PUBLIC_SEOUL_BUS_API_KEY is missing');
  }

  const url =
    `${BASE_URL}/getRoutePathList` +
    `?ServiceKey=${SEOUL_BUS_API_KEY}` +
    `&busRouteId=${busRouteId}` +
    `&resultType=json`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Seoul Bus API error: ${response.status}`);
  }

  const data = (await response.json()) as SeoulBusResponse<SeoulRoutePathItem>;
  const items = toItemArray(data.msgBody?.itemList);

  const sorted = [...items].sort((a, b) => Number(a.seq ?? 0) - Number(b.seq ?? 0));

  return sorted
    .map((point) => {
      const lat = toNumber(point.gpsY);
      const lng = toNumber(point.gpsX);
      if (lat === null || lng === null) {
        return null;
      }
      return {
        latitude: lat,
        longitude: lng,
      };
    })
    .filter((point): point is LatLng => Boolean(point));
}

/**
 * getStaionByRoute 기반 노선 경유 정류장 목록
 */
export async function fetchSeoulStationsByRoute(busRouteId: string): Promise<SeoulBusStation[]> {
  if (!SEOUL_BUS_API_KEY) {
    throw new Error('EXPO_PUBLIC_SEOUL_BUS_API_KEY is missing');
  }

  const url =
    `${BASE_URL}/getStaionByRoute` +
    `?ServiceKey=${SEOUL_BUS_API_KEY}` +
    `&busRouteId=${busRouteId}` +
    `&resultType=json`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Seoul Bus Station API error: ${response.status}`);
  }

  const data = (await response.json()) as SeoulBusResponse<SeoulStationItem>;
  const items = toItemArray(data.msgBody?.itemList);

  const parsed = items
    .map((station): SeoulBusStation | null => {
      const lat = toNumber(station.gpsY);
      const lng = toNumber(station.gpsX);
      if (lat === null || lng === null) {
        return null;
      }
      return {
        id:
          (typeof station.stationId === 'string' && station.stationId) ||
          (typeof station.arsId === 'string' && station.arsId) ||
          undefined,
        name:
          (typeof station.stationNm === 'string' && station.stationNm) ||
          (typeof station.station === 'string' && station.station) ||
          undefined,
        seq: toNumber(station.seq) ?? undefined,
        lat,
        lng,
      };
    })
    .filter((station): station is SeoulBusStation => station !== null);

  return parsed.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
}

/**
 * 하위 호환: 기존 호출부가 있으면 routePath geometry를 그대로 반환한다.
 */
export async function fetchSeoulBusRouteStops(busRouteId: string): Promise<LatLng[]> {
  return fetchSeoulBusRoutePathGeometry(busRouteId);
}
