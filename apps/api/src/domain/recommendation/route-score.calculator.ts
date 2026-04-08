import {
  type RiskLevel,
  type RouteCandidate,
  type ScheduleState,
  type ScoredRoute,
  type UserPreference,
} from '../../modules/recommendation/types/recommendation.types';

interface RouteScoreInput {
  route: RouteCandidate;
  arrivalAt: Date;
  preference: UserPreference;
}

export function calculateRouteScore(input: RouteScoreInput): ScoredRoute {
  const expectedDelayMinutes = Math.round(input.route.delayRisk * 5);
  const expectedTravelMinutes = input.route.estimatedTravelMinutes + expectedDelayMinutes;

  const departureAt = new Date(
    input.arrivalAt.getTime() - input.route.estimatedTravelMinutes * 60_000,
  );

  const expectedArrivalAt = new Date(departureAt.getTime() + expectedTravelMinutes * 60_000);
  const bufferMinutes = Math.floor((input.arrivalAt.getTime() - expectedArrivalAt.getTime()) / 60_000);

  const punctuality = getPunctualityScore(bufferMinutes);
  const safety = getSafetyScore(bufferMinutes, input.preference.preferredBufferMinutes);
  const earlyArrivalPenalty = getEarlyArrivalPenalty(bufferMinutes);
  const transferPenalty = input.route.transferCount * 6 * input.preference.transferPenaltyWeight;
  const walkingPenalty = input.route.walkingMinutes * 0.5 * input.preference.walkingPenaltyWeight;
  const delayPenalty = input.route.delayRisk * 50;
  const bufferPenalty = getBufferPenalty(bufferMinutes);

  const baseScore = 100;

  const totalScore = Math.max(
    0,
    Math.round(
      baseScore -
        transferPenalty -
        walkingPenalty -
        earlyArrivalPenalty -
        bufferPenalty -
        delayPenalty +
        punctuality +
        safety,
    ),
  );

  const status = resolveScheduleState(bufferMinutes);
  const riskLevel = resolveRiskLevel(input.route.delayRisk, status);

  return {
    route: input.route,
    departureAt: departureAt.toISOString(),
    expectedArrivalAt: expectedArrivalAt.toISOString(),
    bufferMinutes,
    status,
    scoreBreakdown: {
      punctuality,
      safety,
      earlyArrivalPenalty,
      transferPenalty,
      walkingPenalty,
      delayPenalty,
      bufferPenalty,
    },
    totalScore,
    riskLevel,
  };
}

function getPunctualityScore(bufferMinutes: number): number {
  if (bufferMinutes < 0) {
    return 0;
  }

  if (bufferMinutes >= 10) {
    return 45;
  }

  return 25 + bufferMinutes * 2;
}

function getSafetyScore(bufferMinutes: number, preferredBufferMinutes: number): number {
  if (bufferMinutes < 0) {
    return 0;
  }

  if (bufferMinutes >= preferredBufferMinutes) {
    return 30;
  }

  return Math.max(0, 15 + bufferMinutes * 2);
}

function getEarlyArrivalPenalty(bufferMinutes: number): number {
  const earlyThreshold = 12;
  if (bufferMinutes <= earlyThreshold) {
    return 0;
  }

  return (bufferMinutes - earlyThreshold) * 1.5;
}

function getBufferPenalty(bufferMinutes: number): number {
  if (bufferMinutes >= 5) {
    return 0;
  }

  if (bufferMinutes >= 2) {
    return 3;
  }

  if (bufferMinutes >= 0) {
    return 6;
  }

  return Math.abs(bufferMinutes) * 5;
}

function resolveScheduleState(bufferMinutes: number): ScheduleState {
  if (bufferMinutes >= 5) {
    return '여유';
  }

  if (bufferMinutes >= 2 && bufferMinutes <= 4) {
    return '주의';
  }

  if (bufferMinutes >= 0 && bufferMinutes <= 1) {
    return '긴급';
  }

  return '위험';
}

function resolveRiskLevel(delayRisk: number, state: ScheduleState): RiskLevel {
  if (state === '위험' || delayRisk >= 0.7) {
    return 'high';
  }

  if (state === '긴급' || delayRisk >= 0.4) {
    return 'medium';
  }

  return 'low';
}
