import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
    KAKAO_API_KEY: z.string().min(1),
    FCM_SERVER_KEY: z.string().min(1),
    CORS_ORIGINS: z.string().optional().default(''),
    RATE_LIMIT_TTL_MS: z.coerce.number().default(60000),
    RATE_LIMIT_MAX: z.coerce.number().default(60),
    REDIS_URL: z.string().optional(),
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

  return parsed.data;
}
