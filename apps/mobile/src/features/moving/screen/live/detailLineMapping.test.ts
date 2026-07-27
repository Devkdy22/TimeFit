import { mapVisibleSegmentIndices } from '../../model/detailLineMapping';

describe('mapVisibleSegmentIndices', () => {
  it('keeps source indexes when car segments are hidden from the UI', () => {
    expect(mapVisibleSegmentIndices([
      { mode: 'walk' },
      { mode: 'car' },
      { mode: 'bus' },
      { mode: 'subway' },
    ])).toEqual([0, 2, 3]);
  });

  it('keeps display indexes separate from source indexes', () => {
    const sourceIndexes = mapVisibleSegmentIndices([
      { mode: 'walk' },
      { mode: 'car' },
      { mode: 'bus' },
    ]);
    const lines = sourceIndexes.map((sourceSegmentIndex, displaySegmentIndex) => ({
      sourceSegmentIndex,
      displaySegmentIndex,
    }));

    expect(lines).toEqual([
      { sourceSegmentIndex: 0, displaySegmentIndex: 0 },
      { sourceSegmentIndex: 2, displaySegmentIndex: 1 },
    ]);
  });
});
