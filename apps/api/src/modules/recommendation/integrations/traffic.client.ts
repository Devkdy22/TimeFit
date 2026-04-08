import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../common/config/app-config.service';
import { SafeLogger } from '../../../common/logger/safe-logger.service';
import type { LocationInput } from '../types/recommendation.types';
import type { NormalizedTrafficDto } from '../dto/integration/normalized-traffic.dto';
import { fetchJsonWithTimeout } from '../utils/http-client.util';

interface TrafficApiResponse {
  congestion?: number;
  delayIndex?: number;
  speed?: number;
  avgSpeed?: number;
  data?: {
    congestion?: number;
    speed?: number;
    avgSpeed?: number;
    segments?: Array<Record<string, unknown>>;
  };
  segments?: Array<Record<string, unknown>>;
}

interface SegmentMetric {
  speed: number;
  avgSpeed: number;
}

interface SegmentDelayMetric extends SegmentMetric {
  ratio: number;
  delayRisk: number;
}

@Injectable()
export class TrafficClient {
  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly logger: SafeLogger,
  ) {}

  async getTrafficDelay(origin: LocationInput, destination: LocationInput): Promise<NormalizedTrafficDto> {
    const template = this.appConfigService.trafficApiUrl;

    if (!template) {
      return this.buildFallback(origin, destination);
    }

    try {
      const url = this.interpolate(template, {
        API_KEY: this.appConfigService.trafficApiKey,
        ORIGIN_LAT: String(origin.lat),
        ORIGIN_LNG: String(origin.lng),
        DEST_LAT: String(destination.lat),
        DEST_LNG: String(destination.lng),
      });

      const raw = await fetchJsonWithTimeout<TrafficApiResponse>(url, { method: 'GET' }, 2500);
      const congestionIndex = this.normalizeCongestion(raw);

      return {
        source: 'api',
        fetchedAt: new Date().toISOString(),
        cacheableForMs: 300_000,
        congestionIndex,
      };
    } catch {
      return this.buildFallback(origin, destination);
    }
  }

  private normalizeCongestion(raw: TrafficApiResponse): number {
    const segmentMetrics = this.extractSegmentMetrics(raw);
    if (segmentMetrics.length > 0) {
      const delayMetrics = segmentMetrics
        .map((segment) => this.toDelayMetric(segment))
        .filter((metric): metric is SegmentDelayMetric => metric !== null);

      if (delayMetrics.length > 0) {
        const avgDelayRisk =
          delayMetrics.reduce((sum, metric) => sum + metric.delayRisk, 0) / delayMetrics.length;

        this.logger.log(
          {
            event: 'road_traffic.delay',
            segmentCount: delayMetrics.length,
            segments: delayMetrics.slice(0, 5).map((metric) => ({
              speed: Number(metric.speed.toFixed(2)),
              avgSpeed: Number(metric.avgSpeed.toFixed(2)),
              ratio: Number(metric.ratio.toFixed(3)),
              delayRisk: Number(metric.delayRisk.toFixed(3)),
            })),
            delayRisk: Number(avgDelayRisk.toFixed(3)),
          },
          TrafficClient.name,
        );

        return this.clamp01(avgDelayRisk);
      }
    }

    const byCongestion = raw.congestion ?? raw.data?.congestion;
    if (typeof byCongestion === 'number') {
      return this.clamp01(byCongestion > 1 ? byCongestion / 100 : byCongestion);
    }

    const speed = raw.data?.speed;
    if (typeof speed === 'number') {
      const normalized = 1 - Math.min(speed, 60) / 60;
      return this.clamp01(normalized);
    }

    const delayIndex = raw.delayIndex;
    if (typeof delayIndex === 'number') {
      return this.clamp01(delayIndex > 1 ? delayIndex / 100 : delayIndex);
    }

    return 0.35;
  }

  private extractSegmentMetrics(raw: TrafficApiResponse): SegmentMetric[] {
    const segmentSources = [...(raw.segments ?? []), ...(raw.data?.segments ?? [])];
    const metricsFromSegments = segmentSources
      .map((segment) => {
        const speed = this.readNumber(segment, ['speed', 'spd', 'currentSpeed']);
        const avgSpeed = this.readNumber(segment, ['avgSpeed', 'averageSpeed', 'baseSpeed', 'freeFlowSpeed']);
        if (speed === null || avgSpeed === null || avgSpeed <= 0) {
          return null;
        }
        return { speed, avgSpeed };
      })
      .filter((metric): metric is SegmentMetric => metric !== null);

    if (metricsFromSegments.length > 0) {
      return metricsFromSegments;
    }

    const topLevelSpeed = raw.speed ?? raw.data?.speed;
    const topLevelAvgSpeed = raw.avgSpeed ?? raw.data?.avgSpeed;
    if (typeof topLevelSpeed === 'number' && typeof topLevelAvgSpeed === 'number' && topLevelAvgSpeed > 0) {
      return [{ speed: topLevelSpeed, avgSpeed: topLevelAvgSpeed }];
    }

    return [];
  }

  private toDelayMetric(segment: SegmentMetric): SegmentDelayMetric | null {
    if (segment.avgSpeed <= 0) {
      return null;
    }

    const ratio = this.clamp01((segment.avgSpeed - segment.speed) / segment.avgSpeed);
    let delayRisk = 0.3;
    if (ratio < 0.2) {
      delayRisk = 0.05;
    } else if (ratio < 0.5) {
      delayRisk = 0.15;
    }

    return {
      ...segment,
      ratio,
      delayRisk,
    };
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

  private buildFallback(origin: LocationInput, destination: LocationInput): NormalizedTrafficDto {
    const seed = `${origin.lat}:${origin.lng}:${destination.lat}:${destination.lng}`;
    const hash = [...seed].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

    return {
      source: 'fallback',
      fetchedAt: new Date().toISOString(),
      cacheableForMs: 120_000,
      congestionIndex: (hash % 5) / 10 + 0.2,
    };
  }

  private interpolate(template: string, values: Record<string, string>) {
    return Object.entries(values).reduce(
      (url, [key, value]) => url.replaceAll(`{${key}}`, encodeURIComponent(value)),
      template,
    );
  }

  private clamp01(value: number) {
    return Math.max(0, Math.min(1, value));
  }
}
