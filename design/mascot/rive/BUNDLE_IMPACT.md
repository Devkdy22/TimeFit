# Timey Rive Bundle Impact

## Goal
- Keep Timey animation production-safe without increasing live transit runtime risk.

## Policy
- Default runtime mode on heavy live surfaces (`TransitView`) is `static`.
- `Rive` is enabled for onboarding or dedicated mascot surfaces.
- `soft3d` assets remain optional and feature-flagged off for core runtime.

## Runtime/Binary Considerations
- `rive-react-native` introduces native/runtime overhead versus static SVG render.
- `.riv` asset adds bundle payload; large multi-artboard files should be avoided.
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
  - runtime feature flag defaults to off
  - `Timey.tsx` lazily requires `Timey3DAvatar` only when `renderStyle=soft3d` and feature enabled

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
- Keep soft3d assets preview/marketing-only; exclude from core runtime surfaces.
