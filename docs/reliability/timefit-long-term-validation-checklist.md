# TimeFit 장기 개발 검증 체크리스트

## 자동 검증

- API `pnpm --filter @timefit/api build`
- API `pnpm --filter @timefit/api lint`
- API `pnpm --filter @timefit/api exec jest --config jest.config.ts --runInBand`
- API `TIMEFIT_E2E_DATABASE_URL=postgresql://<user>@127.0.0.1:5432/timefit_e2e_test pnpm --filter @timefit/api exec jest --config jest.e2e.config.ts --runInBand` (trip E2E는 격리된 test/e2e DB가 없으면 fail-fast; 기본 개발 DB로 fallback하지 않음. E2E bootstrap은 `127.0.0.1` loopback으로 명시)
- PostgreSQL 통합 E2E `TIMEFIT_E2E_DATABASE_URL=<test-db> pnpm --filter @timefit/api test:e2e:postgres`
  (로컬 PostgreSQL `timefit_e2e_test`에 migration 9개 적용 후 2 suites / 25 tests passed; Trip SSE·위치 매칭·경로 이탈 재탐색, 상세 루틴 필드·알림 설정·Push token 동기화·Saved Places ownership/idempotency·계정 삭제 cascade 포함)
- 최신 격리 PostgreSQL 검증에서도 `test:e2e:postgres` 단일 명령으로 인증·루틴 E2E 11 tests와 Trip tracking E2E 14 tests가 함께 통과했다. sandbox 기본 실행의 `Operation not permitted`는 로컬 PostgreSQL 접근 제한이며, 권한 상승 실행으로 재검증했다.
- 2026-07-22 재실행은 지정한 격리 DB `127.0.0.1:55432/timefit_e2e_test`가 실행 중이지 않아 `Connection refused`로 migration 전에 중단됐다. sandbox의 `Operation not permitted`와 구분되는 로컬 DB 프로세스 미실행 환경 blocker이며, E2E 코드 실패로 집계하지 않는다.
- 2026-07-22 `/private/tmp/timefit-e2e-postgres`에 만든 임시 PostgreSQL 클러스터를 55432 포트로 기동한 뒤 동일 명령을 재실행해 migration 9개 적용, 2 suites / 25 tests 통과를 확인했다.
- 2026-07-22 `/private/tmp/timefit-e2e.DqnzRd` 임시 클러스터를 55434 포트로 기동하고 `timefit_e2e_test`를 생성한 뒤 동일 명령을 재실행해 migration 9개 적용, 2 suites / 25 tests 통과를 재확인했다. 검증 후 서버와 임시 디렉터리는 정리했다.
- 2026-07-22 `/private/tmp/timefit-e2e-final.LGEpUg` 임시 클러스터를 55435 포트로 기동해 동일 명령을 재실행하고 migration 9개 적용, 2 suites / 25 tests 통과를 최종 재확인했다. 검증 후 서버와 임시 디렉터리는 정리했다.
- 모바일 `pnpm --filter @timefit/mobile exec tsc --noEmit`
- 모바일 `pnpm --filter @timefit/mobile lint`
- 모바일 `pnpm --filter @timefit/mobile test` (패키지 스크립트가 `--runInBand`를 고정해 단일 표준 실행 경로 제공)
- SSE 재연결 시 닫힌 이전 EventSource의 늦은 callback이 새 연결 상태를 덮어쓰지 않는 회귀 테스트 포함
- 같은 SSE 세션에서 timestamp가 더 오래된 route snapshot이 최신 route를 되돌리지 않는 회귀 테스트 포함
- SSE 연결 중 상태와 실제 `REROUTED` 이벤트의 Timey `rerouting` 상태를 분리하는 회귀 테스트 포함
- 지도 경로선 진행률이 segment 개수가 아닌 실제 렌더링 길이를 기준으로 완료/남은 구간을 분리하는 회귀 테스트 포함
- 이동 화면 route prewarm이 버스 구간에서 도보 도로선을 사용하지 않고 서울 버스 route-path를 정류장 구간으로 절단하는 회귀 테스트 포함
- 신뢰도 높은 경로 매칭 좌표를 지도 현재 위치로 사용하고, 경로 이탈·낮은 신뢰도에서는 원본 GPS 좌표를 유지하는 회귀 테스트 포함
- 서버 위치 매칭이 상세 route geometry를 선분에 투영하고 `matchedPoint`를 SSE/모바일 상태로 전달하는 회귀 테스트 포함
- 서버의 구간별 `progress`와 전체 경로 `routeProgress`를 분리해 다중 구간 경로의 완료·잔여 라인이 정확히 표시되는 회귀 테스트 포함
- 연속 위치 업데이트에서 GPS jitter로 이전 segment/progress로 되돌아가지 않는 진행 방향 보호 회귀 테스트 포함
- 실시간 스케줄러의 `ROUTE_UPDATED`가 전체 route snapshot으로 SSE 재전송되고 모바일 경로 상태에 반영되는 회귀 테스트 포함
- 이동 화면에서 자동차 구간을 숨겨도 원본 route segment index와 현재 버스·지하철·도보 안내가 어긋나지 않는지 확인
- 자동차 구간이 앞·중간에 포함된 경로에서도 선택 경로의 정류장/역 메타데이터 인덱스가 UI 구간과 일치하는지 회귀 테스트 포함
- 다음 교통수단 안내가 하차 지점이 아닌 다음 구간의 실제 승차 정류장/역을 우선 표시하는 회귀 확인
- 선택 경로의 `transferTip`이 이동 화면의 다음 행동 카드에 표시되는지 확인
- 환승 안내가 있는 보행 구간 또는 대중교통 사이 보행 구간에서 Timey가 `walking` 대신 `transfer` 상태로 전환되는지 회귀 테스트 포함
- 0-width 지도 segment가 진행률 계산에서 `NaN`을 만들지 않는 회귀 테스트 포함
- 긴급 교통 요약 카드의 `경로 변경` CTA가 실제 reroute 콜백을 호출하고, 콜백이 없을 때 비활성화되는지 확인
- 연속 경로 이탈 위치 업데이트가 확인 시점에 한 번만 reroute를 요청하고, 경로 복귀 후 재이탈 시 다시 요청하는 회귀 테스트 포함
- 이동 화면의 미구현 `공유`·`신고` CTA를 노출하지 않고 실제 동작하는 빠른 액션만 표시하는지 확인
- Push payload의 타입에 따라 알림 탭이 루틴 화면 또는 이동 화면으로 이동하고, 알 수 없는 payload는 무시하는 회귀 테스트 포함
- 서버의 `timefit`/`timefit-silent` channelId와 Android channel 생성 설정이 일치하는 순수 설정 테스트 포함
- Timey asset validator `pnpm validate:timey` (Rive handoff/fallback/2.5D asset 상태 확인)
- Timey 필수 상태의 접근성 label이 실제 이동·환승·경고·도착 상태를 설명하는지 회귀 테스트 포함
- production 2.5D PNG 4종 합계가 2 MiB 예산 이하인지 validator의 `2.5D BUNDLE BUDGET` 결과로 확인
- production 2.5D PNG가 유효한 PNG이고 이미지 한 변이 1536px 이하인지 validator의 `2.5D IMAGE QUALITY` 결과로 확인
- Rive runtime이 `EXPO_PUBLIC_TIMEY_RIVE_ENABLED`와 `EXPO_PUBLIC_TIMEY_RIVE_ASSET_READY`를 모두 true로 설정한 경우에만 활성화되는지 config 회귀 테스트 포함
- production에서도 `EXPO_PUBLIC_ENABLE_RIVE=true`를 명시할 때만 Rive rollout 경로가 열리고, 유효하지 않은 `.riv`는 runtime asset gate에서 계속 fallback되는지 확인
- 검증된 2.5D asset이 production 기본 렌더러로 선택되고 `EXPO_PUBLIC_ENABLE_SOFT_3D=false`로 명시했을 때만 flat fallback으로 내려가는지 확인
- Android native `apps/mobile/android/gradlew :app:assembleDebug --no-daemon --console=plain` (Rive autolinking 포함 Debug APK 생성 확인)
- 현재 작업트리 기준 Android Debug APK `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` 생성 성공 (2026-07-21; 최초 sandbox Gradle cache lock 권한 오류는 권한 상승 재실행으로 해소)
- 최신 APK native inspection에서 `librive-android.so`는 포함됐지만 유효 `.riv` 리소스는 아직 없어 Rive runtime은 활성화하지 않음; `adb devices -l`은 연결 장치 없이 종료
- 로컬 `adb devices -l`은 ADB daemon의 sandbox socket 권한 오류로 실기기 목록을 확인하지 못함; APK 생성과 분리된 실행 환경 blocker로 기록
- 2026-07-22 권한 상승 환경에서 `adb devices -l`을 재확인했으나 연결된 Android 장치는 없었고, iOS `xcrun simctl list devices available`도 사용 가능한 Simulator가 없었다. 코드 실패가 아닌 장치·runtime 미연결 상태로 기록한다.
- Android release `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` 생성 성공(2026-07-22; 182 MB). APK의 `assets/index.android.bundle`에서 최신 `timey-base-v5-mouth-large.png` 사용을 확인했고, Rive native library(`librive-android.so`, 4 ABI)도 포함되어 있다. 단, `timey_state_machine.riv`는 현재 0 bytes로 validator 최소 크기(128 bytes) 미만이라 Rive runtime은 계속 비활성 상태이며 2.5D fallback을 사용한다.
- iOS `xcodebuild -list -project TimeFit.xcodeproj`는 프로젝트/스킴을 확인했고 Swift/Pods/Rive 컴파일 단계까지 진행했으나, 현재 실행 환경에서 CoreSimulator 서비스와 simulator runtime이 없어 `Images.xcassets` Asset Catalog 단계에서 중단됐다. 코드 문제와 분리된 Xcode 실행 환경 blocker로 기록한다.
- Prisma schema 변경 후 `pnpm --filter @timefit/api exec prisma generate`
- 루틴 worker 초기화 즉시 1회 실행, Push 일시 실패 시 `lastTriggeredAt`을 기록하지 않고 다음 worker 주기에 재시도하는 단위 테스트 포함
- stale 지하철 데이터가 마지막 실제 수신 시각을 유지하는 회귀 테스트 포함
- 실시간 provider가 `UNAVAILABLE`/`CHECKING`일 때 시도 시각을 최신 수신 시각으로 표시하지 않고, 실제 수신 시각이 없음을 전달하는 회귀 테스트 포함
- 이동 화면의 실시간 카드가 고정된 혼잡 placeholder 대신 실제 provider 출처와 `수신 없음`을 표시하는 회귀 테스트 포함
- 모바일 실시간 카드가 마지막 수신 시각에서 2분 이상 갱신되지 않으면 `LIVE`/`DELAYED`를 자동으로 `STALE`로 표시하는 회귀 테스트 포함
- 버스 ETA `0분(도착 임박)`을 빈 provider 응답으로 오인하지 않는 회귀 테스트 포함
- 동일 route의 느린 realtime refresh가 중첩되지 않는 provider rate-limit 보호 회귀 테스트 포함
- 새 이동 시작·재탐색 직후 realtime provider를 즉시 한 번 조회하고 이후 cadence로 전환하는 회귀 테스트 포함
- background에서 foreground로 복귀할 때 realtime provider를 즉시 재조회하는 회귀 테스트 포함
- 인증된 활성 Trip의 모바일 foreground/background 상태가 서버 scheduler polling 간격에 반영되고, 타 사용자 요청은 거부되는 E2E 검증 포함
- Trip을 background 상태에서 시작해도 시작 직후 서버 scheduler가 background polling 간격으로 동기화되는지 모바일 lifecycle 회귀 확인
- 빈 route가 반복 polling될 때 `ROUTE_INVALIDATED`·재탐색 이벤트를 중복 방출하지 않고 상태 전이마다 한 번만 알리는 회귀 테스트 포함
- 이동 종료·재탐색으로 tracking state가 제거된 뒤 늦게 도착한 provider 응답을 버리는 회귀 테스트 포함
- Expo Push 429/5xx 단일 재시도와 영구 4xx 무재시도 분기 회귀 테스트 포함
- Expo Push 요청·receipt 조회가 `EXPO_PUSH_TIMEOUT_MS` 이후 중단되고 worker가 실패로 회복하는 회귀 테스트 포함
- Expo Push HTTP 200이어도 ticket 배열이 비어 있거나 없는 malformed 응답은 전달 성공으로 기록하지 않는 회귀 테스트 포함
- Expo Push HTTP 200이어도 ticket `status`가 `ok`/`error`가 아닌 malformed 응답은 전달 성공으로 기록하지 않는 회귀 테스트 포함
- malformed/legacy Push token이 Expo에서 `skipped`되어도 Device·routine·trip의 토큰을 정리하는 회귀 테스트 포함
- Expo ticket ID를 저장하고 15분 이후 receipt에서 `DeviceNotRegistered`를 확인해 만료 token을 정리하는 worker 회귀 테스트 포함
- receipt worker가 PostgreSQL 일시 불가 시 앱 프로세스를 중단하지 않고 다음 주기에 재시도하는 회귀 테스트 포함
- routine automation worker가 PostgreSQL 일시 불가 시 unhandled rejection 없이 다음 주기를 기다리는 회귀 테스트 포함
- 지연 Push 발송 실패 시 기준 지연값을 성공 처리하지 않고 다음 실시간 갱신에서 재시도하는 회귀 테스트 포함
- 이미 등록된 Device Push Token으로 새 루틴을 생성해도 worker 발송용 토큰이 자동 연결되는 회귀 테스트 포함
- 동시 routine worker가 동일 dedup key를 처리할 때 `already_sent`와 `in_flight`를 구분해 발송 성공으로 오기록하지 않는 회귀 테스트 포함
- 여러 기기가 등록된 계정에서 가장 최근 갱신된 Device Push Token을 새 루틴에 연결하는 조회 정렬 규약 포함
- 동일 플랫폼에 레거시 Device가 중복되어 있어도 가장 최근 갱신 레코드를 갱신하는 token 등록 회귀 테스트 포함
- 메인 루틴 생성·수정 모달에서도 시간 기준, 여유 시간, 선호 교통수단, 예외 날짜가 API payload에 유지되는지 확인
- 루틴 예외 날짜가 중복 제거될 뿐 아니라 실제 달력에 존재하는 날짜만 payload에 포함되는지 자동 검증
- 설정 화면에는 알림 전체/출발 시점/지연·경로 변경 알림/진동/위치 권한/계정 액션만 남기고, 저장 장소 관리는 루틴 화면에서 유지하는지 확인
- 설정의 계정 화면에서 계정 삭제 확인 대화상자와 실제 `DELETE /auth/account` cascade 흐름이 동작하는지 확인

현재 기준 자동 테스트는 API 40 suites / 156 tests, 모바일 21 suites / 75 tests다. 모바일 테스트에서
`react-test-renderer` deprecation 로그가 출력될 수 있지만 테스트 실패는 아니며, 별도 의존성 교체 작업으로 추적한다.

## 실기기 검증

- iOS/Android에서 알림 권한 허용 후 Expo Push Token 등록 로그 확인
- 앱 실행 중 토큰 갱신 이벤트가 발생했을 때 서버 등록과 루틴 동기화가 다시 수행되는지 확인
- 시스템 설정에서 알림 권한을 변경한 뒤 앱이 foreground로 복귀하면 권한이 허용된 경우 Push Token 재동기화가 수행되는지 확인
- 앱 종료·백그라운드 상태에서 루틴 알림 수신 확인
- 동일 루틴이 같은 날짜에 중복 발송되지 않는지 확인
- 루틴별 설정한 알림 시점(예: 10분 전)에 정확히 1회 발송되는지 확인
- 유효하지 않거나 만료된 토큰의 실패 로그 확인
- Expo Push 일시 실패 후 같은 루틴이 다음 worker 주기에 재시도되고, `DeviceNotRegistered` 토큰은 정리되는지 확인
- Push 발송 15분 후 Expo receipt 조회에서 실제 전달 결과와 `DeviceNotRegistered` token 정리가 확인되는지 검증
- Push 알림을 탭했을 때 루틴 추천은 루틴 화면으로, 출발·지연·경로 변경 알림은 이동 화면으로 이동하는지 확인
- 현재 위치가 진행 중인 경로선에 매칭되고 완료/남은 선이 분리되는지 확인
- 버스·지하철·도보 구간별 최신 시각, stale, unavailable 표시 확인
- 경로 이탈 및 재탐색 시 지도선과 Timey 상태가 함께 갱신되는지 확인
- 이동 화면의 `경로 재탐색`이 현재 위치를 서버에 즉시 전송하고 새 경로/SSE 상태를 반영하는지 확인
- 긴급 상태의 `경로 변경` 버튼이 동일한 reroute 흐름을 호출하는지 확인
- 이동 화면의 `위치 재보정`이 현재 위치를 즉시 갱신하는지, `이동 종료`가 추적을 중지하고 홈으로 복귀하는지 확인
- 현재 2.5D 기본 에셋 `apps/mobile/assets/characters/timey/3d/timey-base-v5-mouth-large.png`가 둥근 알람시계형 몸체·중앙 상단 버튼·짧은 팔·확대된 입으로 표시되는지 확인
- 2.5D 기본·이동·경고·성공 상태에서 저빈도 blink와 상태별 부유/흔들림/긴장/축하 모션이 자연스럽게 표시되는지 확인
- 2.5D 이동 모션이 도보·버스(좌우 흔들림)·지하철(상하 진동)·환승 상태별로 구분되는지 확인
- `timey-warning-v1.png`, `timey-walking-v1.png`, `timey-success-v1.png`가 각각 경고·이동·도착 상태에서 표시되는지 확인
- 저사양 Android에서 Timey 2.5D 모션의 프레임 저하·메모리 증가 확인
- Expo Go가 아닌 development build에서 `rive-react-native`와 유효한 `timey_state_machine.riv`를 포함해 Rive 상태 입력·트리거 확인
- 실제 development build에서 `timey_state_machine.riv`, `timey-base-v5-mouth-large.png`, 상태별 PNG가 APK/IPA 번들에 포함되는지 확인
- validator가 유효한 `.riv`를 확인한 뒤에만 `EXPO_PUBLIC_TIMEY_RIVE_ENABLED=true`와 `EXPO_PUBLIC_TIMEY_RIVE_ASSET_READY=true`를 함께 설정하고, 그 전에는 2.5D fallback을 사용하는지 확인
- 설정의 진동·위치 권한·계정 삭제가 실제 상태와 일치하는지 확인
- 설정에서 알림을 켤 때 OS 알림 권한을 요청하고, 권한 거부 시 서버 알림 선호도를 켜지 않는지 확인
- 알림 설정의 OS 권한-서버 선호도 결합 규칙(거부 시 비활성 표시·활성 저장 차단)을 순수 단위 테스트로 유지
- 위치 권한을 시스템 설정에서 변경한 뒤 앱 복귀 시 상태 라벨이 갱신되는지 확인

## 운영 전 확인

- `DATABASE_URL`에 routine migration 적용
- Expo/EAS project ID와 Android/iOS push credential 확인
- Expo resolved config에서 project ID `33b571f0-38f6-427d-95c8-3fe78588ea23`, `timefit` scheme, Android package/iOS bundle identifier, `expo-notifications` plugin 확인 (현재 로컬 config 확인 완료)
- EAS 프로젝트 조회 및 인증은 정상이며, 과거 Android development build `FINISHED` 기록을 확인했지만(2026-04-19 이전 커밋·만료 artifact) 현재 코드/Push credential의 실기기 동작 증거로 사용하지 않음
- EAS Android/iOS push credential이 실제 프로젝트에 등록되어 있는지 확인 (credential 상태와 실기기 수신은 아직 미검증)
- 2026-07-22 `eas project:info`는 `api.expo.dev` DNS 해석 실패로 조회하지 못했다. EAS credential 상태 자체와 구분되는 네트워크 환경 blocker로 기록한다.
- 현재 작업트리의 EAS build 업로드는 외부 서비스로 소스 전체를 전송하므로 명시적 사용자 승인 없이는 실행하지 않음
- API 운영 환경에 `EXPO_PUSH_API_URL`(기본값: Expo Push Send API), `ODSAY_API_KEY`, 교통 provider key가 설정되어 있는지 확인
- API 로그에서 token, authorization header 등 비밀값이 노출되지 않는지 확인
- provider rate limit과 realtime cache TTL을 운영값으로 검토
- 교통 congestion snapshot이 Prisma에 영속화되고 DB 연결 불가 시에만 in-process fallback으로 내려가는지 확인

## 2026-07-22 최신 실행 결과

### 자동 검증 재실행

- 추가 재실행에서 API build, 모바일 TypeScript, 모바일 Jest가 모두 성공했다. 모바일 Jest는 22 suites / 77 tests 통과이며 `react-test-renderer` deprecation 로그만 출력되고 실패는 없다.
- 모바일 Jest를 실제 명령 `pnpm --filter @timefit/mobile exec jest --config jest.config.ts --runInBand`로 실행해 21 suites / 75 tests 통과를 재확인했다.
- API unit을 실제 명령 `pnpm --filter @timefit/api test:unit`으로 실행해 40 suites / 156 tests 통과를 재확인했다.
- 격리 임시 PostgreSQL(127.0.0.1:55436)에 test database를 생성하고 `pnpm --filter @timefit/api test:e2e:postgres`를 실행해 migration 9개, 2 suites / 25 tests 통과를 확인했다. 임시 DB와 서버는 종료·정리했다.
- API build, API lint, 모바일 TypeScript, 모바일 lint는 이번 실행에서 오류 없이 종료했다.
- `pnpm validate:timey`는 SVG·2.5D fallback·asset budget을 통과했지만 `timey_state_machine.riv`가 0 bytes라 `RIVE_RUNTIME_READY: false`로 남았다.
- 첫 모바일 script 호출에 `--runInBand`를 중복 전달해 `No tests found`가 발생했으나, Jest 직접 호출로 재실행해 테스트 기준선을 확인했다. 코드 실패로 집계하지 않는다.

### Android 실기기 검증

- ADB에서 `R3CN20904CF`가 `device` 상태로 감지됐다.
- 기기: Samsung SM-G986N, Android 13, SDK 33.
- 패키지: `com.devkdy.timefitmobile`.
- 기존 Debug APK를 데이터 삭제 없이 설치했고 Dev Client 화면이 표시됐다.
- Release APK `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`를 데이터 삭제 없이 설치한 뒤 `.MainActivity`가 실행됐다.
- Release APK에서 React Native 번들이 로드되고 초기 홈 화면과 둥근 알람시계형 2.5D Timey가 실제 표시되는 것을 확인했다.
- `timefit://auth` deep link가 `com.devkdy.timefitmobile/.MainActivity`로 resolve되는 것을 확인했다.
- Release 앱 프로세스는 실행 중이었고 이번 실행 로그에서 `FATAL EXCEPTION`은 확인되지 않았다.
- 위치 fine/coarse 권한은 현재 기기에서 허용되지 않았고, User 0의 알림 권한은 OAuth 후 granted=true로 확인됐다. 실제 위치 추적과 Push 수신 시나리오는 아직 실행하지 않았다.

### Android 실행 Blocker

- Expo CLI 포트 오류의 원인은 `freeport-async` 2.0.0과 Expo CLI의 포트 탐색 인자 규약 충돌로 확인됐다. 루트 `pnpm.overrides`에 `freeport-async: 1.1.1`을 고정하고 lockfile을 갱신했다.
- 수정 후 `pnpm --filter @timefit/mobile exec expo start --dev-client --localhost --port 8081`이 `http://localhost:8081`에서 정상 대기하는 것을 확인했다. Expo CLI/Metro 시작 기준은 Pass다.
- `apps/mobile/android`에서 `./gradlew :app:assembleDebug --no-daemon --console=plain`이 clean 이후 codegen 재생성과 함께 623 actionable tasks 성공했다. 새 APK에는 `expo.modules.manifests.core.Manifest` 정의 클래스가 실제 포함됐다.
- 새 Debug APK를 `adb install -r`로 데이터 삭제 없이 덮어 설치하고 `adb reverse tcp:8081 tcp:8081` 후 Metro 항목을 선택했다. Dev Client가 `.MainActivity`로 전환되고 `Running "main"` 및 DeepLink 초기화 로그가 확인됐으며, `NoClassDefFoundError`/`FATAL EXCEPTION`은 재현되지 않았다. Debug Client + Metro hot reload 기준도 Pass다.
- 앱 재실행 중 발견한 `expo.modules.splashscreen.SplashScreenManager` ClassNotFound를 모바일 의존성 누락으로 분류하고 Expo SDK 54 호환 `expo-splash-screen ~31.0.13`을 추가했다. Debug APK 재빌드 후 해당 클래스가 APK에 포함되고, 데이터 유지 재설치·강제 종료·재실행에서 `Running "main"`이 확인되며 SplashScreen ClassNotFound/FATAL은 재현되지 않았다.
- `pnpm --filter @timefit/mobile dev:metro` 직접 Metro 스크립트는 하위 레벨 fallback으로 남겼다. Expo CLI 경로가 정상화된 현재 기준에서 이 fallback만으로 앱 번들 로딩까지는 별도 검증하지 않았다.
- 로그인 전 홈·설정·루틴 화면을 실기기에서 열어 Timey 2.5D, 설정 항목, 빈 루틴 상태를 확인했다. 설정의 위치 권한 항목은 OS 앱 정보 화면으로 이동했으며, 임의로 권한을 허용하거나 앱 설정을 변경하지 않았다.
- Google 로그인 버튼을 실제로 눌러 Samsung Internet Custom Tab이 열리고 `timefit://auth` callback이 `MainActivity`로 복귀하는 것을 확인했다. `oauth_ticket_redeem_success`와 로그인 후 홈의 `doyeon “devkdy”` 표시를 확인했으므로 Google OAuth Android callback·session 발급은 Pass다. 실제 계정 로그아웃·토큰 만료·provider별 전체 조합은 미검증이다.
- OAuth 성공 후 foreground Push token 동기화가 `E_REGISTRATION_FAILED`로 실패했다. logcat 원인은 Firebase `Default FirebaseApp` 미초기화이며, FCM/Expo Push credential이 없는 Debug APK 환경의 외부 조건 blocker로 분류한다. 실제 Push 발송·수신은 Pass로 표시하지 않는다.
- 현재 User 0 기준 `POST_NOTIFICATIONS`와 위치 fine/coarse는 granted=false이며, 기기 `location_mode=3`을 확인했다. 실제 Push 수신은 아직 확인하지 않았다.
- 이후 QA 종료 시 User 0의 `POST_NOTIFICATIONS`를 원래 상태인 granted=false로 복구했고, 위치 fine/coarse도 granted=false로 유지했다.
- 로그인된 홈에서 도착 시간 picker를 열고 취소하는 흐름, 현재 위치 자동 출발지 설정 안내에서 `허용 안 함`을 선택하는 흐름을 확인했다. 이어서 경로 검색 화면에서 Kakao JS WebView map init/ready, 서울시청 중심 지도 렌더링, Kakao REST nearby-POI, keyword 검색 결과 8건을 실기기에서 확인했다. 실제 대중교통 경로선·실시간 교통·경로 이탈은 아직 실행하지 않았다.
- 위치 권한을 일시적으로 허용한 QA 경로에서는 Android Fused GPS가 실제 좌표 `37.5452047, 127.1345242`, 정확도 약 10.45m를 반환했고 Kakao `geo/coord2address`와 `nearby-POI`가 성공했다. 이는 위치 권한 허용·GPS·역지오코딩의 실기기 Pass 증거다. QA 종료 후 fine/coarse 권한은 다시 revoked 상태로 복구했다.
- Kakao/Naver OAuth, 위치 권한 허용 후 실제 GPS, 실제 지도·교통 provider 호출, SSE 실시간 연결, 경로 이탈 재탐색, Push 수신, 백그라운드 실행은 아직 실기기에서 검증하지 않았다. Google OAuth의 실제 provider 로그인·callback·session 발급은 위 로그로 확인했지만, logout/token expiry는 미검증이다.
- 유효한 `timey_state_machine.riv`가 없어 Rive 렌더링은 검증하지 않았다.

## 2026-07-22 최종 상태 감사

## 2026-07-22 Timey 표시 품질 고도화

- 공통 `TimeyStage`와 `TIMEY_STAGE_TOKENS`를 추가해 홈·루틴·경로·지도/이동·성공·경고 화면의 stage 높이, aspect ratio, 캐릭터 크기, baseline offset, 여백을 컨텍스트별 토큰으로 관리한다.
- 캐릭터 실제 렌더링 크기와 Stage 영역을 분리했다. Stage가 기준선과 안전 여백을 소유하고, Timey renderer는 Stage 안에서만 상태 모션을 수행한다.
- idle의 큰 반복 부유를 제거하고 상태별 shared motion profile을 추가했다. searching, walking, riding_bus, riding_subway, transfer, warning, urgent, rerouting, offroute, success 등이 서로 다른 미세한 이동·회전·스케일 규칙을 사용하며 success는 one-shot 후 정지한다.
- SVG fallback blink timer는 `animated`일 때만 생성하고 화면 이탈 시 두 timer를 정리한다. blink 중에는 눈 입력만 바뀌며 몸체·그림자·Stage 위치·크기는 유지된다.
- 2.5D fallback도 같은 상태 motion profile을 사용하고, Rive/asset 로딩 실패 시 기존 canonical SVG fallback을 유지한다.
- 화면 연결 범위는 홈 `home`, 루틴/로그인/설정 `routine`, 경로 추천/인증 warmup `route`, 지도/이동 `map`, 도착 완료 `success` Stage다. 기존 silhouette·색상·layer id·asset naming·Rive contract는 변경하지 않았다.
- 신규 display token 테스트를 포함한 모바일 Jest 22 suites / 77 tests, TypeScript, lint가 통과했다. `pnpm validate:timey`는 2.5D budget/image quality/fallback을 통과했으며 유효 `.riv`가 없어 `RIVE_RUNTIME_READY: false`다.
- Android 실기기에서 새 Stage의 모든 화면·상태·화면 전환·blink·background/foreground·저사양 frame 결과는 아직 확인하지 않았으므로 Pass로 표시하지 않는다.
- 새 Debug APK를 다시 `assembleDebug`로 빌드한 뒤 기존 앱 데이터 유지 방식으로 `adb install -r` 설치하고 Metro deep link로 실행했다. SM-G986N 실기기에서 홈 Stage와 루틴 화면의 실제 2.5D 렌더링을 확인했다.
- 홈 화면에서는 Timey가 hero 텍스트·도착 입력 카드와 겹치지 않고 공통 home Stage 기준선에 배치됐다. 루틴 화면에서는 header mascot과 empty-state mascot이 routine 토큰으로 표시되며, 기존 화면의 임의 94/80 숫자 렌더링을 제거했다.
- 새 Android 실행에서 `FATAL`, `NoClassDefFoundError`, `ClassNotFoundException`은 확인되지 않았다. Push 권한 요청은 QA 종료 상태를 보존하기 위해 거부했으며 Firebase `Default FirebaseApp` 미초기화 로그는 기존 Push blocker와 동일하다.
- Android에서 모든 상태(walking/riding/transfer/warning/rerouting/offroute/success), 빠른 전환·background/foreground·blink 중 전체 캐릭터 유지·저사양 프레임 드롭까지는 아직 개별 확인하지 않았으므로 Pass로 표시하지 않는다.

## 2026-07-22 Timey 2차 시각 고도화

- asset 폴더를 다시 점검한 결과 `warning.png`, `urgent.png`, `panic.png`, `walking.png`, `riding_bus.png`, `riding_subway.png` 등 상태명 placeholder는 모두 1×1이며, `unused/timey_warning.webp`·`timey_urgent.webp`도 16×16 placeholder였다. 승인된 warning/urgent 대체 색상 asset은 현재 저장소에 없어 임의 색상 asset은 만들지 않았다.
- 실제 3D PNG alpha 영역을 측정했다. `timey-base-v5-mouth-large.png`는 1024×1536 canvas에서 alpha bbox `(218,438)-(800,1108)`으로 세로 occupancy 43.6%, warning 44.2%, walking 47.0%였다. 캐릭터가 작게 보인 주요 원인은 canvas 투명 padding으로 판정했다.
- 2.5D renderer의 visual canvas를 공통 `visualScale` 1.65로 확대해 Stage 기준선은 유지하면서 실제 캐릭터 occupancy를 약 70%대까지 높였다. 홈 실기기 화면에서 이전보다 큰 Timey와 Stage overlay가 실제 표시되는 것을 확인했다.
- 상태 모션을 breathing/scan/walk/bus/subway/transfer/alert/reroute/success keyframe 패턴으로 분리했다. walking은 수직 걸음 리듬, bus는 불규칙한 주행 반응, subway는 작은 가감속 sway로 구분되며 기존 단일 좌우 진자 패턴을 제거했다.
- walking·riding_bus·riding_subway·transfer·warning·urgent·rerouting·success에 `TimeyStatusOverlay`를 별도 layer로 추가했다. Ionicons 기반의 작은 footsteps/bus/train/transfer/alert/route/check icon이며 캐릭터 silhouette와 Stage mount를 교체하지 않는다.
- fixture에 asset path, pose/color variant, alternate color asset 유무, motion pattern, overlay, renderer capability, blink effect setup count를 추가했다.
- 새 Debug APK는 `assembleDebug` 623 actionable tasks 성공 후 데이터 삭제 없이 설치했다. 홈 화면에서 확대된 2.5D Timey와 검색 overlay를 확인했고, startup 후 `FATAL`/`OutOfMemory` 재발은 확인하지 않았다.
- 개발 deep link를 RootLayout에서 강제 `router.replace`하는 실험은 Dev Client의 반복 initial URL과 결합해 Android `OutOfMemoryError`를 유발했다. 해당 변경은 즉시 철회했으며, 개발 deep-link 자동 진입은 Pass로 표시하지 않는다. fixture는 기존 수동 Dev Client 진입 방식으로만 검증한다.
- warning/urgent의 실제 대체 색상, 모든 11개 상태의 Android 개별 motion, blink 중 몸체·그림자·아이콘 유지, 저사양 frame drop은 이번 실행에서 개별 확인하지 못했다. 모두 Pending이며, Rive 렌더링은 유효 `.riv`가 없어 계속 Blocked다.

## 2026-07-22 Timey fallback renderer 오류 수정

- 메인 화면 상단의 돋보기 형태는 `TimeyStatusOverlay`의 `search-outline`였고, 홈의 `timeyState`가 `searching`일 때 표시되는 상태 overlay였다. HomeHero에 `showOverlay={false}`를 적용해 홈 입력 hero에서는 overlay를 렌더링하지 않도록 했다. fixture/searching 상태의 search overlay allowlist는 유지했다.
- 2.5D 얼굴의 살색 타원 2개는 `Timey3DAvatar`의 `eyelid` View 두 개(`backgroundColor: #FFF1DE`)가 blink 시 opacity 1로 표시되면서 발생했다. 승인된 closed-eye asset이 없으므로 해당 View·3D blink timer를 제거하고 `TIMEY_3D_BLINK_MODE = eyesOpenFallback`으로 명시했다.
- canonical SVG fallback은 기존 `EyesPart`의 눈 scale blink만 사용하며 body, shadow, top button, overlay opacity/unmount/key는 변경하지 않는다.
- 수정 후 Mobile Jest 22 suites / 78 tests, TypeScript, lint, validator, diff check가 통과했다.
- 수정 Debug APK를 SM-G986N에 데이터 삭제 없이 설치하고 메인 화면을 실제 확인했다. 돋보기 overlay는 사라졌고 상단 버튼과 확대된 캐릭터 본체는 유지됐다. 15초 이상 실행 화면에서 살색 eyelid 타원 및 신규 FATAL/OOM은 확인되지 않았다.
- 실제 눈을 감는 애니메이션, searching/walking/bus/subway/warning/urgent/reroute/success별 overlay와 motion은 이번 실행에서 fixture 진입 문제로 개별 Pass 처리하지 않는다. `eyesOpenFallback`은 의도된 Pending-safe fallback이며 closed-eye asset 제공 전에는 자연스러운 blink 완료로 표시하지 않는다.

### 2026-07-22 Timey Android 상태 fixture 재검증

- 개발 전용 `timefit://dev/timey-preview` deep link와 `apps/mobile/app/dev/timey-preview.tsx`의 Android State Fixture를 추가·실행했다. 운영 빌드에서는 `_layout.tsx`의 `__DEV__` 조건으로 route가 등록되지 않는다.
- Expo Dev Client용 서버(`expo start --dev-client`)를 연결한 SM-G986N에서 fixture 화면, 11개 필수 상태 버튼, 빠른 상태 연속 전환 버튼, Rive fallback 안내가 실제 표시됐다.
- fixture에 표시된 `Stage mounts: 1`은 상태 변경 중 공통 Stage가 재마운트되지 않았음을 확인하는 내부 계측값이다. Android 화면에서 `idle`과 `warning` 상태 전환 및 warning 모션을 확인했으며, 상태 변경 후에도 Stage 기준선/렌더링 크기와 mount count가 유지됐다.
- fixture 화면의 blink 안내는 눈 레이어만 변경하고 전체 renderer opacity/key/unmount를 사용하지 않는 계약을 명시한다. 실제 Rive asset은 유효하지 않으므로 Android에서 검증한 대상은 canonical SVG/2.5D fallback renderer다.
- `AppNavigationCoordinator`는 개발 전용 `/dev/*` route를 인증/active-trip 복구 redirect에서 제외하도록 보강했다. 일반 route의 인증·복구 정책은 변경하지 않았다.
- hardware back을 fixture에서 실행했을 때 앱이 Android launcher로 종료/복귀했다. route 내부 back-stack 유지 UX와 재진입은 별도 검증이 필요하다.
- `timefit://auth?...`와 `timefit://dev/timey-preview`가 모두 `MainActivity`로 resolve되는 것을 read-only package resolver로 재확인했다. OAuth cold-start의 실제 provider callback/session 발급은 기존 Google OAuth Pass 증거와 구분해, 이번 fixture 단계에서는 재실행하지 않았다.
- 모든 필수 상태의 Android 개별 시각 구분, rapid sequence 중 각 프레임, background/foreground 복귀 후 blink timer 중복 여부, 저사양 frame drop은 개별 영상/성능 측정이 없어 Pass로 표시하지 않는다. 자동화 상태 profile 테스트와 fixture 재현성은 Pass, 실제 Android 상태별 시각 QA는 Partial/Pending이다.

### 전체 상태

- Internal Product Hardening: In Progress
- Android Device Validation: In Progress
- Other External Validation: Blocked
- Release readiness: Not Ready

### 테스트 결과

| 영역 | 결과 | 근거 또는 제한 |
| --- | --- | --- |
| API build | Pass | 실제 build 성공 |
| API lint | Pass | 실제 lint 성공 |
| API unit | Pass | 40 suites / 156 tests |
| API E2E | Pass | 격리 PostgreSQL, 2 suites / 25 tests |
| Mobile TypeScript | Pass | `tsc --noEmit` 성공 |
| Mobile lint | Pass | 실제 lint 성공 |
| Mobile Jest | Pass | 22 suites / 77 tests |
| Android 실기기 연결 | Pass | `R3CN20904CF`, SM-G986N, Android 13 |
| Android 앱 실행 | Pass | Debug/Release APK 및 Dev Client 실행 |
| Android 인증 QA | Partial | Google OAuth callback/session Pass; Kakao/Naver·logout·expiry 미검증 |
| Android 루틴 QA | In Progress | 빈 상태·화면 진입만 확인; 생성·수정·삭제는 미검증 |
| Android 위치 권한 QA | Partial | 권한 허용 중 GPS·역지오코딩 Pass; 종료 후 권한 원복 |
| Android 설정 QA | Partial | 설정 화면 및 OS 권한 이동 확인; 전체 저장 동작 미검증 |
| Android 지도·경로 QA | Partial | 지도·검색·POI Pass; 실제 대중교통 경로선은 provider blocker |
| Android 실시간 상태 QA | Partial | 외부 지하철 ETA 응답 확인; 앱 SSE는 미검증 |
| Timey 상태 fixture | Partial | 11개 상태 재현 UI·fallback·mount 계측 확인; 상태별 Android 시각 구분은 Pending |
| Android 경로 이탈 QA | Blocked | 실제 경로 후보가 없어 실기기 시나리오 진입 불가 |
| Android Push 발송 | Blocked | Firebase/Expo Push credential 및 Firebase 초기화 부족 |
| Asset validator | Partial | 2.5D fallback Pass; 유효 `.riv` 없음 |
| Integration test | Pass | 격리 PostgreSQL E2E 25 tests |

### 검증 범위 구분

#### 내부 코드 기준으로 확인된 기능

- 상세 루틴 필드, 알림 선호도, Push token 저장 계약
- 경로 후보·추천 계산·위치 업데이트·SSE 이벤트 계약
- 경로 geometry 매칭, 진행률, 경로 이탈 debounce 및 재탐색 로직
- 설정 화면 단순화 및 Timey 2.5D fallback 상태 전환

#### 자동화 테스트로 검증된 기능

- API unit/build/lint
- 모바일 TypeScript/lint/Jest
- PostgreSQL migration 및 인증·루틴·Trip/SSE·위치 매칭 E2E
- Push worker, realtime scheduler, route geometry, Timey state 테스트

#### Android 실기기에서 실제 검증된 기능

- APK/Dev Client 실행과 Metro 연결
- Google OAuth 앱 복귀 및 session 발급
- 설정·루틴 빈 상태·도착 시간 picker
- Kakao 지도 렌더링, keyword/nearby 검색
- 권한 허용 상태의 GPS·역지오코딩·POI 호출
- Release 앱의 2.5D Timey 표시

#### 외부 환경 확보 후 추가 검증할 기능

- 실제 대중교통 경로 후보·상세 경로선
- SSE 실시간 route update 및 경로 이탈 재탐색
- Expo Push token 등록·발송·백그라운드 수신·receipt
- 유효한 Rive state machine의 실제 렌더링과 모션
- Kakao/Naver OAuth 및 token expiry
- iOS 실기기/Simulator 및 저사양 Android 성능

### External Validation Blocker

- ODsay 및 교통 provider 운영 API key/configuration
- 운영 API에 모바일이 사용하는 도보 geometry endpoint 배포 및 contract parity 확인
- `render.yaml`의 `timefit-api` 서비스는 `autoDeploy: false`로 설정되어 있어 저장소 변경만으로 운영 API가 갱신되지 않는다. 현재 운영 404와 내부 controller 구현의 차이는 수동 Render deploy 또는 명시적 배포 트리거가 필요한 상태와 일치한다.
- 현재 branch는 `main`, HEAD는 `fc88fc5760c7e07bd7bd116097dbf01ccb251c1a`이며 `origin/main`도 동일 commit이다. 그러나 작업트리에는 154개의 기존 미커밋 변경·추가가 남아 있다. 운영 서버는 이 작업트리 변경을 자동으로 받을 수 없으므로, 현재 운영 404를 해결하려면 변경 범위 검토·커밋·승인된 수동 배포가 별도로 필요하다.
- 현재 환경에는 Render MCP와 `render` CLI가 없어 배포 ID·최근 deploy commit·build/runtime log를 직접 조회하지 못했다. 따라서 운영 API가 어느 commit에서 실행 중인지와 수동 배포 성공 여부는 External Validation Blocked로 유지한다.
- Firebase/Expo Push credential 및 Android Firebase 초기화 리소스
- 유효한 `timey_state_machine.riv`
- iOS device 또는 Simulator runtime
- EAS 네트워크 접근(현재 build 업로드는 사용자 승인 없이는 수행하지 않음)

### 외부 API 확인 증거

- 외부 운영 API `GET /health`는 HTTP 200과 `status: ok`를 반환했다.
- 외부 운영 API `GET /realtime/eta?type=SUBWAY&station=시청&line=1호선`은 실제 `SEOUL_API` 출처의 ETA 응답(`etaMinutes: 7`, `updatedAt` 포함)을 반환했다. 실시간 지하철 provider 연결 기준은 Pass다.
- 외부 운영 API에 서울시청→서울역 경로 계산을 요청했을 때 `ROUTE_NO_RESULT`/`경로 공급자 설정이 없어 실시간 경로를 계산할 수 없습니다.`가 반환됐다. `/routes`도 `source: fallback`, `status: PROVIDER_DOWN`, `ROUTE_PROVIDER_DOWN`을 반환했다. 실제 대중교통 경로선·경로 후보·SSE 경로 이탈 QA의 현재 blocker는 ODsay/경로 provider 운영 설정이며, 이를 실기기 기능 실패로 집계하지 않는다.
- 모바일 코드 기준으로 경로 후보는 `POST /routes`, 추천 계산은 `POST /recommendations/calculate`, 이동 위치는 인증된 `POST /trips/:id/position`, 실시간 이동 이벤트는 인증된 `GET /trips/:id/events` SSE 계약으로 연결되어 있다. 외부 provider가 복구된 뒤 이 순서로 실기기 검증을 재개한다.
- 모바일 코드가 호출하는 `GET /kakao-local/directions/walk` 도보 geometry proxy는 현재 운영 API에서 HTTP 404(`Cannot GET`)를 반환했다. 저장소 내부 controller 계약과 운영 배포본이 일치하지 않는 별도 API 배포 blocker로 기록한다.
- 저장소 내부 `KakaoLocalController`에는 해당 endpoint가 구현되어 있으며, 전용 Jest 1 suite / 4 tests가 통과했다. 따라서 현재 문제는 내부 구현 누락이 아니라 운영 배포본과 저장소 간 contract parity 문제로 좁혀졌다.
- 현재 Android 소스/번들에는 `google-services.json` 또는 Firebase 초기화 리소스가 확인되지 않았고, `expo-notifications` 플러그인만 설정되어 있다. 앞서 확인한 `Default FirebaseApp` 미초기화 로그와 일치하므로 Push blocker의 내부 증거로 기록한다.
- Rive 파일 3종(`timey_state_machine.riv`, `timey_idle.riv`, `timey_wave.riv`)은 모두 0 bytes이며, validator가 `RIVE_RUNTIME_READY: false`로 판정한 상태와 일치한다. 유효 `.riv` 제공 전 Rive 실기기 검증은 수행하지 않는다.
- 최신 ADB 재확인에서 `com.devkdy.timefitmobile`은 설치된 versionName `0.1.0`/versionCode `1`이며, POST_NOTIFICATIONS와 위치 fine/coarse 권한은 모두 `granted=false`다. 앱 프로세스는 재확인 시 실행 중이지 않았으며, 이는 앱 종료 상태이지 설치 실패로 판정하지 않는다.
