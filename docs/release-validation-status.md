# Release Validation Status

This status covers the Android/provider/Push preparation step and does not include Timey, Rive, asset, motion, overlay, blink, or occupancy work.

| Gate | Status | Evidence |
| --- | --- | --- |
| Internal product hardening | Pass | Previous API/mobile unit and contract tests passed |
| Android project/build | Partial | Package, deep link, channel IDs inspected; debug APK build passed |
| Android device | Blocked | ADB daemon could not start due to smartsocket `Operation not permitted`; no device evidence |
| QA API/DB | Partial | Disposable isolated PostgreSQL E2E DB passed; `/ready` is implemented, but persistent QA resources are not provisioned |
| External provider | Pending | Credentials and authorized deployed endpoint unavailable |
| Push | Blocked | Firebase/Expo credential and real device unavailable |
| iOS | Pending | No simulator/device validation in this step |
| Release readiness | Partial | Internal checks are green; runtime and external gates remain open |

On 2026-07-22, a disposable local PostgreSQL cluster at `127.0.0.1:55432/timefit_e2e_test` was created outside the repository, migrations were applied by `test:e2e:postgres`, and 2 suites / 25 tests passed. The cluster and test data were removed after the run. No production or persistent QA database was used.

The following are not Pass until runtime evidence exists: route success from a real provider, walking geometry on the deployed API, SSE on a real device, reroute, Push receive/tap/receipt behavior, Kakao/Naver OAuth, token expiry, and low-end Android performance.

The repository now provides `GET /ready`. It performs a database probe and returns 503 with a generic `DATABASE_UNAVAILABLE` error when the probe fails. `/health` remains a process-health endpoint. The draft `render.qa.yaml` describes a separate QA web service but was not deployed.

On the final repository check, API build/lint passed, API unit tests passed at 42 suites / 175 tests, isolated PostgreSQL E2E passed at 2 suites / 25 tests, mobile TypeScript passed, and mobile Jest passed at 24 suites / 87 tests. ADB again failed to start with `Operation not permitted`; no APK installation or screen/runtime validation was performed.

The user-provided 2026-07-22 Android baseline reports SM-G986N / Android 13, Metro 8081, successful `adb reverse`, APK installation, app launch, and the TimeFit main screen. These remain separate from the current environment's ADB evidence and do not promote login, routine, SSE, OAuth, Provider, or Push scenarios to Pass.

The QA debug APK remains Pending: the QA URL is not available, and this project’s debug variant is Metro-dependent, so the existing local Metro process cannot be treated as a QA-configured bundle.
