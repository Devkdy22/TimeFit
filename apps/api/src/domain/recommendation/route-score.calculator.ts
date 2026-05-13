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
  const requiredEarlyBufferMinutes = Math.max(5, input.preference.preferredBufferMinutes);
  const targetArrivalAt = new Date(
    input.arrivalAt.getTime() - requiredEarlyBufferMinutes * 60_000,
  );
  const expectedDelayMinutes = Math.round(input.route.delayRisk * 5);
  const baselineTravelMinutes =
    input.route.realtimeAdjustedDurationMinutes ?? input.route.estimatedTravelMinutes;
  // Include realtime delay risk when deriving recommended departure time.
  const expectedTravelMinutes = baselineTravelMinutes + expectedDelayMinutes;
  const now = new Date();
  const readyAt = new Date(now.getTime() + input.preference.prepMinutes * 60_000);

  // Arrival-first model with safety buffer: arrive before user's requested time.
  const departureAt = new Date(
    targetArrivalAt.getTime() - expectedTravelMinutes * 60_000,
  );

  const expectedArrivalAtByReady = new Date(readyAt.getTime() + expectedTravelMinutes * 60_000);
  const scheduledExpectedArrivalAt = new Date(departureAt.getTime() + expectedTravelMinutes * 60_000);
  // If planned departure is already in the past, expose the physically reachable arrival time.
  const expectedArrivalAt = new Date(
    Math.max(scheduledExpectedArrivalAt.getTime(), expectedArrivalAtByReady.getTime()),
  );
  const bufferMinutes = Math.floor((targetArrivalAt.getTime() - expectedArrivalAtByReady.getTime()) / 60_000);

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
  // Excessively early departures should be discouraged,
  // but the penalty must be capped so scores do not collapse to zero.
  const over = bufferMinutes - earlyThreshold;
  const cappedOver = Math.min(over, 20);
  return cappedOver * 1.5;
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
