const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface RecommendLocation {
  name: string;
  lat: number;
  lng: number;
}

export interface RecommendRequest {
  origin: RecommendLocation;
  destination: RecommendLocation;
  arrivalAt: string;
}

export interface RecommendedRoute {
  route: {
    id: string;
    name: string;
    source: 'api' | 'fallback';
    estimatedTravelMinutes: number;
    transferCount: number;
    walkingMinutes: number;
    delayRisk: number;
  };
  departureAt: string;
  expectedArrivalAt: string;
  bufferMinutes: number;
  status: '여유' | '주의' | '긴급' | '위험';
  totalScore: number;
}

export interface RecommendResult {
  primaryRoute: RecommendedRoute;
  alternatives: RecommendedRoute[];
  status: '여유' | '주의' | '긴급' | '위험';
  nextAction: string;
  confidenceScore: number;
  generatedAt: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export async function getHealth(): Promise<{ status: string; service: string }> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  return response.json();
}

export async function recommendRoutes(input: RecommendRequest): Promise<RecommendResult> {
  const response = await fetch(`${API_BASE_URL}/recommendations/calculate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Recommendation failed: ${response.status}`);
  }

  const payload = (await response.json()) as ApiEnvelope<RecommendResult>;
  if (!payload.success) {
    throw new Error('Recommendation API returned unsuccessful response');
  }

  return payload.data;
}
