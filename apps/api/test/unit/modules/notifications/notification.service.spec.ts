import { NotificationService } from '../../../../src/modules/notifications/services/notification.service';

const appConfig = { timeZone: 'Asia/Seoul' };

describe('NotificationService push token registration', () => {
  it('uses the configured local date for routine notification deduplication', () => {
    const service = new NotificationService(
      {} as never,
      { log: jest.fn(), warn: jest.fn() } as never,
      appConfig as never,
    );

    expect((service as unknown as { toDateKey: (date: Date) => string }).toDateKey(new Date('2026-07-21T15:30:00.000Z'))).toBe('2026-07-22');
  });

  it('updates the device and existing routines for the authenticated user', async () => {
    const db = {
      device: {
        findFirst: jest.fn().mockResolvedValue({ id: 'device-1' }),
        update: jest.fn().mockResolvedValue({ id: 'device-1' }),
        create: jest.fn(),
      },
      routine: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      trip: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new NotificationService(
      {} as never,
      { log: jest.fn(), warn: jest.fn() } as never,
      appConfig as never,
    );
    jest.spyOn(service as unknown as { getPrismaClient: () => Promise<unknown> }, 'getPrismaClient').mockResolvedValue(db);

    await expect(
      service.registerPushToken('user-1', {
        token: 'ExponentPushToken[test-token]',
        platform: 'ios',
      }),
    ).resolves.toEqual({ registered: true });

    expect(db.device.update).toHaveBeenCalledWith({
      where: { id: 'device-1' },
      data: { pushToken: 'ExponentPushToken[test-token]' },
    });
    expect(db.device.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', platform: 'ios' },
      orderBy: { updatedAt: 'desc' },
    });
    expect(db.routine.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { expoPushToken: 'ExponentPushToken[test-token]' },
    });
  });

  it('resolves the latest registered token for newly created routines', async () => {
    const db = {
      device: {
        findFirst: jest.fn().mockResolvedValue({ id: 'device-1', pushToken: 'ExponentPushToken[current]' }),
      },
    };
    const service = new NotificationService(
      {} as never,
      { log: jest.fn(), warn: jest.fn() } as never,
      appConfig as never,
    );
    jest.spyOn(service as unknown as { getPrismaClient: () => Promise<unknown> }, 'getPrismaClient').mockResolvedValue(db);

    await expect(service.getRegisteredPushToken('user-1')).resolves.toBe('ExponentPushToken[current]');
    expect(db.device.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { updatedAt: 'desc' },
    });
  });

  it('does not send routine pushes when the user disabled notifications', async () => {
    const send = jest.fn();
    const service = new NotificationService(
      { send } as never,
      { log: jest.fn(), warn: jest.fn() } as never,
      appConfig as never,
    );
    jest.spyOn(service as unknown as { getPrismaClient: () => Promise<unknown> }, 'getPrismaClient').mockResolvedValue({
      preference: { findFirst: jest.fn().mockResolvedValue({ notificationEnabled: false }) },
    });

    await service.sendRoutineNotification({
      userId: 'user-1',
      pushToken: 'ExponentPushToken[test-token]',
      routineId: 'routine-1',
      title: 'title',
      body: 'body',
      recommendation: {} as never,
    });

    expect(send).not.toHaveBeenCalled();
  });

  it('does not resend a routine event already marked as sent', async () => {
    const send = jest.fn();
    const service = new NotificationService(
      { send } as never,
      { log: jest.fn(), warn: jest.fn() } as never,
      appConfig as never,
    );
    jest.spyOn(service as unknown as { getPrismaClient: () => Promise<unknown> }, 'getPrismaClient').mockResolvedValue({
      preference: { findFirst: jest.fn().mockResolvedValue({ notificationEnabled: true }) },
      notification: {
        findUnique: jest.fn().mockResolvedValue({ id: 'notification-1', status: 'sent', createdAt: new Date() }),
      },
    });

    await expect(service.sendRoutineNotification({
      userId: 'user-1',
      pushToken: 'ExponentPushToken[test-token]',
      routineId: 'routine-1',
      title: 'title',
      body: 'body',
      recommendation: {} as never,
    })).resolves.toBe('already_sent');

    expect(send).not.toHaveBeenCalled();
  });

  it('does not mark a routine notification successful while another worker is sending it', async () => {
    const send = jest.fn();
    const service = new NotificationService(
      { send } as never,
      { log: jest.fn(), warn: jest.fn() } as never,
      appConfig as never,
    );
    jest.spyOn(service as unknown as { getPrismaClient: () => Promise<unknown> }, 'getPrismaClient').mockResolvedValue({
      preference: { findFirst: jest.fn().mockResolvedValue({ notificationEnabled: true }) },
      notification: {
        findUnique: jest.fn().mockResolvedValue({ id: 'notification-in-flight', status: 'sending', createdAt: new Date() }),
      },
    });

    await expect(service.sendRoutineNotification({
      userId: 'user-1',
      pushToken: 'ExponentPushToken[test-token]',
      routineId: 'routine-in-flight',
      title: 'title',
      body: 'body',
      recommendation: {} as never,
    })).resolves.toBe('in_flight');

    expect(send).not.toHaveBeenCalled();
  });

  it('claims a failed routine event atomically before retrying it', async () => {
    const send = jest.fn().mockResolvedValue('sent');
    const db = {
      preference: { findFirst: jest.fn().mockResolvedValue({ notificationEnabled: true }) },
      notification: {
        findUnique: jest.fn().mockResolvedValue({ id: 'notification-1', status: 'failed', createdAt: new Date() }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({ id: 'notification-1' }),
      },
    };
    const service = new NotificationService(
      { send } as never,
      { log: jest.fn(), warn: jest.fn() } as never,
      appConfig as never,
    );
    jest.spyOn(service as unknown as { getPrismaClient: () => Promise<unknown> }, 'getPrismaClient').mockResolvedValue(db);

    await service.sendRoutineNotification({
      userId: 'user-1',
      pushToken: 'ExponentPushToken[test-token]',
      routineId: 'routine-1',
      title: 'title',
      body: 'body',
      recommendation: { primaryRoute: { route: { id: 'route-1' } } } as never,
    });

    expect(db.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'notification-1', status: 'failed' },
      data: { status: 'sending', sentAt: null, scheduledAt: expect.any(Date) },
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('clears a malformed legacy token after Expo skips it', async () => {
    const send = jest.fn().mockResolvedValue('skipped');
    const db = {
      preference: { findFirst: jest.fn().mockResolvedValue({ notificationEnabled: true }) },
      notification: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'notification-invalid-token' }),
        update: jest.fn().mockResolvedValue({ id: 'notification-invalid-token' }),
      },
      device: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      routine: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      trip: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const service = new NotificationService(
      { send } as never,
      { log: jest.fn(), warn: jest.fn() } as never,
      appConfig as never,
    );
    jest.spyOn(service as unknown as { getPrismaClient: () => Promise<unknown> }, 'getPrismaClient').mockResolvedValue(db);

    await expect(service.sendRoutineNotification({
      userId: 'user-legacy-token',
      pushToken: 'legacy-token',
      routineId: 'routine-legacy-token',
      title: 'title',
      body: 'body',
      recommendation: { primaryRoute: { route: { id: 'route-1' } } } as never,
    })).resolves.toBe('skipped');

    expect(db.device.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-legacy-token', pushToken: 'legacy-token' },
      data: { pushToken: null },
    });
    expect(db.routine.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-legacy-token', expoPushToken: 'legacy-token' },
      data: { expoPushToken: null },
    });
  });

  it('clears a token when a delayed Expo receipt reports DeviceNotRegistered', async () => {
    const db = {
      device: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      routine: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      trip: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      notification: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'notification-receipt-1',
            userId: 'user-receipt',
            providerTicketId: 'ticket-receipt-1',
            providerPushToken: 'ExponentPushToken[expired]',
          },
        ]),
        update: jest.fn().mockResolvedValue({ id: 'notification-receipt-1' }),
      },
    };
    const service = new NotificationService(
      { getReceipts: jest.fn().mockResolvedValue({
        'ticket-receipt-1': { status: 'error', details: { error: 'DeviceNotRegistered' } },
      }) } as never,
      { log: jest.fn(), warn: jest.fn() } as never,
      appConfig as never,
    );
    jest.spyOn(service as unknown as { getPrismaClient: () => Promise<unknown> }, 'getPrismaClient').mockResolvedValue(db);

    await service.processPendingReceipts();

    expect(db.device.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-receipt', pushToken: 'ExponentPushToken[expired]' },
      data: { pushToken: null },
    });
    expect(db.notification.update).toHaveBeenCalledWith({
      where: { id: 'notification-receipt-1' },
      data: { status: 'failed', receiptCheckedAt: expect.any(Date) },
    });
  });

  it('does not throw when the receipt query cannot reach PostgreSQL', async () => {
    const service = new NotificationService(
      { getReceipts: jest.fn() } as never,
      { log: jest.fn(), warn: jest.fn() } as never,
      appConfig as never,
    );
    jest.spyOn(service as unknown as { getPrismaClient: () => Promise<unknown> }, 'getPrismaClient').mockResolvedValue({
      notification: {
        findMany: jest.fn().mockRejectedValue(Object.assign(new Error("Can't reach database server"), { code: 'P1001' })),
      },
    });

    await expect(service.processPendingReceipts()).resolves.toBeUndefined();
  });

  it('sends a live departure notification once and persists the dedup status', async () => {
    const send = jest.fn().mockResolvedValue('sent');
    const db = {
      preference: {
        findFirst: jest.fn().mockResolvedValue({
          notificationEnabled: true,
          departureLeadMinutes: 10,
          delayNotificationEnabled: true,
          rerouteNotificationEnabled: true,
          vibrationEnabled: true,
        }),
      },
      notification: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'notification-1' }),
        update: jest.fn().mockResolvedValue({ id: 'notification-1' }),
      },
    };
    const service = new NotificationService(
      { send } as never,
      { log: jest.fn(), warn: jest.fn() } as never,
      appConfig as never,
    );
    jest.spyOn(service as unknown as { getPrismaClient: () => Promise<unknown> }, 'getPrismaClient').mockResolvedValue(db);

    const expectedArrivalAt = new Date(Date.now() + 30 * 60_000).toISOString();
    const trip = {
      id: 'trip-1',
      userId: 'user-1',
      departureAt: new Date(Date.now() + 4 * 60_000).toISOString(),
      expectedArrivalAt,
      expoPushToken: 'ExponentPushToken[test-token]',
    } as never;
    const input = {
      trip,
      currentStatus: '여유',
      remainingMinutes: 20,
      estimatedArrivalAt: expectedArrivalAt,
      delayMinutes: 0,
    } as never;

    await service.handleTripLiveNotification(input);
    await service.handleTripLiveNotification(input);

    expect(send).toHaveBeenCalledTimes(1);
    expect(db.notification.create).toHaveBeenCalledTimes(1);
    expect(db.notification.update).toHaveBeenCalledWith({
      where: { id: 'notification-1' },
      data: { status: 'sent', sentAt: expect.any(Date) },
    });
  });

  it('sends a route-changed notification once for each reroute count', async () => {
    const send = jest.fn().mockResolvedValue('sent');
    const db = {
      preference: {
        findFirst: jest.fn().mockResolvedValue({
          notificationEnabled: true,
          departureLeadMinutes: 5,
          delayNotificationEnabled: true,
          rerouteNotificationEnabled: true,
          vibrationEnabled: true,
        }),
      },
      notification: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'notification-reroute-1' }),
        update: jest.fn().mockResolvedValue({ id: 'notification-reroute-1' }),
      },
    };
    const service = new NotificationService(
      { send } as never,
      { log: jest.fn(), warn: jest.fn() } as never,
      appConfig as never,
    );
    jest.spyOn(service as unknown as { getPrismaClient: () => Promise<unknown> }, 'getPrismaClient').mockResolvedValue(db);

    const expectedArrivalAt = new Date(Date.now() + 90 * 60_000).toISOString();
    const trip = {
      id: 'trip-reroute',
      userId: 'user-1',
      departureAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      expectedArrivalAt,
      expoPushToken: 'ExponentPushToken[test-token]',
    } as never;
    const input = {
      trip,
      currentStatus: '여유',
      remainingMinutes: 20,
      estimatedArrivalAt: expectedArrivalAt,
      delayMinutes: 0,
      rerouteOccurred: true,
      rerouteCount: 1,
      nextRouteId: 'route-2',
      rerouteReason: 'off_route',
    } as never;

    await service.handleTripLiveNotification(input);
    await service.handleTripLiveNotification(input);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      title: '경로가 변경되었습니다',
      data: expect.objectContaining({ type: 'route_changed', nextRouteId: 'route-2' }),
    }));
  });

  it('retries a failed delay notification on the next live update', async () => {
    const send = jest.fn()
      .mockResolvedValueOnce('failed')
      .mockResolvedValueOnce('sent');
    const db = {
      preference: {
        findFirst: jest.fn().mockResolvedValue({
          notificationEnabled: true,
          departureLeadMinutes: 5,
          delayNotificationEnabled: true,
          rerouteNotificationEnabled: false,
          vibrationEnabled: true,
        }),
      },
      notification: {
        findUnique: jest.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'notification-delay-1', status: 'failed', createdAt: new Date(0) }),
        create: jest.fn().mockResolvedValue({ id: 'notification-delay-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({ id: 'notification-delay-1' }),
      },
    };
    const service = new NotificationService(
      { send } as never,
      { log: jest.fn(), warn: jest.fn() } as never,
      appConfig as never,
    );
    jest.spyOn(service as unknown as { getPrismaClient: () => Promise<unknown> }, 'getPrismaClient').mockResolvedValue(db);

    const expectedArrivalAt = new Date(Date.now() + 30 * 60_000).toISOString();
    const trip = {
      id: 'trip-delay-retry',
      userId: 'user-1',
      departureAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      expectedArrivalAt,
      expoPushToken: 'ExponentPushToken[test-token]',
    } as never;
    const input = {
      trip,
      currentStatus: '여유',
      remainingMinutes: 20,
      estimatedArrivalAt: expectedArrivalAt,
      delayMinutes: 5,
    } as never;

    await service.handleTripLiveNotification(input);
    await service.handleTripLiveNotification(input);

    expect(send).toHaveBeenCalledTimes(2);
    expect(db.notification.update).toHaveBeenLastCalledWith({
      where: { id: 'notification-delay-1' },
      data: { status: 'sent', sentAt: expect.any(Date) },
    });
  });
});
