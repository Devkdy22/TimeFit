export type TimefitNotificationChannel = {
  id: 'timefit' | 'timefit-silent';
  name: string;
  importance: 'high' | 'default';
  vibrationPattern: number[];
  sound: 'default' | null;
};

export const TIMEFIT_NOTIFICATION_CHANNELS: TimefitNotificationChannel[] = [
  {
    id: 'timefit',
    name: 'TimeFit 알림',
    importance: 'high',
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
  },
  {
    id: 'timefit-silent',
    name: 'TimeFit 무음 알림',
    importance: 'default',
    vibrationPattern: [],
    sound: null,
  },
];
