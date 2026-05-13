import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../common/config/app-config.service';
import { SafeLogger } from '../../../common/logger/safe-logger.service';
import { fetchJsonWithTimeout } from '../utils/http-client.util';

interface SeoulApiEnvelope {
  msgBody?: unknown;
  msgHeader?: {
    headerCd?: string | number;
    headerMsg?: string;
    itemCount?: number;
  };
  ServiceResult?: {
    msgHeader?: {
      headerCd?: string | number;
      headerMsg?: string;
      itemCount?: number;
    };
    msgBody?: unknown;
  };
}

export interface NearestStation {
  stationId: string;
  stationName: string;
}

export interface NearbyStation extends NearestStation {}

export interface SeoulBusArrivalResult {
  stationId: string;
  arrivalSecs?: number[];
  arrivalItems?: Array<{ routeNo: string; routeId: string; arrivalSec: number }>;
  arrivalSec: number;
  selectedBusRoutes?: string[];
  arrivalListLength?: number;
  delayMinutes?: number;
  delayRisk: number;
  source: 'api' | 'fallback';
}

export interface SeoulBusVehiclePositionResult {
  routeId: string;
  vehicleCount: number;
  source: 'api' | 'fallback';
}

export interface SeoulStationUidProbe {
  arsId: string;
  routeNoOrId?: string;
  headerCd: string;
  headerMsg?: string;
  rowCount: number;
  matchedEntryCount: number;
}

export interface SeoulBusRouteStation {
  stationId?: string;
  arsId?: string;
  stationName: string;
  seq?: number;
}

interface ArrivalEntry {
  routeId: string;
  routeNo?: string;
  arrivalSec: number;
}

interface StationUidArrivalEntry {
  routeNo: string;
  routeId: string;
  arrivalSec: number;
}

@Injectable()
export class SeoulBusClient {
  private readonly stationCache = new Map<string, { expiresAt: number; value: NearestStation }>();
  private readonly arrivalCache = new Map<string, { expiresAt: number; value: SeoulBusArrivalResult }>();
  private readonly arrivalByStationInFlight = new Map<string, Promise<SeoulBusArrivalResult>>();
  private readonly arrivalByArsInFlight = new Map<string, Promise<SeoulBusArrivalResult | null>>();
  private readonly stationTtlMs = 180_000;
  private readonly arrivalTtlMs = 15_000;
  private busKeyProbeLogged = false;

  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly logger: SafeLogger,
  ) {}

  async getNearestStation(lat: number, lng: number): Promise<NearestStation | null> {
    const stations = await this.getNearbyStations(lat, lng);
    return stations[0] ?? null;
  }

  async getNearbyStations(lat: number, lng: number, limit = 5): Promise<NearbyStation[]> {
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const cached = this.stationCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return [cached.value];
    }

    const baseUrl = this.appConfigService.seoulBusApiUrl;
    const apiKey = this.getBusApiKey();
    if (!baseUrl || !apiKey) {
      return [];
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
      this.logIfHeaderError(raw, 'stationinfo/getStationByPos', { tmX: lng, tmY: lat });

      const stations = this.extractStationRows(raw);
      const sliced = stations.slice(0, Math.max(1, Math.min(10, limit)));
      const first = sliced[0];
      if (!first) {
        return [];
      }

      const nearest: NearestStation = {
        stationId: first.stationId,
        stationName: first.stationName,
      };
      this.stationCache.set(cacheKey, { expiresAt: Date.now() + this.stationTtlMs, value: nearest });
      return sliced.map((station) => ({
        stationId: station.stationId,
        stationName: station.stationName,
      }));
    } catch (error) {
      this.logger.warn(
        {
          event: 'seoul_bus.request.exception',
          operation: 'stationinfo/getStationByPos',
          message: error instanceof Error ? error.message : String(error),
        },
        SeoulBusClient.name,
      );
      return [];
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
    const inFlight = this.arrivalByStationInFlight.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const task = (async (): Promise<SeoulBusArrivalResult> => {
      const baseUrl = this.appConfigService.seoulBusApiUrl;
      const apiKey = this.getBusApiKey();
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
        this.logIfHeaderError(raw, 'arrive/getArrInfoByRoute', { stId: stationId, routeId: routeId ?? null });
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
      const selectedBusRoutes = [...new Set(top.map((item) => item.routeNo || item.routeId))];

      const result: SeoulBusArrivalResult = {
        stationId,
        arrivalSecs,
        arrivalItems: entries
          .sort((a, b) => a.arrivalSec - b.arrivalSec)
          .slice(0, 20)
          .map((entry) => ({
            routeNo: entry.routeNo ?? '',
            routeId: entry.routeId,
            arrivalSec: entry.arrivalSec,
          })),
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
      } catch (error) {
        this.logger.warn(
          {
            event: 'seoul_bus.request.exception',
            operation: 'arrive/getArrInfoByRoute',
            message: error instanceof Error ? error.message : String(error),
            stationId,
            routeId: routeId ?? null,
          },
          SeoulBusClient.name,
        );
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
    })();
    this.arrivalByStationInFlight.set(cacheKey, task);
    try {
      return await task;
    } finally {
      this.arrivalByStationInFlight.delete(cacheKey);
    }
  }

  async getVehiclePositions(routeId: string): Promise<SeoulBusVehiclePositionResult> {
    const baseUrl = this.appConfigService.seoulBusApiUrl;
    const apiKey = this.getBusApiKey();
    if (!baseUrl || !apiKey || !routeId) {
      return {
        routeId,
        vehicleCount: 0,
        source: 'fallback',
      };
    }

    try {
      const params = new URLSearchParams({
        serviceKey: apiKey,
        resultType: 'json',
        busRouteId: routeId,
      });
      const url = `${this.trimTrailingSlash(baseUrl)}/buspos/getBusPosByRtid?${params.toString()}`;
      const raw = await fetchJsonWithTimeout<SeoulApiEnvelope>(url, { method: 'GET' }, 2500);
      this.logIfHeaderError(raw, 'buspos/getBusPosByRtid', { busRouteId: routeId });
      const rows = this.unwrapRows(raw);

      return {
        routeId,
        vehicleCount: rows.length,
        source: 'api',
      };
    } catch (error) {
      this.logger.warn(
        {
          event: 'seoul_bus.request.exception',
          operation: 'buspos/getBusPosByRtid',
          message: error instanceof Error ? error.message : String(error),
          busRouteId: routeId,
        },
        SeoulBusClient.name,
      );
      return {
        routeId,
        vehicleCount: 0,
        source: 'fallback',
      };
    }
  }

  async getArrivalByArsId(arsId: string, routeNoOrId?: string): Promise<SeoulBusArrivalResult | null> {
    const normalizedArsId = arsId.replace(/[^0-9]/g, '');
    if (!normalizedArsId) {
      return null;
    }

    const cacheKey = `ars:${normalizedArsId}:${routeNoOrId ?? 'all'}`;
    const cached = this.arrivalCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    const staleCached = cached?.value ?? null;
    const staleAllCached = this.arrivalCache.get(`ars:${normalizedArsId}:all`)?.value ?? null;
    const inFlight = this.arrivalByArsInFlight.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const baseUrl = this.appConfigService.seoulBusApiUrl;
    const apiKey = this.getBusApiKey();
    if (!baseUrl || !apiKey) {
      return null;
    }

    const task = (async (): Promise<SeoulBusArrivalResult | null> => {
    try {
      const params = new URLSearchParams({
        serviceKey: apiKey,
        resultType: 'json',
        arsId: normalizedArsId,
      });
      const url = `${this.trimTrailingSlash(baseUrl)}/stationinfo/getStationByUid?${params.toString()}`;
      const raw = await fetchJsonWithTimeout<SeoulApiEnvelope>(url, { method: 'GET' }, 2500);
      this.logIfHeaderError(raw, 'stationinfo/getStationByUid', {
        arsId: normalizedArsId,
        routeNoOrId: routeNoOrId ?? null,
      });
      if (this.isApiQuotaExceeded(raw)) {
        // 호출 한도 초과 시엔 직전 캐시를 재사용해 UI가 전부 "정보 없음"으로 붕괴되지 않게 한다.
        return staleCached ?? staleAllCached;
      }
      const rawRows = this.unwrapRows(raw);
      this.logger.log(
        {
          event: 'seoul_bus.station_uid.raw',
          arsId: normalizedArsId,
          requestedRouteNo: routeNoOrId ?? null,
          rowCount: rawRows.length,
          samples: rawRows.slice(0, 8).map((row) => ({
            busRouteAbrv: this.readString(row, ['busRouteAbrv', 'rtNm', 'busRouteNm', 'busNo']),
            busRouteId: this.readString(row, ['busRouteId', 'routeId', 'rtId']),
            arrmsg1: this.readString(row, ['arrmsg1', 'arrivalMessage1', 'arrivalMessage']),
            arrmsg2: this.readString(row, ['arrmsg2', 'arrivalMessage2']),
            arrmsgSec1: this.readNumber(row, ['arrmsgSec1', 'arrmsg1Sec']),
            arrmsgSec2: this.readNumber(row, ['arrmsgSec2', 'arrmsg2Sec']),
          })),
        },
        SeoulBusClient.name,
      );
      let entries = this.extractStationUidArrivalEntries(raw, routeNoOrId);
      if (entries.length === 0 && routeNoOrId) {
        entries = this.extractStationUidArrivalEntries(raw);
      }
      this.logger.log(
        {
          event: 'seoul_bus.station_uid.filtered',
          arsId: normalizedArsId,
          requestedRouteNo: routeNoOrId ?? null,
          entryCount: entries.length,
          sampleEntries: entries.slice(0, 6),
        },
        SeoulBusClient.name,
      );
      if (entries.length === 0) {
        const stationIdFromRows = this.readString(rawRows[0] ?? {}, ['stId', 'stationId', 'stationid']);
        if (stationIdFromRows) {
          this.logger.log(
            {
              event: 'seoul_bus.station_uid.fallback_arrive_by_stid',
              arsId: normalizedArsId,
              stationId: stationIdFromRows,
              routeNoOrId: routeNoOrId ?? null,
            },
            SeoulBusClient.name,
          );
          try {
            const byStation = await this.getArrival(stationIdFromRows, routeNoOrId);
            if (byStation.source === 'api') {
              const fallbackResult: SeoulBusArrivalResult = {
                ...byStation,
                stationId: normalizedArsId,
              };
              this.arrivalCache.set(cacheKey, {
                expiresAt: Date.now() + this.arrivalTtlMs,
                value: fallbackResult,
              });
              return fallbackResult;
            }
          } catch {
            // keep original flow and return null below
          }
        }
      }
      if (entries.length === 0) {
        if (staleCached || staleAllCached) {
          return staleCached ?? staleAllCached;
        }
        return null;
      }

      const top = entries.sort((a, b) => a.arrivalSec - b.arrivalSec).slice(0, 2);
      const arrivalSecs = top.map((item) => item.arrivalSec);
      const averageArrivalSec = Math.round(
        top.reduce((sum, item) => sum + item.arrivalSec, 0) / Math.max(1, top.length),
      );
      const avgDelayMinutes = averageArrivalSec / 60;
      const delayRisk = this.toDelayRiskByMinutes(avgDelayMinutes);

      const result: SeoulBusArrivalResult = {
        stationId: normalizedArsId,
        arrivalSecs,
        arrivalItems: entries
          .sort((a, b) => a.arrivalSec - b.arrivalSec)
          .slice(0, 20)
          .map((entry) => ({
            routeNo: entry.routeNo ?? '',
            routeId: entry.routeId,
            arrivalSec: entry.arrivalSec,
          })),
        arrivalSec: averageArrivalSec,
        arrivalListLength: entries.length,
        selectedBusRoutes: [...new Set(top.map((item) => item.routeNo || item.routeId))],
        delayMinutes: Number(avgDelayMinutes.toFixed(2)),
        delayRisk: Number(delayRisk.toFixed(3)),
        source: 'api',
      };
      this.arrivalCache.set(cacheKey, { expiresAt: Date.now() + this.arrivalTtlMs, value: result });
      return result;
    } catch (error) {
      this.logger.warn(
        {
          event: 'seoul_bus.request.exception',
          operation: 'stationinfo/getStationByUid',
          message: error instanceof Error ? error.message : String(error),
          arsId: normalizedArsId,
          routeNoOrId: routeNoOrId ?? null,
        },
        SeoulBusClient.name,
      );
      return staleCached ?? staleAllCached;
    }
    })();
    this.arrivalByArsInFlight.set(cacheKey, task);
    try {
      return await task;
    } finally {
      this.arrivalByArsInFlight.delete(cacheKey);
    }
  }

  private isApiQuotaExceeded(raw: SeoulApiEnvelope): boolean {
    const header = raw.ServiceResult?.msgHeader ?? raw.msgHeader;
    const headerCd = header?.headerCd != null ? String(header.headerCd) : '';
    const headerMsg = String(header?.headerMsg ?? '').toLowerCase();
    if (headerMsg.includes('인증모듈 에러코드(22)')) {
      return true;
    }
    if (headerMsg.includes('limited number of service requests exceeds error')) {
      return true;
    }
    // 일부 응답은 코드만 내려오기도 한다.
    if (headerCd === '7' && headerMsg.includes('key인증실패')) {
      return true;
    }
    return false;
  }

  async probeStationUid(arsId: string, routeNoOrId?: string): Promise<SeoulStationUidProbe | null> {
    const normalizedArsId = arsId.replace(/[^0-9]/g, '');
    if (!normalizedArsId) {
      return null;
    }
    const baseUrl = this.appConfigService.seoulBusApiUrl;
    const apiKey = this.getBusApiKey();
    if (!baseUrl || !apiKey) {
      return null;
    }
    try {
      const params = new URLSearchParams({
        serviceKey: apiKey,
        resultType: 'json',
        arsId: normalizedArsId,
      });
      const url = `${this.trimTrailingSlash(baseUrl)}/stationinfo/getStationByUid?${params.toString()}`;
      const raw = await fetchJsonWithTimeout<SeoulApiEnvelope>(url, { method: 'GET' }, 2500);
      const rows = this.unwrapRows(raw);
      const header = raw.ServiceResult?.msgHeader ?? raw.msgHeader;
      const entries = this.extractStationUidArrivalEntries(raw, routeNoOrId);
      return {
        arsId: normalizedArsId,
        routeNoOrId,
        headerCd: header?.headerCd != null ? String(header.headerCd) : '',
        headerMsg: header?.headerMsg,
        rowCount: rows.length,
        matchedEntryCount: entries.length,
      };
    } catch {
      return null;
    }
  }

  async getRouteStations(busRouteId: string): Promise<SeoulBusRouteStation[]> {
    const routeId = (busRouteId ?? '').trim();
    if (!routeId) {
      return [];
    }
    const baseUrl = this.appConfigService.seoulBusApiUrl;
    const apiKey = this.getBusApiKey();
    if (!baseUrl || !apiKey) {
      return [];
    }

    try {
      const params = new URLSearchParams({
        serviceKey: apiKey,
        resultType: 'json',
        busRouteId: routeId,
      });
      const url = `${this.trimTrailingSlash(baseUrl)}/busRouteInfo/getStaionByRoute?${params.toString()}`;
      const raw = await fetchJsonWithTimeout<SeoulApiEnvelope>(url, { method: 'GET' }, 3000);
      this.logIfHeaderError(raw, 'busRouteInfo/getStaionByRoute', { busRouteId: routeId });
      const rows = this.unwrapRows(raw);
      const stations = rows
        .map((row) => {
          const stationName = this.readString(row, ['stationNm', 'stationName', 'stNm']) ?? '';
          if (!stationName) {
            return null;
          }
          return {
            stationId: this.readString(row, ['station', 'stationId', 'stId']) ?? undefined,
            arsId: this.readString(row, ['arsId', 'arsID']) ?? undefined,
            stationName,
            seq: this.readNumber(row, ['seq', 'no', 'index']) ?? undefined,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
      return stations.sort((a, b) => {
        const aSeq = typeof a.seq === 'number' ? a.seq : Number.POSITIVE_INFINITY;
        const bSeq = typeof b.seq === 'number' ? b.seq : Number.POSITIVE_INFINITY;
        if (aSeq !== bSeq) {
          return aSeq - bSeq;
        }
        return a.stationName.localeCompare(b.stationName, 'ko');
      });
    } catch (error) {
      this.logger.warn(
        {
          event: 'seoul_bus.request.exception',
          operation: 'busRouteInfo/getStaionByRoute',
          message: error instanceof Error ? error.message : String(error),
          busRouteId: routeId,
        },
        SeoulBusClient.name,
      );
      return [];
    }
  }

  private logIfHeaderError(raw: SeoulApiEnvelope, operation: string, context: Record<string, unknown>) {
    const header = raw.ServiceResult?.msgHeader ?? raw.msgHeader;
    const headerCd = header?.headerCd != null ? String(header.headerCd) : '';
    if (!headerCd || headerCd === '0') {
      return;
    }
    this.logger.warn(
      {
        event: 'seoul_bus.api_header_error',
        operation,
        headerCd,
        headerMsg: header?.headerMsg ?? null,
        itemCount: header?.itemCount ?? null,
        ...context,
      },
      SeoulBusClient.name,
    );
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

  private getBusApiKey(): string {
    const configuredBusKey = (this.appConfigService.seoulBusKey ?? '')
      .trim()
      .replace(/\r?\n/g, '')
      .replace(/\s+/g, '');
    const configuredOpenKey = (this.appConfigService.seoulApiKey ?? '')
      .trim()
      .replace(/\r?\n/g, '')
      .replace(/\s+/g, '');
    // 버스 실시간은 버스 전용 키를 최우선 사용한다.
    // (SEOUL_OPEN/SEOUL_API_KEY는 등록 서비스가 다를 수 있어 인증모듈 에러코드(30) 유발 가능)
    const selectedRawKey = configuredBusKey || configuredOpenKey;
    const seoulBusKey = this.normalizeServiceKey(selectedRawKey);

    if (!this.busKeyProbeLogged) {
      this.busKeyProbeLogged = true;
      this.logger.log(
        {
          event: 'seoul_bus.key_probe',
          configured: Boolean(seoulBusKey),
          keySource: configuredBusKey ? 'SEOUL_BUS_KEY' : configuredOpenKey ? 'SEOUL_OPEN/SEOUL_API_KEY' : 'NONE',
          wasPercentEncoded: /%[0-9A-Fa-f]{2}/.test(selectedRawKey),
          length: seoulBusKey.length,
          head: seoulBusKey ? seoulBusKey.slice(0, 6) : null,
          tail: seoulBusKey ? seoulBusKey.slice(-6) : null,
        },
        SeoulBusClient.name,
      );
    }

    // 호환성: 기존 운영 환경이 SEOUL_OPEN_API_KEY/SEOUL_API_KEY를 쓰는 경우를 지원한다.
    return seoulBusKey;
  }

  private normalizeServiceKey(rawKey: string): string {
    if (!rawKey) {
      return '';
    }
    // 환경변수에 URL-encoded 키를 넣는 경우(URLSearchParams에서 다시 encode) 인증 실패가 난다.
    // decode 가능한 경우 1회 decode해서 평문 키를 사용한다.
    if (/%[0-9A-Fa-f]{2}/.test(rawKey)) {
      try {
        return decodeURIComponent(rawKey);
      } catch {
        return rawKey;
      }
    }
    return rawKey;
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

  private extractArrivalEntries(raw: SeoulApiEnvelope, routeIdOrNo?: string): ArrivalEntry[] {
    const rows = this.unwrapRows(raw);
    const entries: ArrivalEntry[] = [];
    const normalizedRouteFilter = (routeIdOrNo ?? '').trim().replace(/\s+/g, '').toLowerCase();

    for (const row of rows) {
      const rowRouteId = this.readString(row, ['busRouteId', 'routeId', 'rtId']) ?? 'unknown-route';
      const rowRouteNo = this.readString(row, ['busRouteAbrv', 'rtNm', 'busRouteNm', 'busNo']) ?? '';
      const normalizedRouteId = rowRouteId.trim().replace(/\s+/g, '').toLowerCase();
      const normalizedRouteNo = rowRouteNo.trim().replace(/\s+/g, '').toLowerCase();

      if (
        normalizedRouteFilter &&
        normalizedRouteFilter !== normalizedRouteId &&
        normalizedRouteFilter !== normalizedRouteNo
      ) {
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
          routeNo: rowRouteNo,
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

    const normalized = message.replace(/\s+/g, '').trim();
    if (
      normalized.includes('곧도착') ||
      normalized.includes('잠시후') ||
      normalized.includes('진입')
    ) {
      return 60;
    }
    if (
      normalized.includes('도착') ||
      normalized.includes('출발대기') ||
      normalized.includes('회차대기')
    ) {
      return 120;
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

  private extractStationUidArrivalEntries(
    raw: SeoulApiEnvelope,
    routeNoOrId?: string,
  ): StationUidArrivalEntry[] {
    const rows = this.unwrapRows(raw);
    const normalizedRouteNo = routeNoOrId?.trim().replace(/\s+/g, '').toLowerCase() ?? null;
    const numericRouteNo = normalizedRouteNo?.replace(/[^0-9]/g, '') ?? '';
    const entries: StationUidArrivalEntry[] = [];

    for (const row of rows) {
      const busRouteAbrv =
        this.readString(row, ['busRouteAbrv', 'rtNm', 'busRouteNm', 'busNo']) ?? '';
      const normalizedAbrv = busRouteAbrv.trim().replace(/\s+/g, '').toLowerCase();
      const rowRouteId = (this.readString(row, ['busRouteId', 'routeId', 'rtId']) ?? '')
        .trim()
        .replace(/\s+/g, '')
        .toLowerCase();
      if (normalizedRouteNo && normalizedAbrv) {
        const numericAbrv = normalizedAbrv.replace(/[^0-9]/g, '');
        const exactMatch = normalizedAbrv === normalizedRouteNo;
        const containsMatch =
          normalizedAbrv.includes(normalizedRouteNo) || normalizedRouteNo.includes(normalizedAbrv);
        const numericMatch =
          numericRouteNo.length > 0 && numericAbrv.length > 0 && numericAbrv === numericRouteNo;
        const routeIdMatch = rowRouteId.length > 0 && rowRouteId === normalizedRouteNo;
        if (!exactMatch && !containsMatch && !numericMatch && !routeIdMatch) {
          continue;
        }
      }

      const routeId =
        (this.readString(row, ['busRouteId', 'routeId', 'rtId']) ?? busRouteAbrv) || 'unknown-route';

      const candidates = [
        this.readNumber(row, ['arrmsgSec1', 'arrmsg1Sec']),
        this.readNumber(row, ['arrmsgSec2', 'arrmsg2Sec']),
        this.readNumber(row, ['arrivalSec1', 'arrivalSec2']),
        this.parseArrivalSecFromMessage(
          this.readString(row, ['arrmsg1', 'arrivalMessage1', 'arrivalMessage']),
        ),
        this.parseArrivalSecFromMessage(this.readString(row, ['arrmsg2', 'arrivalMessage2'])),
      ]
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
        .map((value) => Math.max(0, Math.round(value)));

      for (const arrivalSec of candidates) {
        entries.push({
          routeNo: busRouteAbrv,
          routeId,
          arrivalSec,
        });
      }
    }

    return entries;
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
