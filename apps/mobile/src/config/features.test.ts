import { resolveProductionSafeFlag, resolveRiveRuntimeEnabled } from './features';

describe('resolveProductionSafeFlag', () => {
  it('uses the safe default when the environment variable is absent', () => {
    expect(resolveProductionSafeFlag(undefined, true)).toBe(true);
    expect(resolveProductionSafeFlag(undefined, false)).toBe(false);
  });

  it('honors an explicit rollout switch', () => {
    expect(resolveProductionSafeFlag('true', false)).toBe(true);
    expect(resolveProductionSafeFlag('false', true)).toBe(false);
  });

  it('does not treat arbitrary values as enabled', () => {
    expect(resolveProductionSafeFlag('1', true)).toBe(false);
    expect(resolveProductionSafeFlag('', true)).toBe(false);
  });
});

describe('resolveRiveRuntimeEnabled', () => {
  it('requires both the runtime switch and a validated asset handoff', () => {
    expect(resolveRiveRuntimeEnabled('true', 'true')).toBe(true);
    expect(resolveRiveRuntimeEnabled('true', 'false')).toBe(false);
    expect(resolveRiveRuntimeEnabled('false', 'true')).toBe(false);
    expect(resolveRiveRuntimeEnabled(undefined, undefined)).toBe(false);
  });
});
