import { LatLng, RouteSegment } from './routeGeometry/types';

interface OdsayLane {
  busID?: number | string;
  busNo?: string;
  type?: number;
  name?: string;
}

interface OdsayStation {
  stationName?: string;
  x?: number | string;
  y?: number | string;
  localStationID?: number | string;
}

interface OdsaySubPath {
  trafficType?: number | string;
  startX?: number | string;
  startY?: number | string;
  endX?: number | string;
  endY?: number | string;
  startName?: string;
  endName?: string;
  lane?: OdsayLane[];
  passStopList?: {
    stations?: OdsayStation[];
  };
}

/**
 * ODsay 경로검색 API 응답의 특정 경로 후보를 RouteSegment[]로 변환
 */
export function parseOdsayResponse(path: unknown): RouteSegment[] {
  const subPaths = extractSubPaths(path);
  const segments: RouteSegment[] = [];

  for (let i = 0; i < subPaths.length; i += 1) {
    const sub = subPaths[i];
    const trafficType = Number(sub.trafficType);

    if (![1, 2, 3].includes(trafficType)) {
      continue;
    }

    const segmentId = `seg-${i}-${trafficType}`;

    if (trafficType === 3) {
      segments.push({
        segmentId,
        mode: 'WALK',
        startCoord: odsayCoordToLatLng(sub.startX, sub.startY),
        endCoord: odsayCoordToLatLng(sub.endX, sub.endY),
      });
      continue;
    }

    if (trafficType === 2) {
      const lane = sub.lane?.[0];
      const passStopList = sub.passStopList?.stations ?? [];

      segments.push({
        segmentId,
        mode: 'BUS',
        startCoord: odsayCoordToLatLng(sub.startX, sub.startY),
        endCoord: odsayCoordToLatLng(sub.endX, sub.endY),
        busRouteId: lane?.busID ? String(lane.busID) : undefined,
        busRouteNm: lane?.busNo,
        busColor: lane?.type ? busTypeToColor(lane.type) : undefined,
        startStopCoord: passStopList[0] ? odsayCoordToLatLng(passStopList[0].x, passStopList[0].y) : undefined,
        endStopCoord: passStopList[passStopList.length - 1]
          ? odsayCoordToLatLng(passStopList[passStopList.length - 1].x, passStopList[passStopList.length - 1].y)
          : undefined,
        passStops: passStopList.map((s) => ({
          name: s.stationName ?? '',
          coord: odsayCoordToLatLng(s.x, s.y),
          localStopId: s.localStationID ? String(s.localStationID) : undefined,
        })),
      });
      continue;
    }

    const lane = sub.lane?.[0];
    const passStopList = sub.passStopList?.stations ?? [];

    segments.push({
      segmentId,
      mode: 'SUBWAY',
      startCoord: odsayCoordToLatLng(sub.startX, sub.startY),
      endCoord: odsayCoordToLatLng(sub.endX, sub.endY),
      subwayLineName: lane?.name,
      subwayLineColor: undefined,
      startStationName: sub.startName,
      endStationName: sub.endName,
      startStationCoord: passStopList[0] ? odsayCoordToLatLng(passStopList[0].x, passStopList[0].y) : undefined,
      endStationCoord: passStopList[passStopList.length - 1]
        ? odsayCoordToLatLng(passStopList[passStopList.length - 1].x, passStopList[passStopList.length - 1].y)
        : undefined,
    });
  }

  return segments;
}

function extractSubPaths(path: unknown): OdsaySubPath[] {
  if (!path || typeof path !== 'object') return [];
  const maybeSubPath = (path as { subPath?: unknown }).subPath;
  if (!Array.isArray(maybeSubPath)) return [];
  return maybeSubPath as OdsaySubPath[];
}

function odsayCoordToLatLng(x: string | number | undefined, y: string | number | undefined): LatLng {
  return {
    longitude: parseFloat(String(x ?? 0)),
    latitude: parseFloat(String(y ?? 0)),
  };
}

function busTypeToColor(type: number): string {
  const colors: Record<number, string> = {
    1: '#1464A5',
    2: '#3CB371',
    3: '#F4A227',
    4: '#F01E1E',
    11: '#1464A5',
  };

  return colors[type] ?? '#1976D2';
}
