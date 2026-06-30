# OAuth and Deep Link Runbook

## Launch Policy

- Provider authorization starts at the backend: `/auth/:provider/start?returnTo=timefit://auth`.
- Provider callback values are backend HTTPS URLs: `/auth/:provider/callback`.
- Dev Build and Standalone receive only the final app return URL: `timefit://auth?ticket=...`.
- The app redeems that one-time ticket with `/auth/session/redeem`.

## Required Mobile Env

- `EXPO_PUBLIC_API_URL`

## Required API Env

- `PUBLIC_API_BASE_URL`
- `OAUTH_RETURN_TO_ALLOWLIST=timefit://auth`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `KAKAO_REST_API_KEY`
- `KAKAO_CLIENT_SECRET`
- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`

## Direct Deep Link Tests

iOS simulator:

```sh
xcrun simctl openurl booted 'timefit://auth?provider=google&ticket=test'
xcrun simctl openurl booted 'timefit://auth?provider=kakao&ticket=test'
xcrun simctl openurl booted 'timefit://auth?provider=naver&ticket=test'
```

Android emulator:

```sh
adb shell "am start -a android.intent.action.VIEW -d 'timefit://auth?provider=google&ticket=test' -p com.devkdy.timefitmobile"
adb shell "am start -a android.intent.action.VIEW -d 'timefit://auth?provider=kakao&ticket=test' -p com.devkdy.timefitmobile"
adb shell "am start -a android.intent.action.VIEW -d 'timefit://auth?provider=naver&ticket=test' -p com.devkdy.timefitmobile"
```

Expected logs:

- `[DeepLink][Runtime]` with `received: true`
- `[Auth][OAuth]` with `event: oauth_deep_link_url_event` or `oauth_deep_link_initial_url`
- `hasTicket: true`

## Provider Notes

- Google redirect URI must be `https://YOUR_PUBLIC_API_BASE_URL/auth/google/callback`.
- Kakao redirect URI must be `https://YOUR_PUBLIC_API_BASE_URL/auth/kakao/callback`.
- Naver callback URL must be `https://YOUR_PUBLIC_API_BASE_URL/auth/naver/callback`.
