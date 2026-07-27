import { RoutinesService } from '../../../../../src/modules/routines/services/routines.service';

describe('RoutinesService automation timing', () => {
  const appConfig = { timeZone: 'Asia/Seoul' };
  const service = new RoutinesService({} as never, {} as never, {} as never, {} as never, appConfig as never);
  const isWithinTriggerWindow = (routine: Record<string, unknown>, now: Date) =>
    (service as unknown as { isWithinTriggerWindow: (value: unknown, date: Date) => boolean })
      .isWithinTriggerWindow(routine, now);

  it('attaches a registered device token when creating a routine without one', async () => {
    const repository = {
      create: jest.fn().mockResolvedValue({ id: 'routine-1' }),
    };
    const notificationService = {
      getRegisteredPushToken: jest.fn().mockResolvedValue('ExponentPushToken[current]'),
    };
    const service = new RoutinesService(
      repository as never,
      {} as never,
      notificationService as never,
      {} as never,
      appConfig as never,
    );

    await service.createRoutine('user-1', {
      title: '출근',
      origin: { name: '집', lat: 37.5, lng: 127 },
      destination: { name: '회사', lat: 37.6, lng: 127.1 },
      weekdays: [1, 2, 3, 4, 5],
      arrivalTime: '09:00',
    });

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      expoPushToken: 'ExponentPushToken[current]',
    }));
  });

  it('uses the configured lead time for arrival and departure routines', () => {
    const base = new Date(2026, 6, 21, 8, 40, 0);
    const common = {
      arrivalTime: '08:50',
      notificationMinutesBefore: 10,
    };

    expect(isWithinTriggerWindow({ ...common, timeMode: 'arrival' }, base)).toBe(true);
    expect(isWithinTriggerWindow({ ...common, timeMode: 'departure' }, base)).toBe(true);
    expect(isWithinTriggerWindow({ ...common, timeMode: 'arrival' }, new Date(2026, 6, 21, 8, 39))).toBe(false);
    expect(isWithinTriggerWindow({ ...common, timeMode: 'arrival' }, new Date(2026, 6, 21, 8, 42))).toBe(false);
  });

  it('interprets routine clock time in the configured timezone', () => {
    const target = (service as unknown as { buildTargetDate: (date: Date, value: string) => Date }).buildTargetDate.call(
      service,
      new Date('2026-07-21T00:00:00.000Z'),
      '09:00',
    );

    expect(target.toISOString()).toBe('2026-07-21T00:00:00.000Z');
  });

  it('uses the configured timezone for weekday and excluded-date checks', () => {
    const isDueToday = (service as unknown as { isDueToday: (routine: unknown, date: Date) => boolean }).isDueToday;
    const routine = { weekdays: [2], excludedDates: [] };

    expect(isDueToday.call(service, routine, new Date('2026-07-20T15:30:00.000Z'))).toBe(true);
    expect(isDueToday.call(service, { ...routine, excludedDates: ['2026-07-21'] }, new Date('2026-07-20T15:30:00.000Z'))).toBe(false);
  });

  it('starts one automation pass immediately on module initialization', () => {
    jest.useFakeTimers();
    const processAutomations = jest
      .spyOn(service as unknown as { processAutomations: () => Promise<void> }, 'processAutomations')
      .mockResolvedValue(undefined);

    service.onModuleInit();

    expect(processAutomations).toHaveBeenCalledTimes(1);
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  it('does not send a routine push when the routine notification is disabled', async () => {
    const recommendation = {
      primaryRoute: { route: { id: 'route-1' } },
      alternatives: [],
      status: '여유',
      nextAction: '출발 준비를 시작하세요.',
      confidenceScore: 1,
      generatedAt: new Date().toISOString(),
    };
    const routine = {
      id: 'routine-1',
      userId: 'user-1',
      title: '출근',
      origin: { name: '집', lat: 37.5, lng: 127 },
      destination: { name: '회사', lat: 37.6, lng: 127.1 },
      weekdays: [2],
      arrivalTime: '09:00',
      timeMode: 'arrival',
      bufferMinutes: 5,
      preferredMode: 'any',
      excludedDates: [],
      notificationEnabled: false,
      notificationMinutesBefore: 10,
      favorite: false,
      active: true,
      expoPushToken: 'ExponentPushToken[test-token]',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const repository = {
      findOwned: jest.fn().mockResolvedValue(routine),
      markTriggered: jest.fn().mockResolvedValue(undefined),
    };
    const recommendationService = { recommend: jest.fn().mockResolvedValue(recommendation) };
    const notificationService = { sendRoutineNotification: jest.fn() };
    const service = new RoutinesService(
      repository as never,
      recommendationService as never,
      notificationService as never,
      { log: jest.fn(), warn: jest.fn() } as never,
      appConfig as never,
    );

    await service.runRoutineNow('user-1', 'routine-1');

    expect(recommendationService.recommend).toHaveBeenCalledTimes(1);
    expect(repository.markTriggered).toHaveBeenCalledTimes(1);
    expect(notificationService.sendRoutineNotification).not.toHaveBeenCalled();
  });

  it('converts a departure routine into an arrival target using saved travel time and buffer', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-20T15:30:00.000Z'));
    const routine = {
      id: 'routine-departure',
      userId: 'user-1',
      title: '출근',
      origin: { name: '집', lat: 37.5, lng: 127 },
      destination: { name: '회사', lat: 37.6, lng: 127.1 },
      weekdays: [2],
      arrivalTime: '08:00',
      timeMode: 'departure',
      bufferMinutes: 10,
      preferredMode: 'subway',
      excludedDates: [],
      notificationEnabled: false,
      notificationMinutesBefore: 10,
      favorite: false,
      active: true,
      savedRoute: {
        id: 'route-1',
        name: '지하철 경로',
        estimatedTravelMinutes: 35,
        delayRisk: 0.2,
        transferCount: 1,
        walkingMinutes: 8,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const repository = {
      findOwned: jest.fn().mockResolvedValue(routine),
      markTriggered: jest.fn().mockResolvedValue(undefined),
    };
    const recommendationService = { recommend: jest.fn().mockResolvedValue({ emptyState: 'no_route' }) };
    const service = new RoutinesService(
      repository as never,
      recommendationService as never,
      {} as never,
      { log: jest.fn(), warn: jest.fn() } as never,
      appConfig as never,
    );

    await service.runRoutineNow('user-1', 'routine-departure');

    expect(recommendationService.recommend).toHaveBeenCalledWith(expect.objectContaining({
      arrivalAt: '2026-07-20T23:45:00.000Z',
      candidateRoutes: [routine.savedRoute],
      userPreference: expect.objectContaining({
        prepMinutes: 0,
        preferredBufferMinutes: 10,
        preferredMode: 'subway',
      }),
    }));
    jest.useRealTimers();
  });

  it('does not mark a routine triggered when push delivery can be retried', async () => {
    const recommendation = {
      primaryRoute: { route: { id: 'route-1' } },
      alternatives: [],
      status: '여유',
      nextAction: '출발 준비를 시작하세요.',
      confidenceScore: 1,
      generatedAt: new Date().toISOString(),
    };
    const routine = {
      id: 'routine-retry',
      userId: 'user-1',
      title: '출근',
      origin: { name: '집', lat: 37.5, lng: 127 },
      destination: { name: '회사', lat: 37.6, lng: 127.1 },
      weekdays: [2],
      arrivalTime: '09:00',
      timeMode: 'arrival',
      bufferMinutes: 5,
      preferredMode: 'any',
      excludedDates: [],
      notificationEnabled: true,
      notificationMinutesBefore: 10,
      favorite: false,
      active: true,
      expoPushToken: 'ExponentPushToken[test-token]',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const repository = {
      findOwned: jest.fn().mockResolvedValue(routine),
      markTriggered: jest.fn().mockResolvedValue(undefined),
    };
    const recommendationService = { recommend: jest.fn().mockResolvedValue(recommendation) };
    const notificationService = { sendRoutineNotification: jest.fn().mockResolvedValue('failed') };
    const service = new RoutinesService(
      repository as never,
      recommendationService as never,
      notificationService as never,
      { log: jest.fn(), warn: jest.fn() } as never,
      appConfig as never,
    );

    await service.runRoutineNow('user-1', 'routine-retry');

    expect(notificationService.sendRoutineNotification).toHaveBeenCalledTimes(1);
    expect(repository.markTriggered).not.toHaveBeenCalled();
  });

  it('logs and defers the automation pass when PostgreSQL is unavailable', async () => {
    const logger = { log: jest.fn(), warn: jest.fn() };
    const service = new RoutinesService(
      {
        findActive: jest.fn().mockRejectedValue(Object.assign(new Error("Can't reach database server"), { code: 'P1001' })),
      } as never,
      {} as never,
      { processPendingReceipts: jest.fn().mockResolvedValue(undefined) } as never,
      logger as never,
      appConfig as never,
    );

    await (service as unknown as { processAutomations: () => Promise<void> }).processAutomations();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'routine.automation.db_unavailable' }),
      'RoutinesService',
    );
  });
});
