import { Injectable } from '@nestjs/common';

@Injectable()
export class StationMatcher {
  normalize(name?: string): string {
    if (!name) {
      return '';
    }

    let normalized = name;
    normalized = normalized.replace(/\([^)]*\)/g, ' ');
    normalized = normalized.replace(/중앙차로|출구|백화점|건너편|사거리|앞|중/g, ' ');
    normalized = normalized.replace(/[0-9]+번/g, ' ');
    normalized = normalized.replace(/[.·,]/g, ' ');
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  similarity(left?: string, right?: string): number {
    const l = this.normalize(left);
    const r = this.normalize(right);
    if (!l || !r) {
      return 0;
    }
    if (l === r) {
      return 1;
    }
    if (l.includes(r) || r.includes(l)) {
      return 0.8;
    }

    const maxLen = Math.max(l.length, r.length);
    let same = 0;
    const minLen = Math.min(l.length, r.length);
    for (let i = 0; i < minLen; i += 1) {
      if (l[i] === r[i]) {
        same += 1;
      }
    }

    return maxLen > 0 ? same / maxLen : 0;
  }

  distanceMeters(a?: { lat?: number; lng?: number }, b?: { lat?: number; lng?: number }): number {
    if (
      typeof a?.lat !== 'number' ||
      typeof a?.lng !== 'number' ||
      typeof b?.lat !== 'number' ||
      typeof b?.lng !== 'number'
    ) {
      return Number.POSITIVE_INFINITY;
    }

    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const earth = 6371e3;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const x =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    return earth * c;
  }
}
