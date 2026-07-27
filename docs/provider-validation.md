# External Provider Validation

## Provider configuration

The API reads provider configuration from environment variables. The relevant names are `ODSAY_API_KEY`, `ODSAY_API_URL`, `KAKAO_REST_API_KEY`, `KAKAO_API_KEY`, `SEOUL_API_KEY`, `SEOUL_OPEN_API_KEY`, `SEOUL_BUS_API_URL`, `SEOUL_BUS_KEY`, `SEOUL_SUBWAY_API_URL`, and `SEOUL_SUBWAY_API_KEY`. Mobile must not contain server-side provider credentials.

QA and production must use separately managed values. Store them in the respective secret store; do not place credential values in `.env.example`, APKs, logs, or this document.

## Validation sequence

1. Confirm the QA API URL and `NODE_ENV`.
2. Confirm `TIMEFIT_ENVIRONMENT=qa`, `TIMEFIT_DATABASE_TARGET=qa`, and `GET /ready` before provider calls.
3. Confirm provider key presence without printing the value.
4. Execute one known-good route request and record only status, source, candidate count, and response contract.
5. Exercise provider timeout, 4xx, 5xx, malformed response, empty result, and missing-key cases with a stub or controlled QA provider; do not induce failures against production.
6. Verify `ROUTE_PROVIDER_DOWN`, `PROVIDER_UNAVAILABLE`, `ROUTE_NOT_FOUND`, and `APPLICATION_ERROR` remain distinct in API and mobile.
7. Verify walking geometry at `GET /kakao-local/directions/walk` and compare the deployed response to the repository controller contract.
8. Confirm the deployed service commit matches the reviewed repository commit before treating runtime parity as Pass.

## Current status

No ODSay, Kakao, Seoul provider credential, QA API, Render permission, or authorized production runtime check was available in this execution. External provider calls and deployed endpoint checks were not performed. Repository unit/contract tests remain the only provider evidence.

On 2026-07-22, the provider-focused API tests passed: 12 suites and 46 tests. This is mock/fixture evidence only and does not promote real provider validation to Pass.
