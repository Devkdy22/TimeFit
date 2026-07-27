# Push Validation

## Configuration and credential separation

The API uses `FCM_SERVER_KEY`, `EXPO_PUSH_API_URL`, and `EXPO_PUSH_TIMEOUT_MS`. The mobile app uses the Expo project configuration in `app.json` and obtains an Expo Push token at runtime. The configured Android notification channel IDs are `timefit` and `timefit-silent`.

If native Firebase configuration is required for a QA build, the expected file is `apps/mobile/android/app/google-services.json`; that file is not present in the current repository and must not be created or populated during this task. Expo/EAS Android push credentials must be managed in the QA EAS project or secret store separately from production.

## Runtime validation sequence

With QA credentials and a real Android device only:

1. Install the QA development build and grant notification permission.
2. Confirm token registration through `POST /notifications/push-token` without logging the token value.
3. Send a disposable QA notification and verify foreground, background, and tap navigation.
4. Query receipts and verify `DeviceNotRegistered` removes the invalid token.
5. Verify 429/5xx retry, permanent 4xx no-retry, malformed receipt handling, and same-routine deduplication.
6. Remove QA test tokens, notifications, routines, and test accounts after validation.

Verify the QA service before sending any Push request:

```bash
curl -fsS https://<qa-api-host>/health
curl -fsS https://<qa-api-host>/ready
```

## Current status

No Firebase, Expo Push, or QA API credential was used or output. Real Push send/receive and receipt validation are Blocked. Existing API and mobile unit tests are the available internal evidence only.

On 2026-07-22, the Push-focused API tests passed: 2 suites and 23 tests. This covers worker, receipt, retry, malformed response, token cleanup, and deduplication logic; it is not evidence of delivery to a real device.
