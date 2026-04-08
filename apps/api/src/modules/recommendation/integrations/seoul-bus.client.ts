import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../common/config/app-config.service';
import { SafeLogger } from '../../../common/logger/safe-logger.service';
import { fetchJsonWithTimeout } from '../utils/http-client.util';

interface SeoulApiEnvelope {
  msgBody?: unknown;
  ServiceResult?: {
    msgBody?: unknown;
  };
}

export interface NearestStation {
  stationId: string;
  stationName: string;
}

export interface SeoulBusArrivalResult {
  stationId: string;
  arrivalSecs?: number[];
  arrivalSec: number;
  selectedBusRoutes?: string[];
  arrivalListLength?: number;
  delayMinutes?: number;
  delayRisk: number;
  source: 'api' | 'fallback';
}

interface ArrivalEntry {
  routeId: string;
  arrivalSec: number;
}

@Injectable()
export class SeoulBusClient {
  private readonly stationCache = new Map<string, { expiresAt: number; value: NearestStation }>();
  private readonly arrivalCache = new Map<string, { expiresAt: number; value: SeoulBusArrivalResult }>();
  private readonly stationTtlMs = 180_000;
  private readonly arrivalTtlMs = 15_000;

  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly logger: SafeLogger,
  ) {}

  async getNearestStation(lat: number, lng: number): Promise<NearestStation | null> {
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const cached = this.stationCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const baseUrl = this.appConfigService.seoulBusApiUrl;
    const apiKey = this.appConfigService.seoulApiKey;
    if (!baseUrl || !apiKey) {
      return null;
    }

    try {
      const params = new URLSearchParams({
        serviceKey: apiKey,
        resultType: 'json',
        tmX: String(lng),
        tmY: String(lat),
      });
      const url = `${this.trimTrailingSlash(baseUrl)}/stationinfo/getStationByPos?${params.toString()}`;
      const raw = await fetchJsonWithTimeout<SeoulApiEnvelope>(url, { method: 'GET' }, 2500);

      const stations = this.extractStationRows(raw);
      const first = stations[0];
      if (!first) {
        return null;
      }

      const nearest: NearestStation = {
        stationId: first.stationId,
        stationName: first.stationName,
      };
      this.stationCache.set(cacheKey, { expiresAt: Date.now() + this.stationTtlMs, value: nearest });

      return nearest;
    } catch {
      return null;
    }
  }

  async getArrival(stationId: string, routeId?: string): Promise<SeoulBusArrivalResult> {
    const cacheKey = `${stationId}:${routeId ?? 'all'}`;
    const cached = this.arrivalCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      this.logArrival(
        cached.value.stationId,
        cached.value.arrivalSecs ?? [cached.value.arrivalSec],
        cached.value.arrivalSec,
        cached.value.delayRisk,
        routeId ? [routeId] : [],
        1,
      );
      return cached.value;
    }

    const baseUrl = this.appConfigService.seoulBusApiUrl;
    const apiKey = this.appConfigService.seoulApiKey;
    if (!baseUrl || !apiKey) {
      const fallback = this.fallback(stationId);
      this.arrivalCache.set(cacheKey, { expiresAt: Date.now() + this.arrivalTtlMs, value: fallback });
      this.logArrival(
        fallback.stationId,
        fallback.arrivalSecs ?? [fallback.arrivalSec],
        fallback.arrivalSec,
        fallback.delayRisk,
        [],
        0,
      );
      return fallback;
    }

    try {
      const params = new URLSearchParams({
        serviceKey: apiKey,
        resultType: 'json',
        stId: stationId,
      });
      const url = `${this.trimTrailingSlash(baseUrl)}/arrive/getArrInfoByRoute?${params.toString()}`;
      const raw = await fetchJsonWithTimeout<SeoulApiEnvelope>(url, { method: 'GET' }, 2500);
      const entriesByRoute = this.extractArrivalEntries(raw, routeId);
      const entries = entriesByRoute.length > 0 ? entriesByRoute : this.extractArrivalEntries(raw);
      if (entries.length === 0) {
        throw new Error('No arrival seconds in response');
      }

      const topCount = Math.min(3, Math.max(2, entries.length));
      const top = entries.sort((a, b) => a.arrivalSec - b.arrivalSec).slice(0, topCount);
      while (top.length < 2 && top.length > 0) {
        top.push(top[0]);
      }
      const arrivalSecs = top.map((item) => item.arrivalSec);
      const averageArrivalSec = Math.round(
        top.reduce((sum, item) => sum + item.arrivalSec, 0) / top.length,
      );
      const avgDelayMinutes = averageArrivalSec / 60;
      const delayRisk = this.toDelayRiskByMinutes(avgDelayMinutes);
      const selectedBusRoutes = [...new Set(top.map((item) => item.routeId))];

      const result: SeoulBusArrivalResult = {
        stationId,
        arrivalSecs,
        arrivalSec: averageArrivalSec,
        arrivalListLength: entries.length,
        selectedBusRoutes,
        delayMinutes: Number(avgDelayMinutes.toFixed(2)),
        delayRisk: Number(delayRisk.toFixed(3)),
        source: 'api',
      };

      this.arrivalCache.set(cacheKey, { expiresAt: Date.now() + this.arrivalTtlMs, value: result });
      this.logArrival(
        result.stationId,
        result.arrivalSecs ?? [],
        result.arrivalSec,
        result.delayRisk,
        selectedBusRoutes,
        entries.length,
      );
      return result;
    } catch {
      const fallback = this.fallback(stationId);
      this.arrivalCache.set(cacheKey, { expiresAt: Date.now() + this.arrivalTtlMs, value: fallback });
      this.logArrival(
        fallback.stationId,
        fallback.arrivalSecs ?? [fallback.arrivalSec],
        fallback.arrivalSec,
        fallback.delayRisk,
        [],
        0,
      );
      return fallback;
    }
  }

  private toDelayRiskByMinutes(delayMinutes: number): number {
    if (delayMinutes <= 2) {
      return 0.05;
    }
    if (delayMinutes <= 5) {
      return 0.15;
    }
    if (delayMinutes <= 10) {
      return 0.25;
    }
    return 0.35;
  }

  private fallback(stationId: string): SeoulBusArrivalResult {
    return {
      stationId,
      arrivalSecs: [240, 240],
      arrivalSec: 240,
      arrivalListLength: 0,
      selectedBusRoutes: [],
      delayMinutes: 4,
      delayRisk: 0.15,
      source: 'fallback',
    };
  }

  private extractStationRows(raw: SeoulApiEnvelope): Array<{ stationId: string; stationName: string }> {
    const candidates = this.unwrapRows(raw);
    const stations = candidates
      .map((row) => {
        const stationId =
          this.readString(row, ['stationId', 'stId', 'arsId', 'stationid']) ?? '';
        const stationName = this.readString(row, ['stationNm', 'stationName', 'stNm']) ?? '';
        if (!stationId) {
          return null;
        }
        return { stationId, stationName: stationName || stationId };
      })
      .filter((item): item is { stationId: string; stationName: string } => item !== null);

    return stations;
  }

  private extractArrivalEntries(raw: SeoulApiEnvelope, routeId?: string): ArrivalEntry[] {
    const rows = this.unwrapRows(raw);
    const entries: ArrivalEntry[] = [];

    for (const row of rows) {
      const rowRouteId =
        this.readString(row, ['busRouteId', 'routeId', 'rtId']) ?? 'unknown-route';

      if (routeId && rowRouteId !== routeId) {
        continue;
      }

      const secondsFromMessages = [
        this.parseArrivalSecFromMessage(
          this.readString(row, ['arrmsg1', 'arrmsg', 'arrivalMessage1', 'arrivalMessage']),
        ),
        this.parseArrivalSecFromMessage(this.readString(row, ['arrmsg2', 'arrivalMessage2'])),
      ];

      const candidates = [
        this.readNumber(row, ['arrmsgSec']),
        this.readNumber(row, ['arrmsgSec1', 'arrmsg1Sec']),
        this.readNumber(row, ['arrmsgSec2', 'arrmsg2Sec']),
        this.readNumber(row, ['arrivalSec', 'arrivalTime', 'arriveIn']),
        ...secondsFromMessages,
      ]
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
        .map((value) => Math.max(0, Math.round(value)));

      for (const arrivalSec of candidates) {
        entries.push({
          routeId: rowRouteId,
          arrivalSec,
        });
      }
    }

    return entries;
  }

  private parseArrivalSecFromMessage(message: string | null): number | null {
    if (!message) {
      return null;
    }

    const minuteSecond = message.match(/(\d+)\s*분\s*(\d+)\s*초/);
    if (minuteSecond) {
      const minutes = Number(minuteSecond[1]);
      const seconds = Number(minuteSecond[2]);
      if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
        return minutes * 60 + seconds;
      }
    }

    const minuteOnly = message.match(/(\d+)\s*분/);
    if (minuteOnly) {
      const minutes = Number(minuteOnly[1]);
      if (Number.isFinite(minutes)) {
        return minutes * 60;
      }
    }

    const secondOnly = message.match(/(\d+)\s*초/);
    if (secondOnly) {
      const seconds = Number(secondOnly[1]);
      if (Number.isFinite(seconds)) {
        return seconds;
      }
    }

    return null;
  }

  private unwrapRows(raw: SeoulApiEnvelope): Record<string, unknown>[] {
    const body = raw.msgBody ?? raw.ServiceResult?.msgBody ?? {};
    const maybeRows = (body as Record<string, unknown>).itemList ?? (body as Record<string, unknown>).itemlist;

    if (Array.isArray(maybeRows)) {
      return maybeRows.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object');
    }

    if (maybeRows && typeof maybeRows === 'object') {
      return [maybeRows as Record<string, unknown>];
    }

    return [];
  }

  private readString(row: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
      if (typeof value === 'number') {
        return String(value);
      }
    }
    return null;
  }

  private readNumber(row: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
    return null;
  }

  private logArrival(
    stationId: string,
    arrivalSecs: number[],
    arrivalSec: number,
    delayRisk: number,
    selectedBusRoute: string[],
    arrivalListLength: number,
  ) {
    this.logger.log(
      {
        event: 'seoul_bus.arrival',
        stationId,
        arrivalListLength,
        arrivalSecs,
        selectedBusRoute,
        avgDelayMinutes: Number((arrivalSec / 60).toFixed(2)),
        delayRisk,
      },
      SeoulBusClient.name,
    );
  }

  private trimTrailingSlash(url: string) {
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }
}
