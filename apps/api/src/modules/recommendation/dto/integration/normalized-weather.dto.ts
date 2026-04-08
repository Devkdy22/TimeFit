export interface NormalizedWeatherDto {
  source: 'api' | 'fallback';
  fetchedAt: string;
  cacheableForMs: number;
  severityIndex: number; // 0~1
}
