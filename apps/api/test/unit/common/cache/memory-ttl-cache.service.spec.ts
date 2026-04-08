import { MemoryTtlCacheService } from '../../../../src/common/cache/memory-ttl-cache.service';

describe('MemoryTtlCacheService', () => {
  it('returns value before ttl and expires after ttl', async () => {
    const service = new MemoryTtlCacheService();

    service.set('k', { value: 1 }, 30);
    const before = service.get<{ value: number }>('k');
    expect(before?.value).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 40));
    const after = service.get<{ value: number }>('k');
    expect(after).toBeNull();
  });

  it('getOrSet caches loaded value', async () => {
    const service = new MemoryTtlCacheService();
    let called = 0;

    const first = await service.getOrSet('loader', 1000, async () => {
      called += 1;
      return { value: 7 };
    });

    const second = await service.getOrSet('loader', 1000, async () => {
      called += 1;
      return { value: 9 };
    });

    expect(first.value).toBe(7);
    expect(second.value).toBe(7);
    expect(called).toBe(1);
  });
});
