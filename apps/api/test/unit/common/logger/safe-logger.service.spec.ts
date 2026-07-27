import { ConsoleLogger } from '@nestjs/common';
import { SafeLogger } from '../../../../src/common/logger/safe-logger.service';

describe('SafeLogger', () => {
  afterEach(() => jest.restoreAllMocks());

  it('recursively masks credentials, headers, and provider URLs', () => {
    const logger = new SafeLogger();
    const logSpy = jest.spyOn(ConsoleLogger.prototype, 'log').mockImplementation(() => undefined);

    logger.log({
      nested: {
        accessToken: 'access-secret',
        headers: { Authorization: 'Bearer access-secret' },
        requestUrl: 'https://provider.example/routes?apiKey=provider-secret&mode=transit',
      },
      providerError: 'https://provider.example/error?token=provider-secret',
    });

    const payload = logSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toEqual({
      nested: {
        accessToken: '***',
        headers: { Authorization: '***' },
        requestUrl: 'https://provider.example/routes?apiKey=***&mode=transit',
      },
      providerError: 'https://provider.example/error?token=***',
    });
  });

  it('does not forward bearer credentials in error traces', () => {
    const logger = new SafeLogger();
    const errorSpy = jest.spyOn(ConsoleLogger.prototype, 'error').mockImplementation(() => undefined);

    logger.error('provider failed', 'Authorization: Bearer refresh-secret');

    expect(errorSpy.mock.calls[0]?.[1]).toBe('Authorization: Bearer ***');
  });
});
