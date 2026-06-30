# Sprint 1.5 Migration Checklist

Scope: `202606150001_auth_sessions_routines`

## Preconditions

- Run only against the intended PostgreSQL database.
- Confirm a recent backup exists before applying to any non-empty environment.
- Confirm `DATABASE_URL` points to the target environment.
- Run `prisma migrate status` before `prisma migrate deploy`.

## Auth Tables

- `AuthIdentity` is additive and references `User(id)` with cascade delete.
- `AuthSession` is additive and references `User(id)` with cascade delete.
- Refresh and access tokens are stored only as SHA-256 hashes.
- Unique indexes on `accessTokenHash` and `refreshTokenHash` prevent duplicate token rows.
- `refreshExpiresAt` is indexed for future cleanup jobs.

## Routine Table

- Legacy columns dropped:
  - `originPlaceId`
  - `destinationPlaceId`
  - `arrivalRule`
  - `isActive`
- New required columns are added with temporary defaults, then defaults are removed:
  - `originName`
  - `originLat`
  - `originLng`
  - `destinationName`
  - `destinationLat`
  - `destinationLng`
  - `weekdays`
  - `arrivalTime`
- Existing routine rows with valid `originPlaceId` and `destinationPlaceId` are backfilled from `Place`.
- Existing `arrivalRule` values matching `HH:mm` are copied to `arrivalTime`.
- Operational risk: legacy schema has no weekday data, so pre-existing routine rows can retain `weekdays = ARRAY[]::INTEGER[]`.
- Sprint 2 launch policy: legacy rows with `weekdays = ARRAY[]::INTEGER[]` are automatically set to `active = false` by migration `202606160001_saved_places_fk_idempotency`.
- Users must select weekdays and save the routine again before those legacy routines can be active.
- Any pre-existing routine rows with default `''`, `0`, `[]`, or `09:00` values must be reviewed before launch.

## Validation Commands

- `pnpm --filter @timefit/api exec prisma validate --schema prisma/schema.prisma`
- `DATABASE_URL=<test-db> pnpm --filter @timefit/api exec prisma migrate deploy --schema prisma/schema.prisma`
- `TIMEFIT_E2E_DATABASE_URL=<test-db> pnpm --filter @timefit/api exec jest --config jest.e2e.config.ts --runInBand test/e2e/auth-routines-postgres.e2e-spec.ts`

## Rollback Notes

- Auth tables can be dropped if no production sessions need preservation.
- Routine rollback is not lossless because legacy routine columns are dropped.
- Before rollback, export `Routine` rows or restore from database backup.
- Prefer forward-fix migration over rollback once production users have created routines.

## Launch Gate

- Migration deploy succeeds against a clean test database.
- Migration deploy succeeds against a snapshot containing representative legacy `Routine` rows.
- Post-migration query finds no launch-blocking default backfill rows:
  - `originName = ''`
  - `destinationName = ''`
  - `originLat = 0 AND originLng = 0`
  - `destinationLat = 0 AND destinationLng = 0`
  - `weekdays = ARRAY[]::INTEGER[] AND active = true`

## Sprint 2 Launch Gate Queries

```sql
SELECT count(*) AS active_empty_weekday_routines
FROM "Routine"
WHERE "weekdays" = ARRAY[]::INTEGER[]
  AND "active" = true;
```

Expected: `0`.

```sql
SELECT count(*) AS routine_default_backfill_rows
FROM "Routine"
WHERE "originName" = ''
   OR "destinationName" = ''
   OR ("originLat" = 0 AND "originLng" = 0)
   OR ("destinationLat" = 0 AND "destinationLng" = 0)
   OR "arrivalTime" = '09:00';
```

Expected: manual review required for any non-zero result.
