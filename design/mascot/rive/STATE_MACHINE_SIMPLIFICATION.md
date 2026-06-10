# Timey Rive State Machine Simplification Recommendation

## Why
- Current contract supports many product states and triggers.
- Overly complex animation graphs increase authoring and QA cost.
- Product reliability is improved when semantic mapping is stable and compact.

## Recommended Shape
- Keep one `TimeyStateMachine` with:
  - `stateNumber` (primary semantic state input)
  - `urgency` (continuous modifier)
  - `isMoving` (motion modifier)
  - enter triggers only for rare emphasis events

## Simplification Rules
- Prioritize `stateNumber` as the single source for state selection.
- Use `urgency` only for intensity/blend tuning, not state branching explosion.
- Keep triggers limited to:
  - `triggerSuccess`
  - `triggerReroute`
  - `triggerOffroute`
- Avoid per-state trigger proliferation.
- Reuse shared loops (idle/breath/blink/sway) across nearby states.

## Suggested Authoring Pattern in Rive
- Base locomotion layer:
  - idle, walking, riding sway
- Face/expression layer:
  - neutral, warning, urgent, panic, success
- Add-on effect layer:
  - sweat/question/alert/confetti driven by state or trigger

## Operational Constraints
- Preserve canonical Timey SVG identity.
- Do not introduce redesign-only layers that break silhouette consistency.
- Keep input names and layer names backward compatible once released.

## QA Focus
- Transition correctness for:
  - `warning <-> urgent` boundary behavior
  - `offroute` and `rerouting` enter emphasis
  - `success` one-shot emphasis
- Ensure no repeated trigger playback when state is unchanged.
