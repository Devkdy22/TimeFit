# Rive Editor Guide (Step-by-Step)

1. Create a new Rive file.
2. Import `/Users/kimdoyeon/Dev/TimeFit/design/mascot/rive/source/timey-rive-ready.svg`.
3. Verify imported group names against `LAYER_MAP.md`.
4. Set artboard to `1024 x 1024`.
5. Configure pivots as specified in `RIGGING_PLAN.md`.
6. Create `idle` loop animation.
7. Create `searching` loop animation.
8. Create `warning` loop animation.
9. Create `urgent` loop animation.
10. Create `rerouting` loop animation.
11. Create `success` trigger animation (one-shot then settle).
12. Create state machine named `TimeyStateMachine`.
13. Add inputs: `stateNumber`, `urgency`, `isMoving`, `triggerSuccess`, `triggerReroute`, `triggerOffroute`.
14. Wire transitions per `STATE_MACHINE_CONTRACT.md`.
15. Use input test panel in Rive:
- check `stateNumber` values `0,1,8,9,12,13`
- fire each trigger once and verify one-shot behavior
16. Export to:
- `/Users/kimdoyeon/Dev/TimeFit/apps/mobile/assets/animations/timey/timey.riv`
