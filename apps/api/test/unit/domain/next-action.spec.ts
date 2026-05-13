import { generateNextAction } from '../../../src/domain/nextAction';

describe('generateNextAction', () => {
  it('returns high urgency when departure is imminent before boarding', () => {
    const result = generateNextAction(
      {
        mode: 'bus',
        durationMinutes: 8,
      },
      0.05,
      { etaMinutes: 3 },
      { departureInMinutes: 1 },
    );

    expect(result.urgency).toBe('HIGH');
  });
});
