# Dev Build Deep Link / OAuth Redirect Validation

## Scope

- 목적: Dev Build / Standalone 환경에서 `timefit://auth` Deep Link와 OAuth redirect 수신 여부를 검증한다.
- 금지: OAuth Provider 설정 변경, Backend 변경, Auth token/JWT/refresh 로직 변경.
- 이번 검증은 OAuth 성공 여부가 아니라 앱이 redirect URL을 실제로 수신하는지 분리 확인하는 단계다.

## Current Configuration

| 항목 | 현재 값 | 판정 | 근거 |
| --- | --- | --- | --- |
| Expo slug | `timefit-mobile` | PASS | `apps/mobile/app.json` |
| Expo scheme | `timefit` | PASS | `apps/mobile/app.json` |
| Expo Router entry | `./node_modules/expo-router/entry` | PASS | `apps/mobile/app.json` |
| iOS bundle id | `com.devkdy.timefitmobile` | PASS | `apps/mobile/app.json` |
| Android package | `com.devkdy.timefitmobile` | PASS | `apps/mobile/app.json` |
| EAS development client | `true` | PASS | `apps/mobile/eas.json` |
| iOS URL scheme | `timefit`, `com.devkdy.timefitmobile` | PASS | `apps/mobile/ios/TimeFit/Info.plist` |
| Android VIEW intent scheme | `timefit` | PASS | `apps/mobile/android/app/src/main/AndroidManifest.xml` |
| `app.config.ts` | 없음 | UNKNOWN | 현재 정적 `app.json` 사용 |

## Runtime Redirect Strategy To Verify

| Runtime | Expected redirectRuntime | Expected redirectUri |
| --- | --- | --- |
| Expo Go | `expo-go` | `https://auth.expo.io/@devkdy/timefit-mobile` |
| Development Build | `dev-build-or-standalone` | `timefit://auth` |
| Standalone | `dev-build-or-standalone` | `timefit://auth` |
| Web | `web` | 이번 검증 범위 밖 |

## Required Logs

앱 시작 및 URL 이벤트 수신 시 다음 prefix를 확인한다.

```text
[DeepLink][Runtime]
```

필수 필드:

| 필드 | 의미 |
| --- | --- |
| `event` | `initial_url`, `initial_url_error`, `url_event` |
| `received` | URL 수신 여부 |
| `url` | 수신된 Deep Link URL |
| `appOwnership` | Expo runtime ownership |
| `executionEnvironment` | Expo execution environment |
| `redirectRuntime` | `expo-go`, `dev-build-or-standalone`, `web` |
| `redirectUri` | 현재 runtime 기준 OAuth redirect URI |

OAuth 버튼 실행 시 기존 Auth 로그도 함께 확인한다.

```text
[Auth][OAuth]
```

확인 필드:

- `provider`
- `redirectUri`
- `result.type`
- `result.url`
- `hasCode`
- `hasState`

## Dev Build Validation Procedure

### 1. 실행 전 조건

- [ ] Dev Build 앱이 실제 기기 또는 시뮬레이터에 설치되어 있다.
- [ ] 설치된 앱의 scheme은 `timefit`이다.
- [ ] Metro 또는 dev server 연결 상태를 확인했다.
- [ ] OAuth Provider 콘솔 설정은 수정하지 않는다.
- [ ] Backend 설정은 수정하지 않는다.

### 2. 앱 시작 로그 확인

- [ ] Dev Build 앱을 cold start한다.
- [ ] 콘솔에서 `[DeepLink][Runtime]` 로그를 찾는다.
- [ ] `event`가 `initial_url`인지 확인한다.
- [ ] 일반 실행이면 `received: false`, `url: null`이 정상이다.
- [ ] `redirectRuntime: "dev-build-or-standalone"`인지 확인한다.
- [ ] `redirectUri: "timefit://auth"`인지 확인한다.

실패 기준:

- `redirectRuntime`이 `expo-go`로 표시된다.
- Dev Build에서 `redirectUri`가 `https://auth.expo.io/...`로 표시된다.
- 앱 시작 시 `[DeepLink][Runtime]` 로그가 전혀 없다.

### 3. iOS Deep Link 직접 수신 테스트

시뮬레이터:

```bash
xcrun simctl openurl booted 'timefit://auth?code=debug-code&state=debug-state'
```

실기기:

- Safari 주소창 또는 Notes 링크에서 `timefit://auth?code=debug-code&state=debug-state`를 연다.

체크리스트:

- [ ] 앱이 foreground로 열린다.
- [ ] `[DeepLink][Runtime]` 로그가 출력된다.
- [ ] `event: "url_event"`가 출력된다.
- [ ] `received: true`가 출력된다.
- [ ] `url`이 `timefit://auth?code=debug-code&state=debug-state`와 일치한다.
- [ ] `redirectUri`가 `timefit://auth`와 일치한다.

### 4. Android Deep Link 직접 수신 테스트

```bash
adb shell am start -W -a android.intent.action.VIEW -d 'timefit://auth?code=debug-code\&state=debug-state' com.devkdy.timefitmobile
```

체크리스트:

- [ ] 앱이 foreground로 열린다.
- [ ] `[DeepLink][Runtime]` 로그가 출력된다.
- [ ] `event: "url_event"`가 출력된다.
- [ ] `received: true`가 출력된다.
- [ ] `url`이 `timefit://auth?code=debug-code&state=debug-state`와 의미상 일치한다.
- [ ] `redirectUri`가 `timefit://auth`와 일치한다.

### 5. OAuth Redirect 연계 확인

Google/Kakao/Naver 각각 1회씩 Dev Build에서 실행한다.

- [ ] `[Auth][OAuth] oauth_login_start`의 `redirectUri`가 `timefit://auth`다.
- [ ] Provider 인증 후 앱이 foreground로 복귀한다.
- [ ] `[DeepLink][Runtime] url_event`가 출력된다.
- [ ] `[Auth][OAuth] oauth_auth_session_result`가 출력된다.
- [ ] `result.type`이 `success`다.
- [ ] `result.url`이 존재한다.
- [ ] `hasCode: true`다.
- [ ] `hasState: true`다.
- [ ] 이후 `/auth/social/login` 호출 도달 여부를 확인한다.

실패 기준:

- `result.type: "dismiss"` 또는 `cancel`이 반복된다.
- `[DeepLink][Runtime] url_event`가 출력되지 않는다.
- 수신 URL은 있지만 `code` 또는 `state`가 없다.
- Dev Build인데 `redirectUri`가 `https://auth.expo.io/...`다.

## Result Table

| 검증 항목 | PASS | FAIL | UNKNOWN | 기록 |
| --- | --- | --- | --- | --- |
| `app.json` scheme 등록 | PASS |  |  | `timefit` |
| iOS URL scheme 등록 | PASS |  |  | `timefit` |
| Android intent scheme 등록 | PASS |  |  | `timefit` |
| 앱 시작 `getInitialURL()` 로그 |  |  | UNKNOWN | Dev Build runtime 확인 필요 |
| `addEventListener('url')` 수신 로그 |  |  | UNKNOWN | 직접 Deep Link 테스트 필요 |
| Dev Build redirectUri |  |  | UNKNOWN | runtime 로그 확인 필요 |
| iOS `timefit://auth` 수신 |  |  | UNKNOWN | 실기기/시뮬레이터 테스트 필요 |
| Android `timefit://auth` 수신 |  |  | UNKNOWN | 실기기/에뮬레이터 테스트 필요 |
| Google OAuth callback |  |  | UNKNOWN | Provider 콘솔 등록값과 runtime 비교 필요 |
| Kakao OAuth callback |  |  | UNKNOWN | Provider 콘솔 등록값과 runtime 비교 필요 |
| Naver OAuth callback |  |  | UNKNOWN | Provider 콘솔 등록값과 runtime 비교 필요 |

## Launch Interpretation

- PASS: Dev Build에서 `timefit://auth`를 직접 수신하고, OAuth provider callback도 동일 URI로 앱에 복귀한다.
- FAIL: scheme 등록은 되어 있으나 앱이 URL 이벤트를 받지 못하거나, Dev Build에서 `auth.expo.io` redirect가 사용된다.
- UNKNOWN: 코드/설정상 판단은 가능하지만 실기기 로그가 아직 없는 항목이다.
