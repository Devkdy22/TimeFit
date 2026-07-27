import { ExpoNotificationClient } from '../../../../src/modules/notifications/integrations/expo-notification.client';

describe('ExpoNotificationClient', () => {
  const logger = { log: jest.fn(), warn: jest.fn() };
  const client = new ExpoNotificationClient({ expoPushApiUrl: 'https://exp.host/--/api/v2/push/send' } as never, logger as never);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('skips malformed tokens without making a network request', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    await expect(client.send({ to: 'invalid', title: 'title', body: 'body' })).resolves.toBe('skipped');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('classifies Expo DeviceNotRegistered receipts as invalid tokens', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }] }),
    } as Response);

    await expect(client.send({ to: 'ExponentPushToken[test]', title: 'title', body: 'body' })).resolves.toBe('invalid');
  });

  it('preserves the silent channel selected by notification preferences', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: 'ok' }] }),
    } as Response);

    await expect(client.send({
      to: 'ExponentPushToken[test]',
      title: 'title',
      body: 'body',
      sound: null,
      channelId: 'timefit-silent',
    })).resolves.toBe('sent');

    const request = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toMatchObject({ sound: null, channelId: 'timefit-silent' });
  });

  it('returns an Expo ticket id for later receipt verification', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: 'ok', id: 'ticket-1' }] }),
    } as Response);

    await expect(client.sendWithTicket({ to: 'ExponentPushToken[test]', title: 'title', body: 'body' })).resolves.toEqual({
      result: 'sent',
      ticketId: 'ticket-1',
    });
  });

  it('does not mark an empty provider response as delivered', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);

    await expect(client.send({ to: 'ExponentPushToken[test]', title: 'title', body: 'body' })).resolves.toBe('failed');
  });

  it('does not mark a ticket without a recognized status as delivered', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'ticket-unknown' }] }),
    } as Response);

    await expect(client.send({ to: 'ExponentPushToken[test]', title: 'title', body: 'body' })).resolves.toBe('failed');
  });

  it('fetches receipts from the matching Expo endpoint', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { 'ticket-1': { status: 'error', details: { error: 'DeviceNotRegistered' } } } }),
    } as Response);

    await expect(client.getReceipts(['ticket-1'])).resolves.toEqual({
      'ticket-1': { status: 'error', details: { error: 'DeviceNotRegistered' } },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/getReceipts',
      expect.objectContaining({ body: JSON.stringify({ ids: ['ticket-1'] }) }),
    );
  });

  it('retries a transient Expo response once and succeeds', async () => {
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers({ 'retry-after': '0' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ status: 'ok' }] }),
      } as Response);

    await expect(client.send({ to: 'ExponentPushToken[test]', title: 'title', body: 'body' })).resolves.toBe('sent');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry permanent Expo HTTP failures', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
    } as Response);

    await expect(client.send({ to: 'ExponentPushToken[test]', title: 'title', body: 'body' })).resolves.toBe('failed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('classifies an Expo request timeout as a failed delivery', async () => {
    jest.useFakeTimers();
    try {
      jest.spyOn(global, 'fetch').mockImplementation((_input, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      }));

      const pending = client.send({ to: 'ExponentPushToken[test]', title: 'title', body: 'body' });
      await jest.advanceTimersByTimeAsync(8000);

      await expect(pending).resolves.toBe('failed');
    } finally {
      jest.useRealTimers();
    }
  });
});
