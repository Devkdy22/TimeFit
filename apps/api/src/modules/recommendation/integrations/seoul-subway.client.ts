import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../common/config/app-config.service';
import { SafeLogger } from '../../../common/logger/safe-logger.service';
import { fetchJsonWithTimeout } from '../utils/http-client.util';

interface SubwayApiResponse {
  realtimeArrivalList?: Array<{
    arvlMsg2?: string;
    arvlMsg3?: string;
    trainLineNm?: string;
  }>;
}

export interface SubwayArrivalResult {
  stationName: string;
  arrivalMessage: string;
  delayRisk: number;
  source: 'api' | 'fallback';
}

@Injectable()
export class SeoulSubwayClient {
  private readonly cache = new Map<string, { expiresAt: number; value: SubwayArrivalResult }>();
  private readonly ttlMs = 60_000;

  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly logger: SafeLogger,
  ) {}

  async getSubwayArrival(stationName: string): Promise<SubwayArrivalResult> {
    const normalizedStationName = this.normalizeStationName(stationName);
    const key = normalizedStationName;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      const parsedMinutes = this.parseArrivalMinutes(cached.value.arrivalMessage);
      this.log(
        cached.value.stationName,
        [cached.value.arrivalMessage],
        cached.value.arrivalMessage,
        parsedMinutes,
        cached.value.delayRisk,
      );
      return cached.value;
    }

    const baseUrl = this.appConfigService.seoulSubwayApiUrl;
    const apiKey = this.appConfigService.seoulSubwayApiKey;
    if (!baseUrl || !apiKey || !key) {
      const fallback = this.fallback(normalizedStationName);
      this.cache.set(key, { expiresAt: Date.now() + this.ttlMs, value: fallback });
      this.log(
        fallback.stationName,
        [fallback.arrivalMessage],
        fallback.arrivalMessage,
        null,
        fallback.delayRisk,
      );
      return fallback;
    }

    try {
      const encodedStation = encodeURIComponent(normalizedStationName);
      const url = `${this.trimTrailingSlash(baseUrl)}/${encodeURIComponent(apiKey)}/json/realtimeStationArrival/0/5/${encodedStation}`;
      const raw = await fetchJsonWithTimeout<SubwayApiResponse>(url, { method: 'GET' }, 2500);
      const rawArrivalMessages = this.extractArrivalMessages(raw);
      const arrivalMessage = this.pickBestArrivalMessage(rawArrivalMessages);
      if (!arrivalMessage) {
        throw new Error('No valid arrival message');
      }
      const parsedMinutes = this.parseArrivalMinutes(arrivalMessage);
      const delayRisk = this.toDelayRisk(arrivalMessage, parsedMinutes);
      const result: SubwayArrivalResult = {
        stationName: normalizedStationName,
        arrivalMessage,
        delayRisk,
        source: 'api',
      };

      this.cache.set(key, { expiresAt: Date.now() + this.ttlMs, value: result });
      this.log(
        result.stationName,
        rawArrivalMessages,
        result.arrivalMessage,
        parsedMinutes,
        result.delayRisk,
      );
      return result;
    } catch {
      const fallback = this.fallback(normalizedStationName);
      this.cache.set(key, { expiresAt: Date.now() + this.ttlMs, value: fallback });
      this.log(
        fallback.stationName,
        [fallback.arrivalMessage],
        fallback.arrivalMessage,
        null,
        fallback.delayRisk,
      );
      return fallback;
    }
  }

  private toDelayRisk(arrivalMessage: string, parsedMinutes: number | null): number {
    if (parsedMinutes !== null) {
      if (parsedMinutes <= 2) {
        return 0.05;
      }
      if (parsedMinutes <= 5) {
        return 0.1;
      }
      if (parsedMinutes <= 10) {
        return 0.2;
      }
      return 0.3;
    }

    if (arrivalMessage.includes('지연')) {
      return 0.2;
    }
    if (arrivalMessage.includes('출발') || arrivalMessage.includes('도착') || arrivalMessage.includes('진입')) {
      return 0.05;
    }
    return 0.05;
  }

  private parseArrivalMinutes(message: string): number | null {
    const normalized = message.replace(/\s+/g, ' ').trim();

    const minSec = normalized.match(/(\d+)분\s*(\d*)초(?:\s*후)?/);
    if (minSec) {
      const minutes = Number(minSec[1]);
      const seconds = minSec[2] ? Number(minSec[2]) : 0;
      return Number((minutes + seconds / 60).toFixed(2));
    }

    const minOnly = normalized.match(/(\d+)분(?:\s*후)?/);
    if (minOnly) {
      return Number(minOnly[1]);
    }

    const secOnly = normalized.match(/(\d+)초(?:\s*후)?/);
    if (secOnly) {
      return Number((Number(secOnly[1]) / 60).toFixed(2));
    }

    return null;
  }

  private extractArrivalMessages(raw: SubwayApiResponse): string[] {
    const rows = raw.realtimeArrivalList ?? [];
    return rows
      .map((row) => row.arvlMsg2 ?? row.arvlMsg3 ?? row.trainLineNm ?? '')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  private pickBestArrivalMessage(messages: string[]): string | null {
    const valid = messages.filter((message) => message !== '도착 정보 없음');
    if (valid.length === 0) {
      return null;
    }

    const withTime = valid.find((message) => this.parseArrivalMinutes(message) !== null);
    return withTime ?? valid[0];
  }

  private fallback(stationName: string): SubwayArrivalResult {
    return {
      stationName: stationName.trim() || 'unknown',
      arrivalMessage: 'fallback',
      delayRisk: 0.1,
      source: 'fallback',
    };
  }

  private normalizeStationName(stationName: string): string {
    return stationName.trim().replace(/역$/, '');
  }

  private log(
    stationName: string,
    rawArrivalMessages: string[],
    selectedMessage: string,
    parsedMinutes: number | null,
    delayRisk: number,
  ) {
    this.logger.log(
      {
        event: 'seoul_subway.arrival',
        stationName,
        rawArrivalMessage: rawArrivalMessages,
        selectedMessage,
        parsedMinutes,
        delayRisk,
      },
      SeoulSubwayClient.name,
    );
  }

  private trimTrailingSlash(url: string) {
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }
}
