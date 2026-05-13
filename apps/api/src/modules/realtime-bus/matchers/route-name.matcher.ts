import { Injectable } from '@nestjs/common';

@Injectable()
export class RouteNameMatcher {
  normalize(label?: string): string {
    if (!label) {
      return '';
    }

    let normalized = label.trim().toUpperCase();
    normalized = normalized.replace(/\s+/g, '');
    normalized = normalized.replace(/^경기/, '');
    normalized = normalized.replace(/^직행/, '');
    normalized = normalized.replace(/번$/, '');
    normalized = normalized.replace(/[-_.]/g, '');
    normalized = this.normalizeNumericBlocks(normalized);

    return normalized;
  }

  isMatch(left?: string, right?: string): boolean {
    const l = this.normalize(left);
    const r = this.normalize(right);
    if (!l || !r) {
      return false;
    }
    if (l === r) {
      return true;
    }

    if (l.includes(r) || r.includes(l)) {
      return true;
    }

    const lNum = l.replace(/[^0-9]/g, '');
    const rNum = r.replace(/[^0-9]/g, '');
    if (lNum && rNum && lNum === rNum) {
      const lPrefix = l.replace(/[0-9]/g, '');
      const rPrefix = r.replace(/[0-9]/g, '');
      return lPrefix === rPrefix || !lPrefix || !rPrefix;
    }

    return false;
  }

  private normalizeNumericBlocks(value: string): string {
    return value.replace(/\d+/g, (digits) => {
      const trimmed = digits.replace(/^0+/, '');
      return trimmed.length > 0 ? trimmed : '0';
    });
  }
}
