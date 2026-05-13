import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../../common/config/app-config.service';
import { fetchJsonWithTimeout } from '../../recommendation/utils/http-client.util';
import { SeoulBusClient } from '../../recommendation/integrations/seoul-bus.client';
import type {
  ArrivalPayload,
  BusProvider,
  ProviderResolveContext,
  RouteCandidate,
  StationCandidate,
} from '../realtime-bus.types';

@Injectable()
export class SeoulBusProvider implements BusProvider {
  readonly type = 'SEOUL' as const;
  readonly priority = 3;
  private readonly logger = new Logger(SeoulBusProvider.name);

  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly seoulBusClient: SeoulBusClient,
  ) {}

  async findStationCandidates(context: ProviderResolveContext): Promise<StationCandidate[]> {
    const arsId = (context.segment.startArsId ?? '').replace(/[^0-9]/g, '');
    if (!arsId) {
      return [];
    }

    const rows = await this.request('stationinfo/getStationByUid', { arsId });
    return rows
      .map((row) => ({
        provider: this.type,
        stationId: arsId,
        stationName: this.readString(row, ['stNm', 'stationNm', 'stationName']),
        arsId,
        lat: this.readNumber(row, ['gpsY', 'tmY']),
        lng: this.readNumber(row, ['gpsX', 'tmX']),
      }))
      .filter((item) => item.stationId && item.stationName);
  }

  async findRouteCandidates(
    station: StationCandidate,
    context: ProviderResolveContext,
  ): Promise<RouteCandidate[]> {
    const arsId = (context.segment.startArsId ?? '').replace(/[^0-9]/g, '');
    const rows = arsId
      ? await this.request('stationinfo/getStationByUid', { arsId })
      : await this.request('arrive/getArrInfoByRoute', { stId: station.stationId });

    return rows
      .map((row) => ({
        provider: this.type,
        routeId: this.readString(row, ['busRouteId', 'routeId', 'rtId']),
        routeName: this.readString(row, ['rtNm', 'busRouteAbrv', 'busNo']),
        direction: this.readString(row, ['adirection', 'stationNm1']),
      }))
      .filter((item, index, list) => list.findIndex((x) => x.routeId === item.routeId) === index)
      .filter((item) => item.routeId && item.routeName)
      .filter((item) => {
        const desired = context.segment.lineLabel?.trim();
        return !desired || item.routeName.includes(desired) || desired.includes(item.routeName);
      });
  }

  async getArrival(input: { stationId: string; routeId: string }): Promise<ArrivalPayload | null> {
    const arsId = input.stationId.replace(/[^0-9]/g, '');
    if (!arsId) {
      return null;
    }
    const arrival = await this.seoulBusClient.getArrivalByArsId(arsId, input.routeId);
    if (!arrival) {
      return null;
    }

    return {
      etaMinutes: Math.max(1, Math.round(arrival.arrivalSec / 60)),
      etaSeconds: Math.max(10, Math.round(arrival.arrivalSec)),
      updatedAt: new Date().toISOString(),
      rawStatus: 'LIVE',
    };
  }

  private async request(path: string, params: Record<string, string>): Promise<Record<string, unknown>[]> {
    const baseUrl = this.appConfigService.seoulBusApiUrl;
    const key = (this.appConfigService.seoulBusKey ?? '')
      .trim()
      .replace(/\r?\n/g, '')
      .replace(/\s+/g, '');
    if (!baseUrl || !key) {
      return [];
    }
    const query = new URLSearchParams({ ...params, serviceKey: key, resultType: 'json' });
    const url = `${baseUrl.replace(/\/$/, '')}/${path}?${query.toString()}`;
    const payload = await fetchJsonWithTimeout<Record<string, unknown>>(url, { method: 'GET' }, 2500);
    this.logIfHeaderError(payload, path, params);
    return this.unwrapRows(payload);
  }

  private logIfHeaderError(payload: Record<string, unknown>, operation: string, context: Record<string, string>) {
    const serviceResult = payload.ServiceResult as Record<string, unknown> | undefined;
    const msgHeader = (serviceResult?.msgHeader ?? payload.msgHeader) as
      | { headerCd?: string | number; headerMsg?: string; itemCount?: number }
      | undefined;
    const headerCd = msgHeader?.headerCd != null ? String(msgHeader.headerCd) : '';
    if (!headerCd || headerCd === '0') {
      return;
    }
    this.logger.warn(
      JSON.stringify({
        event: 'seoul_bus.provider_header_error',
        operation,
        headerCd,
        headerMsg: msgHeader?.headerMsg ?? null,
        itemCount: msgHeader?.itemCount ?? null,
        context,
      }),
    );
  }

  private unwrapRows(payload: Record<string, unknown>): Record<string, unknown>[] {
    const serviceResult = payload.ServiceResult as Record<string, unknown> | undefined;
    const msgBody = (serviceResult?.msgBody ?? payload.msgBody) as Record<string, unknown> | undefined;
    const itemList = msgBody?.itemList;
    if (Array.isArray(itemList)) {
      return itemList.filter((v): v is Record<string, unknown> => typeof v === 'object' && !!v);
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
}
