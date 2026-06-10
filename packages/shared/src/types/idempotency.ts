export const IDEMPOTENCY_HEADER = 'Idempotency-Key' as const;

export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export const IDEMPOTENCY_ERROR_CODE = {
  CONFLICT: 'IDEMPOTENCY_CONFLICT',
  PENDING: 'IDEMPOTENCY_PENDING',
  KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
} as const;

export type IdempotencyErrorCode =
  (typeof IDEMPOTENCY_ERROR_CODE)[keyof typeof IDEMPOTENCY_ERROR_CODE];
