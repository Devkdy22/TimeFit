# Timey Rive Animation Spec (MVP)

## idle
- Duration: `4~6s` loop
- Start: neutral pose, smile neutral, bells resting
- Mid: body `scaleY 1.01`, subtle bell wobble `±2deg`, blink phase
- End: return to start pose
- Easing: cubic in/out, no linear motion
- Loop: yes
- Transition target: default baseline from any non-trigger loop
- Performance caution: keep amplitude low to avoid visual noise

## searching
- Duration: `2~3s` loop
- Start: neutral + slight tilt
- Mid: eyes scan left/right, `questionMark` opacity `0->1->0`, tiny bounce
- End: reset center gaze
- Easing: eased sinusoidal feel
- Loop: yes
- Transition target: can transition to warning/urgent/rerouting/success
- Performance caution: limit eye travel to preserve identity

## warning
- Duration: `1.5~2s` loop
- Start: concerned mouth, slight bell offset
- Mid: sweat appears, tiny shake, bells wobble `±4deg`
- End: sweat fades but not fully removed between loops
- Easing: spring-like softened
- Loop: yes
- Transition target: urgent or back to idle/searching
- Performance caution: keep shake under `2deg` body rotation

## urgent
- Duration: `1~1.5s` loop
- Start: widened eyes, alert icon appears
- Mid: faster bell wobble `±8deg`, squash/stretch pulse, stronger shake
- End: settle to urgent base
- Easing: snappy ease-out then controlled settle
- Loop: yes
- Transition target: success or rerouting/offroute
- Performance caution: strong but not chaotic; avoid nausea-inducing shake

## rerouting
- Duration: `2~3s` loop
- Start: tilt into thinking pose
- Mid: upward/side gaze, question cue pulse, slow bounce
- End: center with mild uncertainty
- Easing: smooth cubic in/out
- Loop: yes
- Transition target: searching/warning/urgent/success
- Performance caution: avoid over-rotating head/body

## success
- Duration: `1.2~1.8s` trigger clip then settle
- Start: trigger enters from current state
- Mid: happy smile + upward bounce + confetti burst + bell bounce
- End: settle to confident idle-like pose
- Easing: fast ease-out on jump, spring settle
- Loop: no (trigger animation), then blend to idle/confident base
- Transition target: idle/confident
- Performance caution: keep confetti short and sparse
