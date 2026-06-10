# Timey State Machine Contract

## State Machine
- Name: `TimeyStateMachine`
- Export path: `/Users/kimdoyeon/Dev/TimeFit/apps/mobile/assets/animations/timey/timey.riv`

## Inputs (must match app code exactly)
1. `stateNumber` (Number)
2. `urgency` (Number, `0..1`)
3. `isMoving` (Boolean)
4. `triggerSuccess` (Trigger)
5. `triggerReroute` (Trigger)
6. `triggerOffroute` (Trigger)

## stateNumber Mapping
- `0` idle
- `1` searching
- `2` confident
- `3` waiting
- `4` walking
- `5` riding_bus
- `6` riding_subway
- `7` transfer
- `8` warning
- `9` urgent
- `10` panic
- `11` offroute
- `12` rerouting
- `13` success
- `14` late

## MVP Mapping Subset
- idle -> `0`
- searching -> `1`
- warning -> `8`
- urgent -> `9`
- rerouting -> `12`
- success -> `13`

## Transition Rules
- Any -> success when `triggerSuccess` fires
- Any -> rerouting when `triggerReroute` fires
- Any -> offroute when `triggerOffroute` fires
- `stateNumber` controls base loop selection
- `urgency` modulates warning/urgent intensity only
- `isMoving` adds subtle body motion only

## Integration Guardrails
- Input names are contract-level and cannot be renamed without app change.
- Trigger inputs are enter-only from app side; repeated same-state trigger spam is blocked.
