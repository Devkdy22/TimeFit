import { TIMEFIT_NOTIFICATION_CHANNELS } from './notificationChannels';

test('keeps Android notification channel ids aligned with server push payloads', () => {
  expect(TIMEFIT_NOTIFICATION_CHANNELS.map((channel) => channel.id)).toEqual([
    'timefit',
    'timefit-silent',
  ]);
  expect(TIMEFIT_NOTIFICATION_CHANNELS[0]).toEqual(expect.objectContaining({ importance: 'high', sound: 'default' }));
  expect(TIMEFIT_NOTIFICATION_CHANNELS[1]).toEqual(expect.objectContaining({ importance: 'default', sound: null }));
});
