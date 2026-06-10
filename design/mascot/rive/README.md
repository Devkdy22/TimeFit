# Timey Rive Guide

## Source
- Canonical SVG asset: `apps/mobile/assets/characters/timey/source/timey.svg`
- Canonical renderer: `apps/mobile/src/components/timey/source/TimeyCanonicalSvg.tsx`

## Import Guideline
- Import canonical SVG into Rive.
- Keep layer naming stable with this exact contract:
  - `body`
  - `face`
  - `leftBell`
  - `rightBell`
  - `leftEye`
  - `rightEye`
  - `mouth`
  - `leftLeg`
  - `rightLeg`
  - `sweat`
  - `questionMark`
  - `alertIcon`
  - `confetti`
- Do not redesign silhouette or proportions.

## MVP States (v1)
- idle: breathing + blink
- searching: eyes scan
- warning: sweat + small shake
- urgent: fast bell jiggle
- rerouting: thinking dots / head tilt
- success: bounce + smile

## Extended States (post-MVP)
- confident
- waiting
- walking
- riding_bus
- riding_subway
- transfer
- panic
- offroute
- late

## State Machine Contract
- File: `apps/mobile/assets/animations/timey/timey.riv`
- State Machine: `TimeyStateMachine`
- Inputs:
  - `stateNumber` (Number)
  - `urgency` (Number 0..1)
  - `isMoving` (Boolean)
  - `triggerSuccess` (Trigger)
  - `triggerReroute` (Trigger)
  - `triggerOffroute` (Trigger)

### stateNumber mapping
- 0 idle
- 1 searching
- 2 confident
- 3 waiting
- 4 walking
- 5 riding_bus
- 6 riding_subway
- 7 transfer
- 8 warning
- 9 urgent
- 10 panic
- 11 offroute
- 12 rerouting
- 13 success
- 14 late

## Export
- Export `.riv` to:
  - `apps/mobile/assets/animations/timey/timey.riv`

## Runtime Policy
- Rive is intended for onboarding and dedicated mascot surfaces.
- Live transit screen defaults to static mode for performance unless `enableLiveRive` is explicitly enabled.
