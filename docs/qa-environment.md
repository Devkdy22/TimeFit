# TimeFit QA Environment

## Environment separation

| Environment | API | Database | Current repository evidence |
| --- | --- | --- | --- |
| Local | `http://localhost:3000` (explicit in local API config) | `DATABASE_URL` for local `timefit` DB | Configured locally; not a QA database |
| Test | Explicit `TIMEFIT_E2E_DATABASE_URL` | Separate database whose name includes `timefit` and `test` or `e2e` | Disposable local test DB passed on 2026-07-22; no persistent QA DB |
| QA | Must be provisioned separately | Must be provisioned separately | `render.qa.yaml` draft exists; no actual service or DB is provisioned |
| Production | `https://timefit-api.onrender.com` | Render `DATABASE_URL` | Render service is production and `autoDeploy: false` |

Never use the local `DATABASE_URL`, a Render production URL, or an unidentified managed database for PostgreSQL E2E. The E2E script drops and recreates the `public` schema.

## Required variable names

API variables include `NODE_ENV`, `TIMEFIT_ENVIRONMENT`, `TIMEFIT_DATABASE_TARGET`, `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, provider URL/key variables, `CORS_ORIGINS`, `PUBLIC_API_BASE_URL`, `OAUTH_RETURN_TO_ALLOWLIST`, and notification variables such as `FCM_SERVER_KEY` and `EXPO_PUSH_API_URL`.

Mobile variables include `EXPO_PUBLIC_API_URL`, optional `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_KAKAO_WEBVIEW_BASE_URL`, OAuth public identifiers, and feature flags.

`.env.example` files contain variable names and placeholders only. Secret values must be supplied through local ignored files or CI/QA secret storage and must not be printed.

## Mobile endpoint safety

Non-production mobile builds now require an explicit `EXPO_PUBLIC_API_URL` or `EXPO_PUBLIC_API_BASE_URL`; they cannot silently fall back to the production Render URL. Production fallback remains available only for an explicitly production environment. QA builds should always set `EXPO_PUBLIC_API_ENV=qa` and an explicit QA API URL.

## QA setup gate

Before using a QA database or API, record the host, port, database name, owner, environment purpose, and credential storage location without recording credentials. Confirm that the host and database are not production resources. QA OAuth redirect URIs, CORS origins, provider keys, Firebase/Expo settings, JWT secrets, and mobile API URL must be separate from production.

## Persistent QA API feasibility

The repository contains one production Render web service, `timefit-api`, with `NODE_ENV=production`, the production database variable, and `https://timefit-api.onrender.com` as its public base URL. `render.qa.yaml` is only a draft; there is no provisioned QA service, QA database binding, or persistent QA hostname. Do not repurpose the production service for QA.

To provision persistent QA outside this task, the owner must create:

- a separate web service or approved QA deployment target;
- a separate PostgreSQL database and database user;
- an HTTPS QA API endpoint, for example an owner-approved QA hostname;
- QA values for `DATABASE_URL`, `NODE_ENV`, `PUBLIC_API_BASE_URL`, `CORS_ORIGINS`, `OAUTH_RETURN_TO_ALLOWLIST`, provider URLs/keys, and Push settings;
- a mobile build with `EXPO_PUBLIC_API_URL` set explicitly to the QA HTTPS endpoint;
- QA OAuth redirect registrations and disposable test accounts.

The current endpoints are `GET /health` for process health and `GET /ready` for PostgreSQL readiness. `/ready` returns 200 only after `SELECT 1` succeeds and returns 503 with `DATABASE_UNAVAILABLE` without exposing connection details. Render should use `/health` for process health and QA operators should check `/ready` before mobile validation.

The API fail-fast requires `TIMEFIT_DATABASE_TARGET=qa`, an explicit HTTPS `PUBLIC_API_BASE_URL`, and a QA `DATABASE_URL` whose database name contains a QA scope such as `timefit_qa`; a local or production-scoped database name is rejected. This is a naming guard, not proof of ownership, so the Render operator must still confirm that the hostname, database, user, and secret namespace are separate from production.

## E2E handoff

After an isolated database is confirmed:

```bash
TIMEFIT_E2E_DATABASE_URL=postgresql://<user>:<password>@<qa-host>:<port>/timefit_e2e_test \
  pnpm --filter @timefit/api test:e2e:postgres
```

The command performs schema cleanup, Prisma migration deployment, and the PostgreSQL E2E suites. Test accounts and data must be disposable and cleaned up with the QA database after validation.

For a persistent QA database, migration deployment uses the repository's actual command from the API directory:

```bash
cd /Users/kimdoyeon/Dev/TimeFit/apps/api
pnpm exec prisma migrate deploy --schema prisma/schema.prisma
```

There is no QA seed script in the repository. Do not run `prisma migrate dev` against QA or production; production migration is outside this task.

## Latest isolated E2E execution — 2026-07-22

Docker and Docker Compose are not installed in the current environment. Homebrew PostgreSQL tools were available, so a temporary cluster was created under `/private/tmp` with a disposable database named `timefit_e2e_test` and a loopback port. The command used was:

```bash
TIMEFIT_E2E_DATABASE_URL=postgresql://<qa-user>@127.0.0.1:55432/timefit_e2e_test \
  pnpm --filter @timefit/api test:e2e:postgres
```

Prisma migration deployment succeeded and both E2E suites passed: 25 tests total. The cluster was stopped and its temporary directory removed after the run. This validates the repository's isolated E2E path; it does not create a persistent QA API or QA environment.

## Readiness and mobile regression evidence — 2026-07-22

- API build, lint, and unit tests passed; the full API unit baseline after the final QA fail-fast checks is 42 suites / 175 tests.
- `GET /health` remains a process-health response and does not require a database probe.
- `GET /ready` returned the successful contract in the controller test and returned HTTP 503 with `DATABASE_UNAVAILABLE` when the database probe failed. No connection string or provider error body is returned.
- Mobile TypeScript passed. Jest execution passed 24 suites / 87 tests. A package invocation with an additional `--` produced a Jest pattern error because the package script already contains `--runInBand`; it did not indicate a source-test failure.
- No persistent QA API or QA DB was created, and no production API or DB was contacted.

Android `debug` is a Metro-dependent variant in the current Gradle configuration. `EXPO_PUBLIC_API_ENV=qa` and `EXPO_PUBLIC_API_URL=https://<qa-api-host>` must therefore be present when Metro is started for the QA session; running Gradle alone does not prove that a QA URL was embedded in the debug APK. A standalone embedded bundle requires a non-debug/bundled variant and was not created in this step.
