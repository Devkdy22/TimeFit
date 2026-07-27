import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from '../../../../src/modules/health/health.controller';

describe('HealthController', () => {
  it('keeps /health independent from database readiness', () => {
    const controller = new HealthController({ checkDatabase: jest.fn() } as never);

    expect(controller.check()).toEqual(expect.objectContaining({
      success: true,
      data: { status: 'ok', service: 'timefit-api' },
    }));
  });

  it('returns a ready response after the database probe succeeds', async () => {
    const controller = new HealthController({ checkDatabase: jest.fn().mockResolvedValue(undefined) } as never);

    await expect(controller.ready()).resolves.toEqual(expect.objectContaining({
      success: true,
      data: { status: 'ready', service: 'timefit-api', database: 'ok' },
    }));
  });

  it('returns 503 without exposing the database error when the probe fails', async () => {
    const controller = new HealthController({
      checkDatabase: jest.fn().mockRejectedValue(new Error('database secret details')),
    } as never);

    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(controller.ready()).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is unavailable',
      }),
      status: 503,
    });
  });
});
