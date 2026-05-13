import { SafeLogger } from '../../../../../src/common/logger/safe-logger.service';
import {
  mapResponseToRoutes,
  ODSAY_DROP_REASONS,
} from '../../../../../src/modules/recommendation/adapters/odsayRouteAdapter';
import type { OdsayPath } from '../../../../../src/modules/recommendation/types/transit';

describe('odsayRouteAdapter', () => {
  const origin = { name: '강남', lat: 37.4979, lng: 127.0276 };
  const destination = { name: '시청', lat: 37.5665, lng: 126.978 };

  it('maps route when trafficType is number', () => {
    const paths: OdsayPath[] = [
      {
        info: { totalTime: 20, payment: 1450 },
        subPath: [
          { trafficType: 2, sectionTime: 12, distance: 5100, stationCount: 7, lane: [{ busNo: '360' }] },
          { trafficType: 1, sectionTime: 8, distance: 3200, stationCount: 4, lane: [{ name: '2호선' }] },
        ],
      },
    ];

    const result = mapResponseToRoutes(paths, origin, destination, new SafeLogger());

    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]?.mobilitySegments?.[0].mode).toBe('bus');
    expect(result.routes[0]?.mobilitySegments?.[1].mode).toBe('subway');
  });

  it('maps route when trafficType is string', () => {
    const paths: OdsayPath[] = [
      {
        info: { totalTime: 22, payment: 1450 },
        subPath: [
          { trafficType: '2', sectionTime: 10, distance: 4300, stationCount: 5, lane: [{ busNo: '301' }] },
          { trafficType: '1', sectionTime: 12, distance: 6200, stationCount: 6, lane: [{ name: '5호선' }] },
        ],
      },
    ];

    const result = mapResponseToRoutes(paths, origin, destination, new SafeLogger());

    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]?.mobilitySegments?.map((s) => s.mode)).toEqual(['bus', 'subway']);
  });

  it('drops only unsupported segment and keeps route when valid segment exists', () => {
    const paths: OdsayPath[] = [
      {
        info: { totalTime: 15, payment: 1300 },
        subPath: [
          { trafficType: 9, sectionTime: 1, distance: 100 },
          { trafficType: 2, sectionTime: 14, distance: 5000, stationCount: 7, lane: [{ busNo: '241' }] },
        ],
      },
    ];

    const result = mapResponseToRoutes(paths, origin, destination, new SafeLogger());

    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]?.mobilitySegments).toHaveLength(1);
    expect(result.diagnostics.reasons[ODSAY_DROP_REASONS.UNSUPPORTED_TRAFFIC_TYPE]).toBeGreaterThan(0);
  });

  it('creates route from partial valid subPaths', () => {
    const paths: OdsayPath[] = [
      {
        info: { totalTime: 18, payment: 1250 },
        subPath: [
          { trafficType: 2, sectionTime: 9, distance: 3200, stationCount: 4, lane: [{ busNo: 'N13' }] },
          { trafficType: 3, sectionTime: -1, distance: 200 },
          { trafficType: 1, sectionTime: 9, distance: 4800, stationCount: 5, lane: [{ name: '3호선' }] },
        ],
      },
    ];

    const result = mapResponseToRoutes(paths, origin, destination, new SafeLogger());

    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]?.mobilitySegments?.map((s) => s.mode)).toEqual(['bus', 'subway']);
    expect(result.diagnostics.droppedSegmentCount).toBe(1);
  });

  it('drops route when all segments are dropped and records diagnostics', () => {
    const paths: OdsayPath[] = [
      {
        info: { totalTime: 10, payment: 0 },
        subPath: [
          { trafficType: 8, sectionTime: 2, distance: 100 },
          { trafficType: 'abc', sectionTime: 2, distance: 100 },
        ],
      },
    ];

    const result = mapResponseToRoutes(paths, origin, destination, new SafeLogger());

    expect(result.routes).toHaveLength(0);
    expect(result.diagnostics.droppedPathCount).toBe(1);
    expect(result.diagnostics.reasons[ODSAY_DROP_REASONS.ALL_SEGMENTS_DROPPED]).toBe(1);
  });
});
