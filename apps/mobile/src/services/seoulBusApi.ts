import { API_BASE_URL } from './api/client';
import { LatLng } from './routeGeometry/types';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface SeoulBusStation {
  id?: string;
  name?: string;
  seq?: number;
  lat: number;
  lng: number;
}

async function readApiEnvelope<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!payload.success) {
    throw new Error('API returned unsuccessful response');
  }
  return payload.data;
}

export async function fetchSeoulBusRouteIdsByRouteNo(routeNo: string): Promise<string[]> {
  const normalized = routeNo.trim();
  if (!normalized) {
    return [];
  }
  const params = new URLSearchParams({ routeNo: normalized });
  const response = await fetch(`${API_BASE_URL}/kakao-local/bus/routes?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Seoul Bus route proxy error: ${response.status}`);
  }
  const data = await readApiEnvelope<{ routeIds: string[] }>(response);
  return data.routeIds;
}

export async function fetchSeoulBusRoutePathGeometry(busRouteId: string): Promise<LatLng[]> {
  const normalized = busRouteId.trim();
  if (!normalized) {
    return [];
  }
  const params = new URLSearchParams({ busRouteId: normalized });
  const response = await fetch(`${API_BASE_URL}/kakao-local/bus/route-path?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Seoul Bus route path proxy error: ${response.status}`);
  }
  const data = await readApiEnvelope<{ points: Array<{ lat: number; lng: number }> }>(response);
  return data.points
    .map((point) => ({ latitude: point.lat, longitude: point.lng }))
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
}

export async function fetchSeoulStationsByRoute(busRouteId: string): Promise<SeoulBusStation[]> {
  const normalized = busRouteId.trim();
  if (!normalized) {
    return [];
  }
  const params = new URLSearchParams({ busRouteId: normalized });
  const response = await fetch(`${API_BASE_URL}/kakao-local/bus/stations?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Seoul Bus stations proxy error: ${response.status}`);
  }
  const data = await readApiEnvelope<{
    stations: Array<{
      stationId?: string;
      arsId?: string;
      stationName: string;
      seq?: number;
      lat?: number;
      lng?: number;
    }>;
  }>(response);

  return data.stations
    .map((station): SeoulBusStation | null => {
      if (typeof station.lat !== 'number' || typeof station.lng !== 'number') {
        return null;
      }
      const id = station.stationId ?? station.arsId;
      return {
        ...(id ? { id } : {}),
        name: station.stationName,
        ...(typeof station.seq === 'number' ? { seq: station.seq } : {}),
        lat: station.lat,
        lng: station.lng,
      };
    })
    .filter((station): station is SeoulBusStation => station !== null);
}

export async function fetchSeoulBusRouteStops(busRouteId: string): Promise<LatLng[]> {
  return fetchSeoulBusRoutePathGeometry(busRouteId);
}
