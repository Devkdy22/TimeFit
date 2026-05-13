import { selectBestPoi } from '../../../../src/modules/kakao-local/location.service';
import type { PoiCandidate } from '../../../../src/modules/kakao-local/poi.engine';

describe('selectBestPoi', () => {
  it('selects user-selected building name first in mixed-building candidates (tier 1)', () => {
    const candidates: PoiCandidate[] = [
      {
        name: '육혜장',
        lat: 37.545,
        lng: 127.13,
        distance: 0,
        category: 'FD6',
        source: 'category',
        score: 1,
      },
      {
        name: '홈플러스 강동점',
        lat: 37.545,
        lng: 127.13,
        distance: 3,
        category: 'BUILDING_NAME',
        source: 'keyword',
        score: 0.95,
      },
    ];

    const result = selectBestPoi(candidates, '홈플러스강동');
    expect(result.selectionTier).toBe(1);
    expect(result.selectedPoi.name).toContain('홈플러스');
  });

  it('selects keyword source when no name match exists (tier 3)', () => {
    const candidates: PoiCandidate[] = [
      {
        name: '무관 카페',
        lat: 37.57,
        lng: 126.99,
        distance: 15,
        category: 'CE7',
        source: 'keyword',
        score: 0.8,
      },
      {
        name: '인근 음식점',
        lat: 37.57,
        lng: 126.99,
        distance: 8,
        category: 'FD6',
        source: 'category',
        score: 0.95,
      },
    ];

    const result = selectBestPoi(candidates, '존재하지않는목적지');
    expect(result.selectionTier).toBe(3);
    expect(result.selectedPoi.source).toBe('keyword');
  });

  it('keeps existing fallback behavior by score/distance when keyword is absent (tier 4)', () => {
    const candidates: PoiCandidate[] = [
      {
        name: 'A',
        lat: 37.57,
        lng: 126.99,
        distance: 20,
        category: 'FD6',
        source: 'category',
        score: 0.8,
      },
      {
        name: 'B',
        lat: 37.57,
        lng: 126.99,
        distance: 10,
        category: 'FD6',
        source: 'category',
        score: 0.9,
      },
    ];

    const result = selectBestPoi(candidates, '');
    expect(result.selectionTier).toBe(4);
    expect(result.selectedPoi.name).toBe('B');
  });

  it('supports common keyword case like 스타벅스 종로3가점', () => {
    const candidates: PoiCandidate[] = [
      {
        name: '스타벅스 종로3가점',
        lat: 37.5702,
        lng: 126.9918,
        distance: 0,
        category: 'CE7',
        source: 'keyword',
        score: 1,
      },
      {
        name: '종로3가역',
        lat: 37.5701,
        lng: 126.9916,
        distance: 12,
        category: 'SW8',
        source: 'category',
        score: 0.92,
      },
    ];

    const result = selectBestPoi(candidates, '스타벅스 종로3가점');
    expect(result.selectionTier).toBe(1);
    expect(result.selectedPoi.name).toBe('스타벅스 종로3가점');
  });
});
