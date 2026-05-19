/**
 * 서울 열린데이터광장 버스 API
 * 발급: https://data.seoul.go.kr
 * API: 버스노선 경유정류소 목록 조회 (getRoutePathList)
 * 응답: 정류장 순서대로 gpsX(경도), gpsY(위도) 반환
 */

import { LatLng } from './routeGeometry/types';

const BASE_URLS = ['https://ws.bus.go.kr/api/rest', 'http://ws.bus.go.kr/api/rest'] as const;

interface SeoulRoutePathItem {
  busRouteId?: string;
  busRouteNm?: string;
  busRouteAbrv?: string;
  rtNm?: string;
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

export async function fetchSeoulBusRouteIdsByRouteNo(routeNo: string): Promise<string[]> {
  const normalized = routeNo.trim();
  if (!normalized) {
    return [];
  }
  const apiKey = getSeoulBusApiKey();
  const params = new URLSearchParams({
    serviceKey: apiKey,
    strSrch: normalized,
    resultType: 'json',
  });
  const query = params.toString();
  const text = await fetchTextWithFallback(
    buildUrls(['/busRouteInfo/getBusRouteList'], query),
  );
  const trimmed = text.trim();
  let items: SeoulRoutePathItem[] = [];
  if (trimmed.startsWith('{')) {
    const data = JSON.parse(trimmed) as SeoulBusResponse<SeoulRoutePathItem>;
    items = toItemArray(data.msgBody?.itemList);
  } else {
    items = extractXmlBlocks(trimmed, 'itemList').map((block) => ({
      busRouteId: readXmlTag(block, 'busRouteId'),
      busRouteNm: readXmlTag(block, 'busRouteNm') ?? readXmlTag(block, 'rtNm'),
      rtNm: readXmlTag(block, 'rtNm'),
    }));
  }

  const compactInput = normalized.replace(/\s+/g, '').toUpperCase();
  const candidates = items
    .map((item) => ({
      id: (item.busRouteId ?? '').trim(),
      no: (item.busRouteNm ?? item.busRouteAbrv ?? item.rtNm ?? '')
        .replace(/\s+/g, '')
        .toUpperCase(),
    }))
    .filter((entry) => entry.id.length > 0);

  const exact = candidates
    .filter((entry) => entry.no === compactInput)
    .map((entry) => entry.id);
  if (exact.length > 0) {
    return Array.from(new Set(exact)).slice(0, 8);
  }

  const partial = candidates
    .filter((entry) => entry.no.includes(compactInput) || compactInput.includes(entry.no))
    .map((entry) => entry.id);
  if (partial.length > 0) {
    return Array.from(new Set(partial)).slice(0, 8);
  }

  const fallback = candidates.map((entry) => entry.id);
  return Array.from(new Set(fallback)).slice(0, 8);
}

function getSeoulBusApiKey() {
  const key = process.env.EXPO_PUBLIC_SEOUL_BUS_API_KEY ?? '';
  if (!key) {
    throw new Error('EXPO_PUBLIC_SEOUL_BUS_API_KEY is missing');
  }
  return key;
}

function toItemArray<T>(value: T[] | T | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function readXmlTag(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match?.[1] ? decodeXml(match[1]).trim() : undefined;
}

function extractXmlBlocks(xml: string, tag: string) {
  const blocks: string[] = [];
  const pattern = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let match: RegExpExecArray | null = pattern.exec(xml);
  while (match) {
    blocks.push(match[1]);
    match = pattern.exec(xml);
  }
  return blocks;
}

async function fetchTextWithFallback(urls: string[]) {
  let lastError: Error | null = null;
  for (const url of urls) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), 2500);
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        lastError = new Error(`Seoul Bus API error: ${response.status}`);
        continue;
      }
      return await response.text();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
  throw lastError ?? new Error('Seoul Bus API request failed');
}

function buildUrls(paths: string[], query: string) {
  const urls: string[] = [];
  for (const baseUrl of BASE_URLS) {
    for (const path of paths) {
      urls.push(`${baseUrl}${path}?${query}`);
    }
  }
  return urls;
}

function readHeaderMessageFromXml(xml: string) {
  const headerCd = readXmlTag(xml, 'headerCd');
  const headerMsg = readXmlTag(xml, 'headerMsg');
  return { headerCd, headerMsg };
}

/**
 * getRoutePathList 기반 노선 전체 geometry
 */
export async function fetchSeoulBusRoutePathGeometry(busRouteId: string): Promise<LatLng[]> {
  const apiKey = getSeoulBusApiKey();
  const params = new URLSearchParams({
    serviceKey: apiKey,
    busRouteId,
    resultType: 'json',
  });
  const query = params.toString();
  const text = await fetchTextWithFallback(
    buildUrls(
      ['/busRouteInfo/getRoutePathList', '/busRouteInfo/getRoutePath'],
      query,
    ),
  );

  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    const data = JSON.parse(trimmed) as SeoulBusResponse<SeoulRoutePathItem>;
    const items = toItemArray(data.msgBody?.itemList);
    return [...items]
      .sort((a, b) => Number(a.seq ?? 0) - Number(b.seq ?? 0))
      .map((point) => {
        const lat = toNumber(point.gpsY);
        const lng = toNumber(point.gpsX);
        if (lat === null || lng === null) return null;
        return { latitude: lat, longitude: lng };
      })
      .filter((point): point is LatLng => Boolean(point));
  }

  const header = readHeaderMessageFromXml(trimmed);
  const items = extractXmlBlocks(trimmed, 'itemList')
    .map((block) => ({
      seq: readXmlTag(block, 'seq'),
      gpsX: readXmlTag(block, 'gpsX'),
      gpsY: readXmlTag(block, 'gpsY'),
    }))
    .sort((a, b) => Number(a.seq ?? 0) - Number(b.seq ?? 0));
  if (items.length === 0) {
    console.warn('[RouteGeometry][BUS][ROUTEPATH_EMPTY_XML]', {
      busRouteId,
      headerCd: header.headerCd ?? null,
      headerMsg: header.headerMsg ?? null,
    });
  }

  return items
    .map((point) => {
      const lat = toNumber(point.gpsY);
      const lng = toNumber(point.gpsX);
      if (lat === null || lng === null) return null;
      return { latitude: lat, longitude: lng };
    })
    .filter((point): point is LatLng => Boolean(point));
}

/**
 * getStaionByRoute 기반 노선 경유 정류장 목록
 */
export async function fetchSeoulStationsByRoute(busRouteId: string): Promise<SeoulBusStation[]> {
  const apiKey = getSeoulBusApiKey();
  const params = new URLSearchParams({
    serviceKey: apiKey,
    busRouteId,
    resultType: 'json',
  });
  const query = params.toString();
  const text = await fetchTextWithFallback(
    buildUrls(
      ['/busRouteInfo/getStaionByRoute', '/busRouteInfo/getStationsByRouteList'],
      query,
    ),
  );

  const trimmed = text.trim();
  let items: SeoulStationItem[] = [];
  if (trimmed.startsWith('{')) {
    const data = JSON.parse(trimmed) as SeoulBusResponse<SeoulStationItem>;
    items = toItemArray(data.msgBody?.itemList);
  } else {
    const header = readHeaderMessageFromXml(trimmed);
    items = extractXmlBlocks(trimmed, 'itemList').map((block) => ({
      stationId: readXmlTag(block, 'station') ?? readXmlTag(block, 'stationId'),
      arsId: readXmlTag(block, 'arsId'),
      stationNm: readXmlTag(block, 'stationNm') ?? readXmlTag(block, 'station'),
      gpsX: readXmlTag(block, 'gpsX'),
      gpsY: readXmlTag(block, 'gpsY'),
      seq: readXmlTag(block, 'seq'),
    }));
    if (items.length === 0) {
      console.warn('[RouteGeometry][BUS][STATIONS_EMPTY_XML]', {
        busRouteId,
        headerCd: header.headerCd ?? null,
        headerMsg: header.headerMsg ?? null,
      });
    }
  }

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
