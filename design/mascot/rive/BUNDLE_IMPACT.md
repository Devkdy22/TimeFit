# Timey Rive Bundle Impact

## Goal
- Keep Timey animation production-safe without increasing live transit runtime risk.

## Policy
- Default runtime mode on heavy live surfaces (`TransitView`) is `static`.
- `Rive` is enabled for onboarding or dedicated mascot surfaces.
- `soft3d` is the validated default for core mascot surfaces; `EXPO_PUBLIC_ENABLE_SOFT_3D=false` remains the explicit low-end/staged-rollout fallback.

## Runtime/Binary Considerations
- `rive-react-native` introduces native/runtime overhead versus static SVG render.
- `.riv` asset adds bundle payload; large multi-artboard files should be avoided.
- The four production 2.5D PNG states are kept under a combined 2 MiB budget; `pnpm validate:timey` reports the current total.
- Frequent Rive-driven state updates can increase main-thread and bridge pressure if used on high-frequency screens.

## Current Mitigations
- Feature flags:
  - `enableRive`
  - `enableLiveRive`
  - `enableSoft3D`
- Fail-safe fallback:
  - Rive unavailable or asset missing -> canonical SVG static
- State stabilization:
  - domain transition guard prevents flicker-triggered animation churn
- Trigger policy:
  - trigger inputs fire only on enter transitions (`success`, `offroute`, `rerouting`)
- soft3d isolation:
  - `Timey.tsx` lazily requires `Timey3DAvatar` only when `renderStyle=soft3d` and feature enabled
  - the runtime flag defaults to on only for the bundled 2.5D assets; setting it to false keeps the flat SVG path

## Measurement Checklist
- Compare app startup and first-screen render time with/without Rive.
- Compare JS FPS on live transit screen with `enableLiveRive` off vs on.
- Verify no sustained re-render spikes from stateNumber/urgency updates.
- Confirm `.riv` size and count stay within asset budget.

## Release Recommendation
- Keep `enableLiveRive=false` for production until profiling confirms no regressions on:
  - iPhone small devices
  - iPhone notch devices
  - Android mid/low tier devices
- Keep `enableRive=false` as rollout default until `.riv` asset QA is complete.
- Keep live Rive disabled until profiling and valid `.riv` QA are complete; the bundled 2.5D path is the production-safe core runtime surface.
