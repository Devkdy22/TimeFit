# PostgreSQL E2E Runbook

## Local PostgreSQL

Use any PostgreSQL 16-compatible database. This repository expects the test database URL in `TIMEFIT_E2E_DATABASE_URL`.

Example:

```bash
TIMEFIT_E2E_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/timefit_e2e_test \
  pnpm --filter @timefit/api test:e2e:postgres
```

The script refuses URLs that do not look like test databases. Database names should include both `timefit` and either `test` or `e2e`.

## Script Behavior

`pnpm --filter @timefit/api test:e2e:postgres` runs:

1. `TIMEFIT_E2E_DATABASE_URL` validation
2. `prisma generate`
3. `prisma migrate deploy`
4. `auth-routines-postgres.e2e-spec.ts`

The E2E spec resets the `public` schema and reapplies migrations before tests.

## Docker Option

When Docker is available:

```bash
docker run --rm --name timefit-e2e-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=timefit_e2e_test \
  -p 55432:5432 \
  postgres:16
```

Then run:

```bash
TIMEFIT_E2E_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/timefit_e2e_test \
  pnpm --filter @timefit/api test:e2e:postgres
```

## Managed PostgreSQL Option

For Neon, Supabase, Render, or another managed PostgreSQL provider:

1. Create a disposable database whose name includes `timefit` and either `test` or `e2e`.
2. Use a direct PostgreSQL connection string, not a production URL.
3. Export it as `TIMEFIT_E2E_DATABASE_URL`.
4. Run `pnpm --filter @timefit/api test:e2e:postgres`.

Do not use a pooled transaction URL for this test because migration and schema reset need a normal session.
