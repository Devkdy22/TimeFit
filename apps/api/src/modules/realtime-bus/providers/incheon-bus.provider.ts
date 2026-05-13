import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../common/config/app-config.service';
import { fetchJsonWithTimeout } from '../../recommendation/utils/http-client.util';
import type {
  ArrivalPayload,
  BusProvider,
  ProviderResolveContext,
  RouteCandidate,
  StationCandidate,
} from '../realtime-bus.types';

@Injectable()
export class IncheonBusProvider implements BusProvider {
  readonly type = 'INCHEON' as const;
  readonly priority = 1;

  constructor(private readonly appConfigService: AppConfigService) {}

  async findStationCandidates(context: ProviderResolveContext): Promise<StationCandidate[]> {
    // 인천은 현재 승인된 도착/위치 API 조합에서 ARS 기반 정류소 검색 API가 직접적이지 않아
    // ODsay stationId를 1차 후보로 사용한다.
    const stationId = (context.segment.startStationId ?? '').trim();
    const stationName = (context.segment.startName ?? '').trim();
    if (!stationId || !stationName) {
      return [];
    }

    return [
      {
        provider: this.type,
        stationId,
        stationName,
        arsId: this.readDigits(context.segment.startArsId),
        lat: context.segment.startLat,
        lng: context.segment.startLng,
      },
    ];
  }

  async findRouteCandidates(station: StationCandidate, context: ProviderResolveContext): Promise<RouteCandidate[]> {
    void context;
    const rows = await this.request('/busArrivalService/getAllRouteBusArrivalList', {
      pageNo: '1',
      numOfRows: '100',
      bstopId: station.stationId,
    });

    return rows
      .map((row) => ({
        provider: this.type,
        routeId: this.readString(row, ['ROUTEID', 'routeId']),
        routeName: this.readString(row, ['ROUTENO', 'routeNo']),
        direction: this.readString(row, ['DIRCD', 'dirCd']),
      }))
      .filter((item) => item.routeId && item.routeName);
  }

  async getArrival(input: { stationId: string; routeId: string }): Promise<ArrivalPayload | null> {
    const rows = await this.request('/busArrivalService/getAllRouteBusArrivalList', {
      pageNo: '1',
      numOfRows: '100',
      bstopId: input.stationId,
    });

    const matched = rows.find((row) => this.readString(row, ['ROUTEID', 'routeId']) === input.routeId);
    if (!matched) {
      return null;
    }

    const sec = this.readNumber(matched, ['ARRIVALESTIMATETIME', 'arrivalEstimateTime']);
    if (typeof sec !== 'number' || !Number.isFinite(sec)) {
      return null;
    }

    return {
      etaMinutes: Math.max(1, Math.round(sec / 60)),
      etaSeconds: Math.max(10, Math.round(sec)),
      updatedAt: new Date().toISOString(),
      rawStatus: 'LIVE',
    };
  }

  private async request(path: string, params: Record<string, string>): Promise<Record<string, unknown>[]> {
    const baseUrl = this.appConfigService.incheonBusApiUrl;
    const key = this.appConfigService.incheonBusKey;
    if (!baseUrl || !key) {
      return [];
    }

    const query = new URLSearchParams({ ...params, ServiceKey: key });
    const url = `${baseUrl.replace(/\/$/, '')}${path}?${query.toString()}`;

    try {
      const payload = await fetchJsonWithTimeout<Record<string, unknown>>(url, { method: 'GET' }, 2500);
      return this.unwrapRows(payload);
    } catch {
      return [];
    }
  }

  private unwrapRows(payload: Record<string, unknown>): Record<string, unknown>[] {
    const response = payload.response as Record<string, unknown> | undefined;
    const body = response?.body as Record<string, unknown> | undefined;
    const msgBody = body?.items ?? payload.msgBody;

    if (Array.isArray(msgBody)) {
      return msgBody.filter((item): item is Record<string, unknown> => typeof item === 'object' && !!item);
    }
    if (msgBody && typeof msgBody === 'object') {
      const items = (msgBody as Record<string, unknown>).item;
      if (Array.isArray(items)) {
        return items.filter((item): item is Record<string, unknown> => typeof item === 'object' && !!item);
      }
      if (items && typeof items === 'object') {
        return [items as Record<string, unknown>];
      }
      return [msgBody as Record<string, unknown>];
    }
    return [];
  }

  private readString(source: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = source[key];
      if (value === undefined || value === null) {
        continue;
      }
      const text = String(value).trim();
      if (text) {
        return text;
      }
    }
    return '';
  }

  private readNumber(source: Record<string, unknown>, keys: string[]): number | undefined {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string') {
        const n = Number(value);
        if (Number.isFinite(n)) {
          return n;
        }
      }
    }
    return undefined;
  }

  private readDigits(value?: string): string {
    return (value ?? '').replace(/[^0-9]/g, '');
  }
}
