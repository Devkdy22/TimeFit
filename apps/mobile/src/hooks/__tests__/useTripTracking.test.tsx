import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

let mockEventSourceCtor: (new (url: string, init?: { headers?: Record<string, string>; pollingInterval?: number }) => unknown) | null = null;

jest.mock('react-native-sse', () => ({
  __esModule: true,
  default: function EventSourceMock(
    this: unknown,
    url: string,
    init?: { headers?: Record<string, string>; pollingInterval?: number },
  ) {
    if (!mockEventSourceCtor) {
      throw new Error('MockEventSource constructor is not configured');
    }
    return new mockEventSourceCtor(url, init);
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    multiRemove: jest.fn(),
    multiSet: jest.fn(),
  },
}));

import { useTripTracking } from '../useTripTracking';
import {
  fetchRouteCandidates,
  getCurrentAccessTokenForTransport,
  sendTripPosition,
  startTripTracking,
  type MobilityRoutePayload,
} from '../../services/api/client';

jest.mock('../../services/api/client', () => ({
  fetchRouteCandidates: jest.fn(),
  getCurrentAccessTokenForTransport: jest.fn(),
  sendTripPosition: jest.fn(),
  startTripTracking: jest.fn(),
}));

jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

type Listener = (event?: MessageEvent) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];

  public readonly url: string;
  public readonly init?: { headers?: Record<string, string>; pollingInterval?: number };
  public onerror: (() => void) | null = null;
  public close = jest.fn();
  public removeAllEventListeners = jest.fn(() => {
    this.listeners.clear();
  });
  private readonly listeners = new Map<string, Listener[]>();

  constructor(url: string, init?: { headers?: Record<string, string>; pollingInterval?: number }) {
    this.url = url;
    this.init = init;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  emit(type: string, payload: unknown, lastEventId?: string) {
    const listeners = this.listeners.get(type) ?? [];
    const event = {
      data: typeof payload === 'string' ? payload : JSON.stringify(payload),
      lastEventId,
    } as MessageEvent & { lastEventId?: string };
    for (const listener of listeners) {
      listener(event);
    }
  }

  emitError(xhrStatus: number) {
    const listeners = this.listeners.get('error') ?? [];
    const event = {
      type: 'error',
      message: '',
      xhrState: 4,
      xhrStatus,
    } as unknown as MessageEvent;
    for (const listener of listeners) {
      listener(event);
    }
  }
}

const mockedFetchRouteCandidates = jest.mocked(fetchRouteCandidates);
const mockedGetCurrentAccessTokenForTransport = jest.mocked(getCurrentAccessTokenForTransport);
const mockedStartTripTracking = jest.mocked(startTripTracking);
const mockedSendTripPosition = jest.mocked(sendTripPosition);

const route: MobilityRoutePayload = {
  id: 'route-1',
  name: '테스트 경로',
  source: 'api',
  estimatedTravelMinutes: 40,
  delayRisk: 0.2,
  transferCount: 1,
  walkingMinutes: 8,
  mobilitySegments: [],
};

function flushMicrotask() {
  return Promise.resolve();
}

async function settle() {
  await act(async () => {
    await flushMicrotask();
  });
}

describe('useTripTracking failure-case verification', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    MockEventSource.instances = [];
    mockEventSourceCtor = MockEventSource;
    (globalThis as unknown as { EventSource?: typeof MockEventSource }).EventSource = MockEventSource;
    mockedGetCurrentAccessTokenForTransport.mockReturnValue('access-token');
    mockedFetchRouteCandidates.mockResolvedValue({
      source: 'api',
      status: 'OK',
      fetchedAt: '2026-05-27T00:00:00.000Z',
      cacheableForMs: 60_000,
      candidates: [route],
    });
    mockedStartTripTracking.mockResolvedValue({
      tripId: 'trip-1',
      routeId: route.id,
      status: '여유',
      bufferMinutes: 7,
      targetArrivalTime: '2026-05-27T09:00:00.000Z',
    });
    mockedSendTripPosition.mockResolvedValue({
      currentSegmentIndex: 0,
      progress: 0.1,
      isOffRoute: false,
      nextAction: '도보 이동',
      distanceFromRouteMeters: 100,
      matchingConfidence: 0.8,
    });
  });

  afterEach(() => {
    mockEventSourceCtor = null;
    jest.useRealTimers();
  });

  it('start -> SSE open', async () => {
    const getCurrentPosition = jest.fn().mockResolvedValue({ lat: 37.5, lng: 127.0 });
    const stateRef: { current: ReturnType<typeof useTripTracking> | null } = { current: null };

    function Harness() {
      stateRef.current = useTripTracking({
        origin: { name: '출발', lat: 37.5, lng: 127.0 },
        destination: { name: '도착', lat: 37.6, lng: 127.1 },
        targetArrivalTime: '2026-05-27T09:00:00.000Z',
        getCurrentPosition,
      });
      return null;
    }

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<Harness />, { unstable_isConcurrent: false } as never);
      await flushMicrotask();
    });
    expect(stateRef.current).not.toBeNull();

    await act(async () => {
      await stateRef.current!.start();
      await flushMicrotask();
    });
    await settle();

    expect(MockEventSource.instances).toHaveLength(1);
    await act(async () => {
      MockEventSource.instances[0].emit('open', {});
      await flushMicrotask();
    });

    expect(mockedStartTripTracking).toHaveBeenCalledTimes(1);
    expect(mockedStartTripTracking.mock.calls[0]?.[1]?.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].init?.headers?.Authorization).toBe('Bearer access-token');
    expect(MockEventSource.instances[0].init?.pollingInterval).toBe(0);
    await act(async () => {
      renderer!.unmount();
    });
    expect(MockEventSource.instances[0].removeAllEventListeners).toHaveBeenCalledTimes(1);
    expect(MockEventSource.instances[0].close).toHaveBeenCalledTimes(1);
  });

  it('SSE error -> reconnect', async () => {
    const getCurrentPosition = jest.fn().mockResolvedValue({ lat: 37.5, lng: 127.0 });
    const stateRef: { current: ReturnType<typeof useTripTracking> | null } = { current: null };

    function Harness() {
      stateRef.current = useTripTracking({
        origin: { name: '출발', lat: 37.5, lng: 127.0 },
        destination: { name: '도착', lat: 37.6, lng: 127.1 },
        targetArrivalTime: '2026-05-27T09:00:00.000Z',
        getCurrentPosition,
      });
      return null;
    }

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<Harness />, { unstable_isConcurrent: false } as never);
      await flushMicrotask();
    });
    expect(stateRef.current).not.toBeNull();
    await act(async () => {
      await stateRef.current!.start();
      await flushMicrotask();
    });

    expect(MockEventSource.instances).toHaveLength(1);
    await act(async () => {
      MockEventSource.instances[0].emit('open', {});
      await flushMicrotask();
    });
    await settle();
    await act(async () => {
      MockEventSource.instances[0].onerror?.();
      jest.advanceTimersByTime(2_000);
      await flushMicrotask();
    });

    expect(MockEventSource.instances).toHaveLength(2);
    expect(MockEventSource.instances[1].init?.headers?.Authorization).toBe('Bearer access-token');
    await act(async () => {
      renderer!.unmount();
    });
  });

  it('SSE reconnect reads the latest access token', async () => {
    mockedGetCurrentAccessTokenForTransport.mockReturnValueOnce('access-token-1').mockReturnValue('access-token-2');
    const getCurrentPosition = jest.fn().mockResolvedValue({ lat: 37.5, lng: 127.0 });
    const stateRef: { current: ReturnType<typeof useTripTracking> | null } = { current: null };

    function Harness() {
      stateRef.current = useTripTracking({
        origin: { name: '출발', lat: 37.5, lng: 127.0 },
        destination: { name: '도착', lat: 37.6, lng: 127.1 },
        targetArrivalTime: '2026-05-27T09:00:00.000Z',
        getCurrentPosition,
      });
      return null;
    }

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<Harness />, { unstable_isConcurrent: false } as never);
      await flushMicrotask();
    });
    await act(async () => {
      await stateRef.current!.start();
      await flushMicrotask();
      MockEventSource.instances[0].emit('open', {});
      MockEventSource.instances[0].onerror?.();
      jest.advanceTimersByTime(2_000);
      await flushMicrotask();
    });

    expect(MockEventSource.instances).toHaveLength(2);
    expect(MockEventSource.instances[0].init?.headers?.Authorization).toBe('Bearer access-token-1');
    expect(MockEventSource.instances[1].init?.headers?.Authorization).toBe('Bearer access-token-2');
    await act(async () => {
      renderer!.unmount();
    });
  });

  it('SSE 401/403 errors do not reconnect', async () => {
    const getCurrentPosition = jest.fn().mockResolvedValue({ lat: 37.5, lng: 127.0 });
    const stateRef: { current: ReturnType<typeof useTripTracking> | null } = { current: null };

    function Harness() {
      stateRef.current = useTripTracking({
        origin: { name: '출발', lat: 37.5, lng: 127.0 },
        destination: { name: '도착', lat: 37.6, lng: 127.1 },
        targetArrivalTime: '2026-05-27T09:00:00.000Z',
        getCurrentPosition,
      });
      return null;
    }

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<Harness />, { unstable_isConcurrent: false } as never);
      await flushMicrotask();
    });
    await act(async () => {
      await stateRef.current!.start();
      await flushMicrotask();
      MockEventSource.instances[0].emit('open', {});
      MockEventSource.instances[0].emitError(401);
      jest.advanceTimersByTime(10_000);
      await flushMicrotask();
    });

    expect(MockEventSource.instances).toHaveLength(1);
    expect(stateRef.current?.isRunning).toBe(false);
    expect(stateRef.current?.error).toBe('auth_required');
    await act(async () => {
      renderer!.unmount();
    });
  });

  it('stop 직후 reconnect 차단', async () => {
    const getCurrentPosition = jest.fn().mockResolvedValue({ lat: 37.5, lng: 127.0 });
    const stateRef: { current: ReturnType<typeof useTripTracking> | null } = { current: null };

    function Harness() {
      stateRef.current = useTripTracking({
        origin: { name: '출발', lat: 37.5, lng: 127.0 },
        destination: { name: '도착', lat: 37.6, lng: 127.1 },
        targetArrivalTime: '2026-05-27T09:00:00.000Z',
        getCurrentPosition,
      });
      return null;
    }

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<Harness />, { unstable_isConcurrent: false } as never);
      await flushMicrotask();
    });
    expect(stateRef.current).not.toBeNull();
    await act(async () => {
      await stateRef.current!.start();
      await flushMicrotask();
    });

    await act(async () => {
      MockEventSource.instances[0].emit('open', {});
      await flushMicrotask();
      MockEventSource.instances[0].onerror?.();
      stateRef.current?.stop();
      jest.advanceTimersByTime(10_000);
      await flushMicrotask();
    });

    expect(MockEventSource.instances).toHaveLength(1);
    expect(stateRef.current?.isRunning).toBe(false);
    await act(async () => {
      renderer!.unmount();
    });
  });

  it('stale callback ignored', async () => {
    const getCurrentPosition = jest.fn().mockResolvedValue({ lat: 37.5, lng: 127.0 });
    const stateRef: { current: ReturnType<typeof useTripTracking> | null } = { current: null };

    function Harness() {
      stateRef.current = useTripTracking({
        origin: { name: '출발', lat: 37.5, lng: 127.0 },
        destination: { name: '도착', lat: 37.6, lng: 127.1 },
        targetArrivalTime: '2026-05-27T09:00:00.000Z',
        getCurrentPosition,
      });
      return null;
    }

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<Harness />, { unstable_isConcurrent: false } as never);
      await flushMicrotask();
    });
    expect(stateRef.current).not.toBeNull();
    await act(async () => {
      await stateRef.current!.start();
      await flushMicrotask();
    });

    const oldSource = MockEventSource.instances[0];

    await act(async () => {
      stateRef.current?.stop();
      oldSource.emit('STATUS_CHANGED', {
        routeSummary: { status: '긴급' },
      });
      await flushMicrotask();
    });

    expect(stateRef.current?.status).not.toBe('긴급');
    await act(async () => {
      renderer!.unmount();
    });
  });

  it('duplicate position send blocked', async () => {
    let resolvePosition: ((value: { lat: number; lng: number }) => void) | null = null;
    const getCurrentPosition = jest
      .fn()
      .mockResolvedValueOnce({ lat: 37.5, lng: 127.0 })
      .mockImplementation(
        () =>
          new Promise<{ lat: number; lng: number }>((resolve) => {
            resolvePosition = resolve;
          }),
      );
    const stateRef: { current: ReturnType<typeof useTripTracking> | null } = { current: null };

    function Harness() {
      stateRef.current = useTripTracking({
        origin: { name: '출발', lat: 37.5, lng: 127.0 },
        destination: { name: '도착', lat: 37.6, lng: 127.1 },
        targetArrivalTime: '2026-05-27T09:00:00.000Z',
        getCurrentPosition,
      });
      return null;
    }

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<Harness />, { unstable_isConcurrent: false } as never);
      await flushMicrotask();
    });
    expect(stateRef.current).not.toBeNull();
    await act(async () => {
      await stateRef.current!.start();
      await flushMicrotask();
    });

    await act(async () => {
      jest.advanceTimersByTime(8_000);
      await flushMicrotask();
    });

    expect(mockedSendTripPosition).toHaveBeenCalledTimes(0);

    await act(async () => {
      resolvePosition?.({ lat: 37.5, lng: 127.0 });
      await flushMicrotask();
      await flushMicrotask();
    });
    await act(async () => {
      jest.advanceTimersByTime(1);
      await flushMicrotask();
    });

    expect(mockedSendTripPosition).toHaveBeenCalledTimes(1);
    await act(async () => {
      renderer!.unmount();
    });
  });

  it('reconnect storm suppression', async () => {
    const getCurrentPosition = jest.fn().mockResolvedValue({ lat: 37.5, lng: 127.0 });
    const stateRef: { current: ReturnType<typeof useTripTracking> | null } = { current: null };

    function Harness() {
      stateRef.current = useTripTracking({
        origin: { name: '출발', lat: 37.5, lng: 127.0 },
        destination: { name: '도착', lat: 37.6, lng: 127.1 },
        targetArrivalTime: '2026-05-27T09:00:00.000Z',
        getCurrentPosition,
      });
      return null;
    }

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<Harness />, { unstable_isConcurrent: false } as never);
      await flushMicrotask();
    });
    expect(stateRef.current).not.toBeNull();
    await act(async () => {
      await stateRef.current!.start();
      await flushMicrotask();
      MockEventSource.instances[0].emit('open', {});
      await flushMicrotask();
    });

    await act(async () => {
      MockEventSource.instances[0].onerror?.();
      MockEventSource.instances[0].onerror?.();
      MockEventSource.instances[0].onerror?.();
      jest.advanceTimersByTime(2_000);
      await flushMicrotask();
    });

    expect(MockEventSource.instances.length).toBeLessThanOrEqual(2);
    await act(async () => {
      renderer!.unmount();
    });
  });
});
