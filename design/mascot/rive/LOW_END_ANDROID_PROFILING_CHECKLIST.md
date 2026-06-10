# Timey Low-End Android Profiling Checklist

## Target
- Verify Timey integration does not regress live transit UX on low-end Android devices.

## Device Matrix
- Android 10+ low RAM class device (2-4GB)
- 720p or small-width screen class
- One mid-tier reference Android for comparison

## Build Matrix
- `enableRive=false` (baseline)
- `enableRive=true`, `enableLiveRive=false`
- `enableRive=true`, `enableLiveRive=true` (stress)

## Scenarios
- Home screen open/cold start
- Route recommendation open/switch route
- Transit live tracking with frequent SSE updates
- Offroute -> rerouting -> success state transitions

## Metrics
- JS FPS during transit live tracking
- UI thread frame drops/jank percentage
- Memory footprint delta
- CPU usage delta while map + SSE active
- Battery drain trend over 10-15 min transit simulation

## Checks
- No visible Timey flicker during rapid updates
- No repeated trigger spam in Rive transitions
- Fallback to static works when Rive unavailable
- Reduce Motion enabled -> static only behavior

## Release Gate
- If `enableLiveRive=true` causes measurable jank/frame drop in transit live flow, keep it disabled.
- Enable live Rive only after profiling parity with baseline static mode.
