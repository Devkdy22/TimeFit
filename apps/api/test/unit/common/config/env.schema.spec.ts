import { validateEnv } from '../../../../src/common/config/env.schema';

function requiredEnv(overrides: Record<string, unknown> = {}) {
  return {
    DATABASE_URL: 'postgresql://localhost/timefit',
    JWT_ACCESS_SECRET: 'a'.repeat(40),
    JWT_REFRESH_SECRET: 'b'.repeat(40),
    KAKAO_API_KEY: 'kakao',
    WEATHER_API_KEY: 'weather',
    SEOUL_OPEN_API_KEY: 'seoul-open',
    SEOUL_SUBWAY_API_KEY: 'subway',
    FCM_SERVER_KEY: 'fcm',
    SEOUL_BUS_API_URL: 'https://bus.example',
    SEOUL_BUS_KEY: 'bus',
    GYEONGGI_BUS_API_URL: 'https://gyeonggi.example',
    GYEONGGI_BUS_KEY: 'gyeonggi',
    INCHEON_BUS_API_URL: 'https://incheon.example',
    INCHEON_BUS_KEY: 'incheon',
    SEOUL_SUBWAY_API_URL: 'https://subway.example',
    ...overrides,
  };
}

describe('validateEnv', () => {
  it('provides the production-safe timezone and Expo push defaults', () => {
    const parsed = validateEnv(requiredEnv());

    expect(parsed.TIMEFIT_TIMEZONE).toBe('Asia/Seoul');
    expect(parsed.EXPO_PUSH_API_URL).toBe('https://exp.host/--/api/v2/push/send');
  });

  it('preserves explicit deployment overrides', () => {
    const parsed = validateEnv(requiredEnv({
      TIMEFIT_TIMEZONE: 'UTC',
      EXPO_PUSH_API_URL: 'https://push.example/send',
    }));

    expect(parsed.TIMEFIT_TIMEZONE).toBe('UTC');
    expect(parsed.EXPO_PUSH_API_URL).toBe('https://push.example/send');
  });

  it('rejects an invalid timezone before the routine worker starts', () => {
    expect(() => validateEnv(requiredEnv({ TIMEFIT_TIMEZONE: 'Not/A-Timezone' }))).toThrow('TIMEFIT_TIMEZONE');
  });

  it('rejects QA configuration that points at the production API', () => {
    expect(() => validateEnv(requiredEnv({
      NODE_ENV: 'production',
      TIMEFIT_ENVIRONMENT: 'qa',
      TIMEFIT_DATABASE_TARGET: 'qa',
      DATABASE_URL: 'postgresql://qa-user:qa-password@qa-db.example.test/timefit_qa',
      PUBLIC_API_BASE_URL: 'https://timefit-api.onrender.com',
    }))).toThrow('production API URL');
  });

  it('requires an isolated database for temporary E2E configuration', () => {
    expect(() => validateEnv(requiredEnv({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://localhost/timefit',
    }))).toThrow('isolated test database URL');
  });

  it('accepts explicit QA environment markers with a non-production API URL', () => {
    const parsed = validateEnv(requiredEnv({
      NODE_ENV: 'production',
      TIMEFIT_ENVIRONMENT: 'qa',
      TIMEFIT_DATABASE_TARGET: 'qa',
      DATABASE_URL: 'postgresql://qa-user:qa-password@qa-db.example.test/timefit_qa',
      PUBLIC_API_BASE_URL: 'https://timefit-qa.example.test',
    }));

    expect(parsed.TIMEFIT_ENVIRONMENT).toBe('qa');
    expect(parsed.TIMEFIT_DATABASE_TARGET).toBe('qa');
  });

  it('rejects QA when the database name is not QA-scoped', () => {
    expect(() => validateEnv(requiredEnv({
      NODE_ENV: 'production',
      TIMEFIT_ENVIRONMENT: 'qa',
      TIMEFIT_DATABASE_TARGET: 'qa',
      DATABASE_URL: 'postgresql://qa-user:qa-password@qa-db.example.test/timefit',
      PUBLIC_API_BASE_URL: 'https://timefit-qa.example.test',
    }))).toThrow('QA environment requires a QA database URL');
  });

  it('rejects QA when the public API URL is omitted or not HTTPS', () => {
    expect(() => validateEnv(requiredEnv({
      NODE_ENV: 'production',
      TIMEFIT_ENVIRONMENT: 'qa',
      TIMEFIT_DATABASE_TARGET: 'qa',
      DATABASE_URL: 'postgresql://qa-user:qa-password@qa-db.example.test/timefit_qa',
    }))).toThrow('explicit HTTPS PUBLIC_API_BASE_URL');
  });
});
