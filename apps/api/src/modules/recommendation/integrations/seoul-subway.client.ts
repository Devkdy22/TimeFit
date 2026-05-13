import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../common/config/app-config.service';
import { SafeLogger } from '../../../common/logger/safe-logger.service';
import { fetchJsonWithTimeout } from '../utils/http-client.util';

interface SubwayApiResponse {
  realtimeArrivalList?: Array<{
    arvlMsg2?: string;
    arvlMsg3?: string;
    trainLineNm?: string;
    subwayId?: string;
    updnLine?: string;
    statnNm?: string;
  }>;
}

interface ParsedStationQuery {
  station: string;
  line: string;
}

export interface SubwayArrivalResult {
  stationName: string;
  arrivalMessage: string;
  delayRisk: number;
  source: 'api' | 'fallback';
}

export interface SubwayArrivalCandidate {
  route: string;
  direction?: string;
  etaMinutes: number;
  etaSeconds: number;
}

@Injectable()
export class SeoulSubwayClient {
  private readonly cache = new Map<string, { expiresAt: number; value: SubwayArrivalResult }>();
  private readonly ttlMs = 60_000;

  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly logger: SafeLogger,
  ) {}

  async getSubwayArrival(stationName: string, lineLabel?: string): Promise<SubwayArrivalResult> {
    const parsed = this.parseStationAndLine(stationName, lineLabel);
    const normalizedStationName = parsed.station;
    const normalizedLine = parsed.line;
    const key = `${normalizedStationName}:${normalizedLine || 'all'}`;
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
    if (!baseUrl || !apiKey || !normalizedStationName) {
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
      const stationCandidates = this.buildStationQueryCandidates(stationName, normalizedStationName);
      let rawRows: SubwayApiResponse['realtimeArrivalList'] = [];
      let filteredRows: SubwayApiResponse['realtimeArrivalList'] = [];
      let rawArrivalMessages: string[] = [];

      for (const candidate of stationCandidates) {
        const encodedStation = encodeURIComponent(candidate);
        const url = `${this.trimTrailingSlash(baseUrl)}/${encodeURIComponent(apiKey)}/json/realtimeStationArrival/0/20/${encodedStation}`;
        const raw = await fetchJsonWithTimeout<SubwayApiResponse>(url, { method: 'GET' }, 2500);
        rawRows = raw.realtimeArrivalList ?? [];
        filteredRows = this.filterRowsByLine(rawRows, normalizedLine);
        const candidateRows = filteredRows.length > 0 ? filteredRows : rawRows;
        rawArrivalMessages = this.extractArrivalMessages(candidateRows);
        if (rawArrivalMessages.length > 0) {
          break;
        }
      }

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
        normalizedLine || null,
        rawRows.length,
        filteredRows.length,
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
        normalizedLine || null,
        0,
        0,
      );
      return fallback;
    }
  }

  async getSubwayArrivalCandidates(
    stationName: string,
    lineLabel?: string,
  ): Promise<SubwayArrivalCandidate[]> {
    const parsed = this.parseStationAndLine(stationName, lineLabel);
    const normalizedStationName = parsed.station;
    const normalizedLine = parsed.line;
    const baseUrl = this.appConfigService.seoulSubwayApiUrl;
    const apiKey = this.appConfigService.seoulSubwayApiKey;
    if (!baseUrl || !apiKey || !normalizedStationName) {
      return [];
    }

    try {
      const stationCandidates = this.buildStationQueryCandidates(stationName, normalizedStationName);
      let rows: SubwayApiResponse['realtimeArrivalList'] = [];
      for (const candidate of stationCandidates) {
        const encodedStation = encodeURIComponent(candidate);
        const url = `${this.trimTrailingSlash(baseUrl)}/${encodeURIComponent(apiKey)}/json/realtimeStationArrival/0/30/${encodedStation}`;
        const raw = await fetchJsonWithTimeout<SubwayApiResponse>(url, { method: 'GET' }, 2500);
        const rawRows = raw.realtimeArrivalList ?? [];
        const filteredRows = this.filterRowsByLine(rawRows, normalizedLine);
        rows = filteredRows.length > 0 ? filteredRows : rawRows;
        if (rows.length > 0) {
          break;
        }
      }

      const candidates = rows
        .map((row) => {
          const route = (row.trainLineNm ?? normalizedLine ?? '').trim();
          const direction = (row.updnLine ?? '').trim() || undefined;
          const message = (row.arvlMsg2 ?? row.arvlMsg3 ?? '').trim();
          const etaMinutes = this.parseArrivalMinutes(message);
          if (!route || etaMinutes === null) {
            return null;
          }
          const etaSeconds = Math.max(10, Math.round(etaMinutes * 60));
          return { route, direction, etaMinutes, etaSeconds };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => a.etaSeconds - b.etaSeconds);

      return candidates.slice(0, 6);
    } catch {
      return [];
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

  private extractArrivalMessages(
    rows: Array<{ arvlMsg2?: string; arvlMsg3?: string; trainLineNm?: string }>,
  ): string[] {
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
    return stationName
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/(수도권|서울)\s*/g, '')
      .replace(/([1-9]호선|신분당선|수인분당선|경의중앙선|공항철도|경춘선|경강선|우이신설선|신림선|서해선)\s*$/g, '')
      .replace(/역$/, '')
      .trim();
  }

  private normalizeLineLabel(lineLabel: string): string {
    const normalized = lineLabel.replace(/\s+/g, '').trim();
    const match = normalized.match(
      /(1호선|2호선|3호선|4호선|5호선|6호선|7호선|8호선|9호선|신분당선|수인분당선|경의중앙선|공항철도|경춘선|경강선|우이신설선|신림선|서해선|GTX-A|GTX-B|GTX-C)/i,
    );
    return (match?.[1] ?? normalized).toUpperCase();
  }

  private parseStationAndLine(stationName: string, lineLabel?: string): ParsedStationQuery {
    const extractedLineFromStation = stationName.match(
      /(1호선|2호선|3호선|4호선|5호선|6호선|7호선|8호선|9호선|신분당선|수인분당선|경의중앙선|공항철도|경춘선|경강선|우이신설선|신림선|서해선|GTX-A|GTX-B|GTX-C)/i,
    )?.[1];
    const mergedLine = lineLabel?.trim() || extractedLineFromStation || '';
    return {
      station: this.normalizeStationName(stationName),
      line: mergedLine ? this.normalizeLineLabel(mergedLine) : '',
    };
  }

  private buildStationQueryCandidates(rawStationName: string, normalizedStationName: string): string[] {
    const compactRaw = rawStationName.trim().replace(/\s+/g, ' ');
    const withoutLineFromRaw = this.normalizeStationName(compactRaw);
    const aliasCandidates = this.resolveStationAliases(withoutLineFromRaw);
    const candidates = [
      normalizedStationName,
      `${normalizedStationName}역`,
      withoutLineFromRaw,
      `${withoutLineFromRaw}역`,
      compactRaw,
      ...aliasCandidates,
    ]
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    return [...new Set(candidates)];
  }

  private resolveStationAliases(station: string): string[] {
    const normalized = station.replace(/\s+/g, '');
    const aliases: string[] = [];

    const gaMap: Record<string, string> = {
      종로3가: '종로삼가',
      종로5가: '종로오가',
      을지로3가: '을지로삼가',
      을지로4가: '을지로사가',
      충정로: '충정로(경기대입구)',
    };
    if (gaMap[normalized]) {
      aliases.push(gaMap[normalized], `${gaMap[normalized]}역`);
    }

    aliases.push(normalized.replace(/역$/, ''), normalized.replace(/역$/, '') + '역');
    return aliases;
  }

  private filterRowsByLine(
    rows: Array<{ trainLineNm?: string; subwayId?: string; updnLine?: string; statnNm?: string }>,
    normalizedLine: string,
  ): Array<{ trainLineNm?: string; subwayId?: string; updnLine?: string; statnNm?: string; arvlMsg2?: string; arvlMsg3?: string }> {
    if (!normalizedLine) {
      return rows;
    }

    const lineKey = normalizedLine.toUpperCase();
    return rows.filter((row) => {
      const trainLineNm = (row.trainLineNm ?? '').replace(/\s+/g, '').toUpperCase();
      const subwayId = (row.subwayId ?? '').replace(/\s+/g, '').toUpperCase();
      if (trainLineNm.includes(lineKey)) {
        return true;
      }
      if (lineKey.includes('호선') && subwayId.length > 0) {
        const lineNumber = lineKey.match(/([1-9])호선/)?.[1];
        if (lineNumber && subwayId.endsWith(lineNumber)) {
          return true;
        }
      }
      return false;
    });
  }

  private log(
    stationName: string,
    rawArrivalMessages: string[],
    selectedMessage: string,
    parsedMinutes: number | null,
    delayRisk: number,
    requestedLine: string | null = null,
    rawRowCount = 0,
    filteredRowCount = 0,
  ) {
    this.logger.log(
      {
        event: 'seoul_subway.arrival',
        stationName,
        requestedLine,
        rawRowCount,
        filteredRowCount,
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
