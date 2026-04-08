export interface NormalizedTrafficDto {
  source: 'api' | 'fallback';
  fetchedAt: string;
  cacheableForMs: number;
  congestionIndex: number; // 0~1
}
