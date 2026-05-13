import { Injectable } from '@nestjs/common';
import { SafeLogger } from '../../common/logger/safe-logger.service';
import { KakaoLocalService } from './kakao-local.service';
import { normalizeCandidates, type PoiCandidate } from './poi.engine';

export interface NearbyPoiResponse {
  lat: number;
  lng: number;
  roadAddress?: string;
  jibunAddress?: string;
  poiName?: string;
  placeName?: string;
  candidates: PoiCandidate[];
}

export type PoiSelectionTier = 1 | 2 | 3 | 4;

interface BestPoiSelection {
  selectedPoi: PoiCandidate;
  selectionTier: PoiSelectionTier;
}

function normalizeName(value: string): string {
  return value.replace(/\s+/g, '').replace(/[^\w가-힣]/g, '').toLowerCase();
}

export function selectBestPoi(candidates: PoiCandidate[], userSelectedName?: string): BestPoiSelection {
  if (candidates.length === 0) {
    throw new Error('candidates가 비어있습니다');
  }

  const normalizedTarget = normalizeName(userSelectedName ?? '');

  if (normalizedTarget.length > 0) {
    const nameMatch = candidates.find((candidate) => {
      const normalizedName = normalizeName(candidate.name);
      return normalizedName.includes(normalizedTarget) || normalizedTarget.includes(normalizedName);
    });
    if (nameMatch) {
      return { selectedPoi: nameMatch, selectionTier: 1 };
    }
  }

  const keywordExact = candidates.find(
    (candidate) => candidate.source === 'keyword' && Number.isFinite(candidate.distance) && candidate.distance === 0,
  );
  if (keywordExact) {
    return { selectedPoi: keywordExact, selectionTier: 2 };
  }

  const keyword = candidates.find((candidate) => candidate.source === 'keyword');
  if (keyword) {
    return { selectedPoi: keyword, selectionTier: 3 };
  }

  const fallback = [...candidates].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.distance - b.distance;
  })[0];

  return {
    selectedPoi: fallback,
    selectionTier: 4,
  };
}

@Injectable()
export class LocationService {
  private readonly categoryCodes = ['FD6', 'CE7', 'AT4', 'OL7', 'SW8'];

  constructor(
    private readonly kakaoLocalService: KakaoLocalService,
    private readonly logger: SafeLogger,
  ) {}

  private toNumericDistance(rawDistance?: string) {
    const parsed = Number(rawDistance);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
    return Number.POSITIVE_INFINITY;
  }

  private buildKeywordQueries(roadAddress?: string, jibunAddress?: string) {
    const queries = new Set<string>();

    const roadTokens = (roadAddress ?? '')
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length > 1);
    if (roadTokens.length > 0) {
      queries.add(roadTokens.slice(0, 3).join(' '));
    }

    const jibunTokens = (jibunAddress ?? '')
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length > 1);
    if (jibunTokens.length > 0) {
      queries.add(jibunTokens.slice(0, 3).join(' '));
    }

    return Array.from(queries).filter((query) => query.length > 0).slice(0, 3);
  }

  private async getCoordAddressWithRetry(lat: number, lng: number) {
    const tries = await Promise.allSettled([
      this.kakaoLocalService.coord2Address(lat, lng),
      this.kakaoLocalService.coord2Address(lat, lng),
    ]);
    const first = tries.find((item) => item.status === 'fulfilled');
    if (first && first.status === 'fulfilled') {
      return first.value.document;
    }
    return null;
  }

  async getNearbyPoi(
    lat: number,
    lng: number,
    maxRadius = 300,
    userSelectedName?: string,
  ): Promise<NearbyPoiResponse> {
    const effectiveRadius = Math.max(200, Math.min(250, Math.floor(maxRadius)));

    const coordTask = this.getCoordAddressWithRetry(lat, lng);
    const categoryTasks = this.categoryCodes.map((category) =>
      this.kakaoLocalService.searchCategoryNearby(lat, lng, effectiveRadius, category, 5).then((result) => ({
        radius: effectiveRadius,
        category,
        documents: result.documents,
      })),
    );

    const [coordResult, categoryResult] = await Promise.all([
      Promise.allSettled([coordTask]),
      Promise.allSettled(categoryTasks),
    ]);

    const coordData = coordResult[0]?.status === 'fulfilled' ? coordResult[0].value : null;
    const roadAddress = coordData?.road_address?.address_name?.trim() || undefined;
    const jibunAddress = coordData?.address?.address_name?.trim() || undefined;

    const keywordQueries = this.buildKeywordQueries(roadAddress, jibunAddress);
    const keywordResult = await Promise.allSettled(
      keywordQueries.map((query) =>
        this.kakaoLocalService.searchKeywordNearby(lat, lng, maxRadius, query, 3).then((result) => ({
          query,
          documents: result.documents,
        })),
      ),
    );
    const categoryDocCount = categoryResult
      .filter(
        (item): item is PromiseFulfilledResult<{ radius: number; category: string; documents: Array<{ place_name?: string }> }> =>
          item.status === 'fulfilled',
      )
      .reduce((sum, item) => sum + item.value.documents.length, 0);
    const keywordDocCount = keywordResult
      .filter(
        (item): item is PromiseFulfilledResult<{ query: string; documents: Array<{ place_name?: string }> }> =>
          item.status === 'fulfilled',
      )
      .reduce((sum, item) => sum + item.value.documents.length, 0);

    const rawCandidates: Array<Omit<PoiCandidate, 'score'>> = [];
    categoryResult.forEach((item) => {
      if (item.status !== 'fulfilled') {
        return;
      }
      item.value.documents.forEach((doc) => {
        const placeName = doc.place_name?.trim();
        const fallbackName = doc.address_name?.trim();
        const name = placeName || fallbackName;
        if (!name) {
          return;
        }
        const distance = this.toNumericDistance(doc.distance);
        const candLat = Number(doc.y) || lat;
        const candLng = Number(doc.x) || lng;

        rawCandidates.push({
          name,
          lat: candLat,
          lng: candLng,
          distance,
          category: item.value.category || doc.category_group_code || undefined,
          source: 'category',
        });
      });
    });

    keywordResult.forEach((item) => {
      if (item.status !== 'fulfilled') {
        return;
      }
      item.value.documents.forEach((doc) => {
        const name = doc.place_name?.trim();
        if (!name) {
          return;
        }
        rawCandidates.push({
          name,
          lat: Number(doc.y) || lat,
          lng: Number(doc.x) || lng,
          distance: this.toNumericDistance(doc.distance),
          category: doc.category_group_code || undefined,
          source: 'keyword',
        });
      });
    });

    if (roadAddress) {
      rawCandidates.push({
        name: roadAddress,
        lat,
        lng,
        distance: 0,
        category: 'ADDRESS',
        source: 'address',
      });
    }

    if (!roadAddress && jibunAddress) {
      rawCandidates.push({
        name: jibunAddress,
        lat,
        lng,
        distance: 0,
        category: 'ADDRESS',
        source: 'address',
      });
    }

    const candidates = normalizeCandidates(rawCandidates);
    const selection = candidates.length > 0 ? selectBestPoi(candidates, userSelectedName) : null;
    const selected = selection?.selectedPoi ?? null;
    const fallbackUsed = !selection;

    const poiName = selected?.name || roadAddress || jibunAddress;
    const placeName = selected?.name || roadAddress || jibunAddress;
    const finalName = poiName || placeName || roadAddress || jibunAddress || '내 위치';

    this.logger.log(
      {
        event: 'kakao.local.proxy.nearby-poi.candidates',
        lat,
        lng,
        categoryCount: categoryDocCount,
        keywordCount: keywordDocCount,
        candidateCount: candidates.length,
        candidates: candidates.map((candidate) => ({
          name: candidate.name,
          source: candidate.source,
          category: candidate.category,
          distance: candidate.distance,
          score: candidate.score,
        })),
        selectedPoi: selected
          ? {
            name: selected.name,
            source: selected.source,
            score: selected.score,
            distance: selected.distance,
          }
          : null,
        selectionTier: selection?.selectionTier ?? null,
        fallbackUsed,
        finalName,
      },
      LocationService.name,
    );

    return {
      lat,
      lng,
      roadAddress,
      jibunAddress,
      poiName,
      placeName,
      candidates,
    };
  }
}
