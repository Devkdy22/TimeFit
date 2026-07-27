# Android Device QA Runbook

## Verified project facts

- Package/applicationId: `com.devkdy.timefitmobile`
- Expo slug: `timefit-mobile`
- Deep-link scheme: `timefit`
- Auth callback: `timefit://auth`
- Gradle wrapper: `apps/mobile/android/gradlew`
- Debug build: `./gradlew :app:assembleDebug --no-daemon --console=plain`
- Debug APK: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
- Metro scripts: `pnpm --filter @timefit/mobile dev` and `pnpm --filter @timefit/mobile dev:metro`
- Mobile API variables: `EXPO_PUBLIC_API_URL` or `EXPO_PUBLIC_API_BASE_URL`
- Mobile environment marker: `EXPO_PUBLIC_API_ENV=qa` for QA builds
- Notification channels: `timefit`, `timefit-silent`

Location permissions are declared in `app.json` and the Android manifest. The `expo-notifications` plugin supplies notification configuration; runtime permission state still requires a real device check.

For a physical Android device, use an explicit QA HTTPS API URL or a Mac LAN address reachable from the device. Do not use `10.0.2.2` for a physical device; that address is reserved for typical Android emulator host access. USB `adb reverse` is only valid after a real device and the actual Metro port are confirmed.

## Safe execution sequence

```bash
adb version
adb devices
adb devices -l
adb shell pm list packages | rg 'com\.devkdy\.timefitmobile'
```

Only when a device is listed as `device`:

```bash
APK=apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
adb install -r "$APK"
pnpm --filter @timefit/mobile dev:metro
# Confirm the actual Metro port from the command output before using adb reverse.
adb reverse tcp:<confirmed-port> tcp:<confirmed-port>
adb shell monkey -p com.devkdy.timefitmobile 1
adb logcat -c
adb logcat -v threadtime | rg 'FATAL EXCEPTION|AndroidRuntime|Auth|OAuth|DeepLink|SSE|TripTracking|Route|Notifications|Firebase|Expo|Network'
```

Before installing a QA APK, set `EXPO_PUBLIC_API_ENV=qa` and an explicit `EXPO_PUBLIC_API_URL=https://<qa-api-host>`, then rebuild. Verify both endpoints before device scenarios:

```bash
curl -fsS https://<qa-api-host>/health
curl -fsS https://<qa-api-host>/ready
```

The current Android Gradle configuration treats `debug` as debuggable, so the debug APK expects Metro rather than embedding a standalone JS bundle. Start a QA-configured Metro process before launching the APK; do not reuse a Metro process started with local or production variables. Because the current Metro process must not be interrupted in this preparation step, no QA-configured debug APK was built here.

There is currently no QA-specific Android product flavor or `applicationId`; QA and local debug APKs both use `com.devkdy.timefitmobile`. Installing with `adb install -r` can therefore overwrite the existing debug installation. Confirm the injected URL through the Metro environment and runtime behavior before using the device for QA.

After building, inspect the APK without modifying it:

```bash
strings apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk | grep -E 'timefit-api\.onrender\.com|<qa-api-host>'
```

This inspection can confirm a visible string when present, but absence does not prove the runtime URL for a Metro-dependent debug APK. Runtime confirmation requires the QA Metro process and device logs/screens.

Do not report installation, launch, screen, deep-link, SSE, Push, or performance results as Pass without a connected device and captured evidence. Never include token, authorization, credential, or API key values in logs or reports.

## Current run — 2026-07-22

The repository inspection confirmed the package and APK path. The debug build passed with `623 actionable tasks` and produced `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`. `adb devices` and `adb devices -l` could not start the daemon because the environment denied the ADB smartsocket listener (`Operation not permitted`). No install, Metro connection, `adb reverse`, app launch, or logcat validation was performed.

The exact device model, Android version, API URL used by an installed APK, and runtime screen behavior are therefore not available. Android device validation remains Blocked.

The same ADB restriction was reproduced on the final check: `which adb` resolved to the Android SDK platform-tools binary, `adb version` reported 1.0.41 / platform-tools 37.0.0-14910828, and both `adb kill-server` / `adb start-server` failed before device enumeration. Do not treat a previously reported device model or APK installation as evidence from this execution.

The user-reported Android state is `SM-G986N / Android 13`, Metro `8081`, reverse port configured, and the main screen visible. Those are retained as user-provided evidence for the 2026-07-22 baseline; this environment did not independently capture them during this run.

## Required scenarios after device and QA API are ready

Run auth cold start/deep link/logout/expiry, routine CRUD and ownership, route/progress/SSE/reroute/background recovery, and notification channel/tap flows. Real provider and Push scenarios remain separate gates and must not be replaced by fixtures.
