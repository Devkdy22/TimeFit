import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../../common/config/app-config.service';
import { SafeLogger } from '../../../../common/logger/safe-logger.service';
import { OdsayUsageRepository } from '../../cache/odsay-usage.repository';
import type { LocationInput } from '../../types/recommendation.types';
import type {
  OdsayApiError,
  OdsayTransitResponse,
  OdsayTransitRouteResult,
  OdsayFetchStatus,
  OdsayUsageSnapshot,
} from '../../types/transit';

export class OdsayTooCloseError extends Error {
  constructor(
    message: string,
    public readonly context: { origin: unknown; destination: unknown },
  ) {
    super(message);
    this.name = 'OdsayTooCloseError';
  }
}

@Injectable()
export class OdsayTransitClient {
  private readonly cache = new Map<
    string,
    { expiresAt: number; staleUntil: number; value: OdsayTransitRouteResult }
  >();
  private readonly inFlight = new Map<string, Promise<OdsayTransitRouteResult>>();

  private readonly timeoutMs = 3500;
  private readonly cacheTtlMs = 45_000;
  private readonly staleFallbackMs = 10 * 60_000;
  private readonly timezone = 'Asia/Seoul';

  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly logger: SafeLogger,
    private readonly odsayUsageRepository: OdsayUsageRepository,
  ) {}

  async fetchTransitRoutes(
    origin: LocationInput,
    destination: LocationInput,
  ): Promise<OdsayTransitRouteResult> {
    const dateKey = this.getSeoulDateKey();
    await this.safeIncrementUsage(dateKey, { totalRequests: 1 });

    const apiKey = this.appConfigService.odsayApiKey;
    const baseUrl = this.appConfigService.odsayApiUrl;
    const key = this.buildCacheKey(origin, destination);
    const now = Date.now();

    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > now) {
      await this.safeIncrementUsage(dateKey, { cacheHits: 1, successResponses: 1 });
      return this.withMeta(cached.value, { cacheHit: true });
    }

    const existing = this.inFlight.get(key);
    if (existing) {
      await this.safeIncrementUsage(dateKey, { deduplicatedRequests: 1 });
      const deduped = await existing;
      return this.withMeta(deduped, { deduplicated: true });
    }

    if (!apiKey || !baseUrl) {
      this.logger.warn(
        {
          event: 'odsay.request.failed',
          reason: 'missing_provider_configuration',
          hasApiKey: Boolean(apiKey),
          hasBaseUrl: Boolean(baseUrl),
        },
        OdsayTransitClient.name,
      );
      await this.safeIncrementUsage(dateKey, { failedResponses: 1 });
      return this.buildResult('PROVIDER_DOWN', [], {
        code: -1,
        message: 'ODsay configuration missing',
      });
    }

    const loader = this.fetchFromProvider(origin, destination, baseUrl, apiKey);
    this.inFlight.set(key, loader);

    let response: OdsayTransitRouteResult;
    try {
      await this.safeIncrementUsage(dateKey, { externalApiCalls: 1 });
      response = await loader;
    } finally {
      this.inFlight.delete(key);
    }

    if (response.status === 'OK') {
      this.cache.set(key, {
        expiresAt: now + this.cacheTtlMs,
        staleUntil: now + this.staleFallbackMs,
        value: response,
      });
      await this.safeIncrementUsage(dateKey, { successResponses: 1 });
      return response;
    }

    const stale = this.cache.get(key);
    if (
      stale &&
      stale.staleUntil > now &&
      (response.status === 'PROVIDER_TIMEOUT' || response.status === 'PROVIDER_DOWN')
    ) {
      await this.safeIncrementUsage(dateKey, { staleFallbackHits: 1, successResponses: 1 });
      this.logger.warn(
        {
          event: 'odsay.response.stale_fallback',
          reason: response.status,
          cacheKey: key,
        },
        OdsayTransitClient.name,
      );
      return this.withMeta(stale.value, {
        cacheHit: true,
        staleFallback: true,
      });
    }

    await this.safeIncrementUsage(dateKey, { failedResponses: 1 });
    return response;
  }

  async getDailyUsageSnapshot(date?: string): Promise<OdsayUsageSnapshot> {
    const targetDate = date ?? this.getSeoulDateKey();
    const found = await this.odsayUsageRepository.findByDate(targetDate);
    if (found) {
      return found;
    }

    return {
      date: targetDate,
      timezone: this.timezone,
      totalRequests: 0,
      externalApiCalls: 0,
      cacheHits: 0,
      staleFallbackHits: 0,
      deduplicatedRequests: 0,
      successResponses: 0,
      failedResponses: 0,
    };
  }

  buildQuery(origin: LocationInput, destination: LocationInput, apiKey: string): URLSearchParams {
    return new URLSearchParams({
      SX: String(origin.lng),
      SY: String(origin.lat),
      EX: String(destination.lng),
      EY: String(destination.lat),
      apiKey,
      SearchType: '0',
      SearchPathType: '0',
      OPT: '0',
    });
  }

  parseError(body: OdsayTransitResponse): OdsayApiError | null {
    const rawError = body.error ?? body.result?.error;
    if (!rawError) {
      return null;
    }

    const code = Number(rawError.code ?? -1);
    const message = (rawError.msg ?? rawError.message ?? 'unknown_error').trim();

    return {
      code: Number.isFinite(code) ? code : -1,
      message,
    };
  }

  private async fetchFromProvider(
    origin: LocationInput,
    destination: LocationInput,
    baseUrl: string,
    apiKey: string,
  ): Promise<OdsayTransitRouteResult> {
    const query = this.buildQuery(origin, destination, apiKey);
    const sx = Number(query.get('SX'));
    const sy = Number(query.get('SY'));
    const ex = Number(query.get('EX'));
    const ey = Number(query.get('EY'));

    this.logger.log(
      {
        event: 'odsay.request.params',
        sx,
        sy,
        ex,
        ey,
        originLat: origin.lat,
        originLng: origin.lng,
        destinationLat: destination.lat,
        destinationLng: destination.lng,
      },
      OdsayTransitClient.name,
    );

    if (this.isCoordinateOrderSuspicious(sx, sy, ex, ey)) {
      this.logger.warn(
        {
          event: 'odsay.request.coordinate_order_suspicious',
          sx,
          sy,
          ex,
          ey,
          reason: 'sx/ex look like latitude and sy/ey look like longitude',
        },
        OdsayTransitClient.name,
      );
    }

    const base = this.trimTrailingSlash(baseUrl);
    const urlFast = `${base}/searchPubTransPathT?${query.toString()}`;
    const urlDetailed = `${base}/searchPubTransPath?${query.toString()}`;

    let response = await this.fetchWithRetry(urlFast, 1);

    if (!response.body) {
      return this.buildResult(response.status, [], response.error, response.httpStatus);
    }

    let parsedError = this.parseError(response.body);
    let paths = response.body.result?.path ?? [];
    this.logResponseSummary(response.body, paths.length);

    // searchPubTransPathT 응답에 경유지 정보(passStopList)가 누락되는 경우가 있어
    // 상세 엔드포인트(searchPubTransPath)로 1회 보강 조회한다.
    if (!parsedError && paths.length > 0 && !this.hasAnyPassStops(paths)) {
      const detailed = await this.fetchWithRetry(urlDetailed, 1);
      if (detailed.body) {
        const detailedError = this.parseError(detailed.body);
        const detailedPaths = detailed.body.result?.path ?? [];
        if (!detailedError && detailedPaths.length > 0 && this.hasAnyPassStops(detailedPaths)) {
          response = detailed;
          parsedError = detailedError;
          paths = detailedPaths;
          this.logResponseSummary(detailed.body, detailedPaths.length);
          this.logger.log(
            {
              event: 'odsay.response.upgraded_with_detailed_endpoint',
              from: 'searchPubTransPathT',
              to: 'searchPubTransPath',
              pathCount: detailedPaths.length,
            },
            OdsayTransitClient.name,
          );
        }
      }
    }

    if (parsedError) {
      if (parsedError.code === -98) {
        throw new OdsayTooCloseError(parsedError.message, { origin, destination });
      }

      this.logger.warn(
        {
          event: 'odsay.response.provider_error',
          errorCode: parsedError.code,
          errorMessage: parsedError.message,
          pathCount: paths.length,
        },
        OdsayTransitClient.name,
      );

      return this.buildResult('PROVIDER_DOWN', paths, parsedError);
    }

    if (paths.length === 0) {
      this.logger.warn(
        {
          event: 'odsay.response.empty_path',
          pathCount: 0,
        },
        OdsayTransitClient.name,
      );
      return this.buildResult('NO_RESULT', []);
    }

    return this.buildResult('OK', paths);
  }

  private async fetchWithRetry(
    url: string,
    maxRetry: number,
  ): Promise<{
    status: OdsayFetchStatus;
    body?: OdsayTransitResponse;
    error?: OdsayApiError;
    httpStatus?: number;
  }> {
    let attempt = 0;

    while (attempt <= maxRetry) {
      try {
        const body = await this.requestOnce(url);
        return {
          status: 'OK',
          body,
        };
      } catch (error) {
        const normalized = this.normalizeRequestError(error);
        const shouldRetry = attempt < maxRetry && this.shouldRetry(normalized.status, normalized.httpStatus);

        if (shouldRetry) {
          this.logger.warn(
            {
              event: 'odsay.request.retry',
              attempt: attempt + 1,
              maxRetry,
              status: normalized.status,
              httpStatus: normalized.httpStatus ?? null,
              reason: normalized.error.message,
            },
            OdsayTransitClient.name,
          );
          attempt += 1;
          continue;
        }

        if (normalized.status === 'PROVIDER_TIMEOUT') {
          this.logger.warn(
            {
              event: 'odsay.request.timeout',
              attempt: attempt + 1,
              timeoutMs: this.timeoutMs,
            },
            OdsayTransitClient.name,
          );
        }

        this.logger.warn(
          {
            event: 'odsay.request.failed',
            attempt: attempt + 1,
            status: normalized.status,
            httpStatus: normalized.httpStatus ?? null,
            reason: normalized.error.message,
          },
          OdsayTransitClient.name,
        );

        return normalized;
      }
    }

    return {
      status: 'PROVIDER_DOWN',
      error: {
        code: -1,
        message: 'ODsay request failed unexpectedly',
      },
    };
  }

  private async requestOnce(url: string): Promise<OdsayTransitResponse> {
    const AbortCtor = globalThis.AbortController;
    const controller = AbortCtor ? new AbortCtor() : null;
    const timer = setTimeout(() => controller?.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller?.signal,
      });

      if (!response.ok) {
        throw {
          type: 'HTTP_ERROR',
          status: response.status,
          message: `Request failed: ${response.status}`,
        };
      }

      return (await response.json()) as OdsayTransitResponse;
    } finally {
      clearTimeout(timer);
    }
  }

  private normalizeRequestError(error: unknown): {
    status: OdsayFetchStatus;
    error: OdsayApiError;
    httpStatus?: number;
  } {
    if (typeof error === 'object' && error && 'type' in error && (error as { type?: string }).type === 'HTTP_ERROR') {
      const httpStatus = Number((error as { status?: number }).status);
      const status: OdsayFetchStatus = httpStatus >= 500 ? 'PROVIDER_DOWN' : 'INVALID_INPUT';
      return {
        status,
        httpStatus,
        error: {
          code: httpStatus,
          message: (error as { message?: string }).message ?? 'ODsay http error',
        },
      };
    }

    if (error instanceof Error && error.name === 'AbortError') {
      return {
        status: 'PROVIDER_TIMEOUT',
        error: {
          code: -2,
          message: 'ODsay request timeout',
        },
      };
    }

    return {
      status: 'PROVIDER_DOWN',
      error: {
        code: -3,
        message: error instanceof Error ? error.message : 'ODsay network failure',
      },
    };
  }

  private shouldRetry(status: OdsayFetchStatus, httpStatus?: number): boolean {
    if (status === 'PROVIDER_TIMEOUT') {
      return true;
    }

    if (status === 'PROVIDER_DOWN') {
      return typeof httpStatus === 'number' ? httpStatus >= 500 : true;
    }

    return false;
  }

  private logResponseSummary(body: OdsayTransitResponse, pathCount: number) {
    const firstPath = body.result?.path?.[0];
    const sampleSubPaths = (firstPath?.subPath ?? []).slice(0, 5).map((subPath) => ({
      trafficType: subPath.trafficType,
      trafficTypeType: typeof subPath.trafficType,
      sectionTime: subPath.sectionTime ?? null,
      distance: subPath.distance ?? null,
      stationCount: subPath.stationCount ?? null,
      startName: subPath.startName ?? null,
      endName: subPath.endName ?? null,
      laneType: Array.isArray(subPath.lane) ? 'array' : typeof subPath.lane,
      laneCount: Array.isArray(subPath.lane) ? subPath.lane.length : 0,
    }));

    const parsedError = this.parseError(body);

    this.logger.log(
      {
        event: 'odsay.response.summary',
        hasResult: Boolean(body.result),
        pathCount,
        hasError: Boolean(parsedError),
        errorCode: parsedError?.code ?? null,
        errorMessage: parsedError?.message ?? null,
        firstPath: firstPath
          ? {
              pathType: firstPath.pathType ?? null,
              totalTime: firstPath.info?.totalTime ?? null,
              payment: firstPath.info?.payment ?? null,
              subPathLength: firstPath.subPath?.length ?? 0,
            }
          : null,
        firstSubPathSamples: sampleSubPaths,
      },
      OdsayTransitClient.name,
    );
  }

  private hasAnyPassStops(paths: OdsayTransitRouteResult['paths']): boolean {
    for (const path of paths) {
      const subPaths = path.subPath ?? [];
      for (const subPath of subPaths) {
        const stations = subPath.passStopList?.stations ?? [];
        if (Array.isArray(stations) && stations.length > 0) {
          return true;
        }
      }
    }
    return false;
  }

  private buildResult(
    status: OdsayFetchStatus,
    paths: OdsayTransitRouteResult['paths'],
    error?: OdsayApiError,
    providerHttpStatus?: number,
  ): OdsayTransitRouteResult {
    return {
      status,
      paths,
      fetchedAt: new Date().toISOString(),
      cacheableForMs: this.cacheTtlMs,
      error,
      providerHttpStatus,
    };
  }

  private withMeta(
    result: OdsayTransitRouteResult,
    meta: OdsayTransitRouteResult['meta'],
  ): OdsayTransitRouteResult {
    return {
      ...result,
      meta: {
        ...(result.meta ?? {}),
        ...(meta ?? {}),
      },
    };
  }

  private async safeIncrementUsage(
    date: string,
    deltas: Partial<Record<keyof Omit<OdsayUsageSnapshot, 'date' | 'timezone'>, number>>,
  ) {
    try {
      await this.odsayUsageRepository.increment(date, this.timezone, deltas);
    } catch (error) {
      this.logger.warn(
        {
          event: 'odsay.usage.persist.failed',
          date,
          deltas,
          reason: error instanceof Error ? error.message : 'unknown_error',
        },
        OdsayTransitClient.name,
      );
    }
  }

  private getSeoulDateKey(): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  }

  private isCoordinateOrderSuspicious(sx: number, sy: number, ex: number, ey: number): boolean {
    const latRange = (value: number) => value >= 33 && value <= 39;
    const lngRange = (value: number) => value >= 124 && value <= 132;
    return latRange(sx) && latRange(ex) && lngRange(sy) && lngRange(ey);
  }

  private buildCacheKey(origin: LocationInput, destination: LocationInput): string {
    return `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}:${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}`;
  }

  private trimTrailingSlash(url: string): string {
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }
}
