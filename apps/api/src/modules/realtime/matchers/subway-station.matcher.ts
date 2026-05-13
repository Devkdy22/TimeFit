import { Injectable } from '@nestjs/common';
import { normalizeStationName } from '../normalizers/station-name.normalizer';

const SUPPORTED_LINES = [
  '1호선',
  '2호선',
  '3호선',
  '4호선',
  '5호선',
  '6호선',
  '7호선',
  '8호선',
  '9호선',
  '경의중앙선',
  '수인분당선',
  '신분당선',
  '공항철도',
  '우이신설선',
  '서해선',
  'gtx-a',
  'gtx-b',
  'gtx-c',
];

@Injectable()
export class SubwayStationMatcher {
  resolveLine(raw: string): string {
    const normalized = raw.trim().replace(/\s+/g, '').toLowerCase();
    if (normalized.startsWith('gtx')) {
      return normalized;
    }
    const match = normalized.match(/([1-9])호선/);
    if (match) {
      return `${match[1]}호선`;
    }
    return raw.trim();
  }

  isSupportedLine(line: string): boolean {
    const normalized = this.resolveLine(line).toLowerCase();
    return SUPPORTED_LINES.includes(normalized as (typeof SUPPORTED_LINES)[number]);
  }

  resolveStation(raw: string): string {
    return normalizeStationName(raw);
  }
}

