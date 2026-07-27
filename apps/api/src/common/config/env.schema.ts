import { z } from 'zod';

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    TIMEFIT_ENVIRONMENT: z.enum(['local', 'temporary-e2e', 'qa', 'production']).optional(),
    TIMEFIT_DATABASE_TARGET: z.enum(['local', 'temporary-e2e', 'qa', 'production']).optional(),
    TIMEFIT_TIMEZONE: z.string().refine(isValidTimeZone, 'TIMEFIT_TIMEZONE must be a valid IANA timezone').default('Asia/Seoul'),
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
    KAKAO_API_KEY: z.string().min(1),
    KAKAO_REST_API_KEY: z.string().optional().default(''),
    WEATHER_API_KEY: z.string().min(1),
    SEOUL_API_KEY: z.string().optional().default(''),
    SEOUL_OPEN_API_KEY: z.string().min(1),
    SEOUL_SUBWAY_API_KEY: z.string().min(1),
    FCM_SERVER_KEY: z.string().min(1),
    EXPO_PUSH_API_URL: z.string().optional().default('https://exp.host/--/api/v2/push/send'),
    EXPO_PUSH_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).optional().default(8000),
    TRAFFIC_API_URL: z.string().optional().default(''),
    WEATHER_API_URL: z.string().optional().default(''),
    SEOUL_BUS_API_URL: z.string().min(1),
    SEOUL_BUS_KEY: z.string().min(1),
    GYEONGGI_BUS_API_URL: z.string().min(1),
    GYEONGGI_BUS_KEY: z.string().min(1),
    INCHEON_BUS_API_URL: z.string().min(1),
    INCHEON_BUS_KEY: z.string().min(1),
    SEOUL_SUBWAY_API_URL: z.string().min(1),
    ODSAY_API_KEY: z.string().optional().default(''),
    ODSAY_API_URL: z.string().optional().default('https://api.odsay.com/v1/api'),
    RECOMMENDATION_TRANSFER_BUFFER_MINUTES: z.coerce.number().optional().default(4),
    CORS_ORIGINS: z.string().optional().default(''),
    RATE_LIMIT_TTL_MS: z.coerce.number().default(60000),
    RATE_LIMIT_MAX: z.coerce.number().default(60),
    REDIS_URL: z.string().optional(),
    PUBLIC_API_BASE_URL: z.string().url().optional().default('http://localhost:3000'),
    OAUTH_RETURN_TO_ALLOWLIST: z.string().optional().default('timefit://auth'),
    GOOGLE_CLIENT_ID: z.string().optional().default(''),
    GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
    KAKAO_CLIENT_SECRET: z.string().optional().default(''),
    NAVER_CLIENT_ID: z.string().optional().default(''),
    NAVER_CLIENT_SECRET: z.string().optional().default(''),
  })
  .passthrough();

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>) {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const details = parsed.error.errors
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');

    throw new Error(`Environment validation failed - ${details}`);
  }

  const environment = parsed.data.TIMEFIT_ENVIRONMENT ?? inferEnvironment(parsed.data.NODE_ENV);
  const databaseTarget = parsed.data.TIMEFIT_DATABASE_TARGET ?? inferDatabaseTarget(environment);

  if (environment === 'qa' && databaseTarget !== 'qa') {
    throw new Error('TIMEFIT_ENVIRONMENT=qa requires TIMEFIT_DATABASE_TARGET=qa');
  }
  if (environment === 'qa' && !isQaDatabaseUrl(parsed.data.DATABASE_URL)) {
    throw new Error('QA environment requires a QA database URL whose database name contains qa');
  }
  if (environment === 'qa' && !isQaPublicApiUrl(config.PUBLIC_API_BASE_URL)) {
    throw new Error('QA environment requires an explicit HTTPS PUBLIC_API_BASE_URL');
  }
  if (environment === 'qa' && isProductionApiUrl(parsed.data.PUBLIC_API_BASE_URL)) {
    throw new Error('QA environment cannot use the production API URL');
  }
  if (environment === 'temporary-e2e' && !isIsolatedTestDatabase(parsed.data.DATABASE_URL)) {
    throw new Error('Temporary E2E environment requires an isolated test database URL');
  }
  if (environment === 'production' && databaseTarget !== 'production') {
    throw new Error('Production environment requires TIMEFIT_DATABASE_TARGET=production');
  }

  return { ...parsed.data, TIMEFIT_ENVIRONMENT: environment, TIMEFIT_DATABASE_TARGET: databaseTarget };
}

function inferEnvironment(nodeEnv: string): 'local' | 'temporary-e2e' | 'production' {
  if (nodeEnv === 'test') return 'temporary-e2e';
  if (nodeEnv === 'production') return 'production';
  return 'local';
}

function inferDatabaseTarget(environment: string): 'local' | 'temporary-e2e' | 'qa' | 'production' {
  if (environment === 'temporary-e2e') return 'temporary-e2e';
  if (environment === 'production') return 'production';
  if (environment === 'qa') return 'qa';
  return 'local';
}

function isProductionApiUrl(value: string | undefined): boolean {
  try {
    return new URL(value ?? '').hostname === 'timefit-api.onrender.com';
  } catch {
    return false;
  }
}

function isQaDatabaseUrl(value: string): boolean {
  try {
    const databaseName = decodeURIComponent(new URL(value).pathname.replace(/^\//, ''));
    return /(^|[-_])qa($|[-_])/i.test(databaseName);
  } catch {
    return false;
  }
}

function isQaPublicApiUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname);
  } catch {
    return false;
  }
}

function isIsolatedTestDatabase(value: string): boolean {
  return /timefit.*(test|e2e)|(test|e2e).*timefit/i.test(value);
}
