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
export class GyeonggiBusProvider implements BusProvider {
  readonly type = 'GYEONGGI' as const;
  readonly priority = 2;

  constructor(private readonly appConfigService: AppConfigService) {}

  async findStationCandidates(context: ProviderResolveContext): Promise<StationCandidate[]> {
    const keyword = this.readDigits(context.segment.startArsId) || (context.segment.startName ?? '').trim();
    if (!keyword) {
      return [];
    }

    const rows = await this.request('/busstationservice/v2/getBusStationListv2', {
      keyword,
      format: 'json',
    });

    return rows
      .map((row) => ({
        provider: this.type,
        stationId: this.readString(row, ['stationId', 'station_id']),
        stationName: this.readString(row, ['stationName', 'stationNm', 'mobileNo']),
        arsId: this.readString(row, ['mobileNo']),
        lat: this.readNumber(row, ['x', 'gpsY']),
        lng: this.readNumber(row, ['y', 'gpsX']),
      }))
      .filter((item) => item.stationId && item.stationName);
  }

  async findRouteCandidates(station: StationCandidate, context: ProviderResolveContext): Promise<RouteCandidate[]> {
    void context;
    const rows = await this.request('/busarrivalservice/v2/getBusArrivalListv2', {
      stationId: station.stationId,
      format: 'json',
    });

    return rows
      .map((row) => ({
        provider: this.type,
        routeId: this.readString(row, ['routeId', 'route_id']),
        routeName: this.readString(row, ['routeName', 'routeNm']),
        direction: this.readString(row, ['turnSeq', 'turnYn']),
      }))
      .filter((item) => item.routeId && item.routeName);
  }

  async getArrival(input: { stationId: string; routeId: string }): Promise<ArrivalPayload | null> {
    const rows = await this.request('/busarrivalservice/v2/getBusArrivalListv2', {
      stationId: input.stationId,
      format: 'json',
    });

    const matched = rows.find((row) => this.readString(row, ['routeId', 'route_id']) === input.routeId);
    if (!matched) {
      return null;
    }

    const etaMinutes = this.readNumber(matched, ['predictTime1', 'locationNo1']);
    if (typeof etaMinutes !== 'number' || !Number.isFinite(etaMinutes)) {
      return null;
    }

    return {
      etaMinutes: Math.max(1, Math.round(etaMinutes)),
      etaSeconds: Math.max(10, Math.round(etaMinutes * 60)),
      updatedAt: new Date().toISOString(),
      rawStatus: 'LIVE',
    };
  }

  private async request(path: string, params: Record<string, string>): Promise<Record<string, unknown>[]> {
    const baseUrl = this.appConfigService.gyeonggiBusApiUrl;
    const key = this.appConfigService.gyeonggiBusKey;
    if (!baseUrl || !key) {
      return [];
    }

    const query = new URLSearchParams({ ...params, serviceKey: key });
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
    const msgBody = response?.msgBody as Record<string, unknown> | undefined;
    const itemList = msgBody?.busArrivalList ?? msgBody?.busStationList ?? msgBody?.itemList;

    if (Array.isArray(itemList)) {
      return itemList.filter((item): item is Record<string, unknown> => typeof item === 'object' && !!item);
    }
    if (itemList && typeof itemList === 'object') {
      return [itemList as Record<string, unknown>];
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
