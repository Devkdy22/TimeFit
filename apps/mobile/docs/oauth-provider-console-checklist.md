# OAuth Provider Console Checklist

## Runtime Redirect Policy

- Provider OAuth callbacks use backend HTTPS URLs.
- Android/iOS Dev Build and Standalone receive only the final app return URL: `timefit://auth?ticket=...`.
- `timefit://auth` is not registered in provider consoles.
- Android package name: `com.devkdy.timefitmobile`
- iOS bundle id: `com.devkdy.timefitmobile`

## Google

- Android OAuth Client ID exists.
- Android package name is `com.devkdy.timefitmobile`.
- Android SHA-1 matches the installed Dev Build signing key.
- iOS OAuth Client ID exists.
- iOS bundle id is `com.devkdy.timefitmobile`.
- Backend uses the Web Application OAuth client for code exchange.
- Authorized redirect URI includes `https://YOUR_PUBLIC_API_BASE_URL/auth/google/callback`.
- Mobile does not need Google OAuth client IDs for this flow.

## Kakao

- REST API Key exists and matches `EXPO_PUBLIC_KAKAO_REST_API_KEY`.
- Android package name is `com.devkdy.timefitmobile`.
- Android key hash matches the installed Dev Build signing key.
- iOS bundle id is `com.devkdy.timefitmobile`.
- Redirect URI includes `https://YOUR_PUBLIC_API_BASE_URL/auth/kakao/callback`.
- Do not register `timefit://auth`; Kakao console requires HTTPS redirect URIs.

## Naver

- Client ID exists and matches backend `NAVER_CLIENT_ID`.
- Client Secret exists on the backend only.
- Android package name is `com.devkdy.timefitmobile`.
- iOS bundle id is `com.devkdy.timefitmobile`.
- Callback URL includes `https://YOUR_PUBLIC_API_BASE_URL/auth/naver/callback`.

## Local Env Gate

- `apps/mobile/.env` must include:
  - `EXPO_PUBLIC_API_URL`
- `apps/api/.env` must include:
  - `PUBLIC_API_BASE_URL`
  - `OAUTH_RETURN_TO_ALLOWLIST=timefit://auth`
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `KAKAO_REST_API_KEY`
  - `KAKAO_CLIENT_SECRET`
  - `NAVER_CLIENT_ID`
  - `NAVER_CLIENT_SECRET`
