export type RouteMode = 'walk' | 'bus' | 'subway' | 'car';

export function mapVisibleSegmentIndices(segments: Array<{ mode: RouteMode }>): number[] {
  return segments.reduce<number[]>((indices, segment, sourceIndex) => {
    if (segment.mode !== 'car') indices.push(sourceIndex);
    return indices;
  }, []);
}
