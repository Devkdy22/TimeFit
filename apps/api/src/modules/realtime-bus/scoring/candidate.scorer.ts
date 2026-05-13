import { Injectable } from '@nestjs/common';
import type { BusProviderCandidate, BusSegmentInput } from '../realtime-bus.types';
import { RouteNameMatcher } from '../matchers/route-name.matcher';
import { StationMatcher } from '../matchers/station.matcher';

@Injectable()
export class CandidateScorer {
  constructor(
    private readonly routeNameMatcher: RouteNameMatcher,
    private readonly stationMatcher: StationMatcher,
  ) {}

  score(
    candidate: Omit<BusProviderCandidate, 'score'>,
    segment: BusSegmentInput,
  ): BusProviderCandidate['scoreBreakdown'] & { total: number } {
    let arsMatch = 0;
    let lineMatch = 0;
    let distanceScore = 0;
    let stationNameScore = 0;
    let providerPriority = 0;
    const penalty = 0;

    const segmentArs = this.readDigits(segment.startArsId);
    const candidateArs = this.readDigits(candidate.station.arsId);
    if (segmentArs && candidateArs && segmentArs === candidateArs) {
      arsMatch = 40;
    }

    if (this.routeNameMatcher.isMatch(segment.lineLabel, candidate.route.routeName)) {
      lineMatch = 30;
    }

    const distance = this.stationMatcher.distanceMeters(
      { lat: segment.startLat, lng: segment.startLng },
      { lat: candidate.station.lat, lng: candidate.station.lng },
    );
    if (distance < 100) {
      distanceScore = 20;
    } else if (distance < 150) {
      distanceScore = 10;
    }

    const nameSimilarity = this.stationMatcher.similarity(segment.startName, candidate.station.stationName);
    if (nameSimilarity >= 0.8) {
      stationNameScore = 15;
    } else if (nameSimilarity >= 0.6) {
      stationNameScore = 8;
    }

    if (segment.startStationId && candidate.station.stationId.includes(segment.startStationId)) {
      stationNameScore += 5;
    }

    if (candidate.route.direction && segment.startName) {
      const source = this.stationMatcher.normalize(segment.startName);
      const direction = this.stationMatcher.normalize(candidate.route.direction);
      if (source && direction && source.includes(direction)) {
        stationNameScore += 10;
      }
    }

    providerPriority = candidate.provider === 'SEOUL' ? 5 : 3;

    const total =
      arsMatch + lineMatch + distanceScore + stationNameScore + providerPriority - penalty;

    return {
      arsMatch,
      lineMatch,
      distanceScore,
      stationNameScore,
      providerPriority,
      penalty,
      total,
    };
  }

  private readDigits(value?: string): string {
    return (value ?? '').replace(/[^0-9]/g, '');
  }
}
