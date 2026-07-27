export function segmentProgress(index: number, progressCutoff: number): number {
  return Math.max(0, Math.min(1, progressCutoff - index));
}

export function segmentProgressByLengths(index: number, progress: number, lengths: number[]): number {
  const safeLengths = lengths.map((length) => (Number.isFinite(length) && length > 0 ? length : 0));
  const totalLength = safeLengths.reduce((total, length) => total + length, 0);
  if (totalLength <= 0) {
    return segmentProgress(index, progress * lengths.length);
  }

  const cutoff = Math.max(0, Math.min(1, progress)) * totalLength;
  const segmentStart = safeLengths.slice(0, index).reduce((total, length) => total + length, 0);
  const segmentLength = safeLengths[index] ?? 0;
  if (segmentLength <= 0) {
    return cutoff > segmentStart ? 1 : 0;
  }
  return Math.max(0, Math.min(1, (cutoff - segmentStart) / segmentLength));
}
