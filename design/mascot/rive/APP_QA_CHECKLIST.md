# Timey Rive App QA Checklist

## Asset/Contract Integrity
- [ ] `timey.riv` file exists at `/Users/kimdoyeon/Dev/TimeFit/apps/mobile/assets/animations/timey/timey.riv`
- [ ] File is not 0-byte
- [ ] State machine name is exactly `TimeyStateMachine`
- [ ] Input names exactly match:
  - `stateNumber`
  - `urgency`
  - `isMoving`
  - `triggerSuccess`
  - `triggerReroute`
  - `triggerOffroute`

## MVP State Validation
- [ ] `stateNumber=0` idle works
- [ ] `stateNumber=1` searching works
- [ ] `stateNumber=8` warning works
- [ ] `stateNumber=9` urgent works
- [ ] `stateNumber=12` rerouting works
- [ ] `stateNumber=13` success works

## Trigger Behavior
- [ ] `triggerSuccess` fires once on enter
- [ ] `triggerReroute` fires once on enter
- [ ] `triggerOffroute` fires once on enter
- [ ] No repeated trigger playback when state unchanged

## Runtime Fallback / Accessibility
- [ ] `enableRive=true` shows Rive on Home/Preview where allowed
- [ ] Reduce Motion enabled -> static fallback
- [ ] Missing Rive library/file -> no crash, static fallback

## Performance
- [ ] Transit live screen remains static by default (`enableLiveRive=false`)
- [ ] Low-end Android shows no unacceptable frame drop
