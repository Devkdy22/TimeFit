#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${TIMEFIT_E2E_DATABASE_URL:-}" ]]; then
  echo "TIMEFIT_E2E_DATABASE_URL is required." >&2
  echo "Example: TIMEFIT_E2E_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/timefit_e2e_test pnpm --filter @timefit/api test:e2e:postgres" >&2
  exit 1
fi

if [[ ! "${TIMEFIT_E2E_DATABASE_URL}" =~ [Tt][Ii][Mm][Ee][Ff][Ii][Tt].*([Tt][Ee][Ss][Tt]|[Ee]2[Ee])|([Tt][Ee][Ss][Tt]|[Ee]2[Ee]).*[Tt][Ii][Mm][Ee][Ff][Ii][Tt] ]]; then
  echo "Refusing to run: TIMEFIT_E2E_DATABASE_URL must point to a test database." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${API_DIR}"

export DATABASE_URL="${TIMEFIT_E2E_DATABASE_URL}"
export CI="${CI:-true}"

PNPM_BIN="${PNPM_BIN:-corepack pnpm}"

PSQL_BIN="${PSQL_BIN:-psql}"
if ! command -v "${PSQL_BIN}" >/dev/null 2>&1; then
  if [[ -x "/opt/homebrew/opt/postgresql@16/bin/psql" ]]; then
    PSQL_BIN="/opt/homebrew/opt/postgresql@16/bin/psql"
  else
    echo "psql is required for schema cleanup. Install PostgreSQL or set PSQL_BIN." >&2
    exit 1
  fi
fi

${PNPM_BIN} exec prisma generate --schema prisma/schema.prisma
"${PSQL_BIN}" "${TIMEFIT_E2E_DATABASE_URL}" -v ON_ERROR_STOP=1 \
  -c 'DROP SCHEMA IF EXISTS public CASCADE' \
  -c 'CREATE SCHEMA public'
${PNPM_BIN} exec prisma migrate deploy --schema prisma/schema.prisma
${PNPM_BIN} exec jest --config jest.e2e.config.ts --runInBand test/e2e/auth-routines-postgres.e2e-spec.ts
