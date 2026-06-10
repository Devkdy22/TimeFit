# Timey Rive Rigging Plan

## 1) Pivot / Origin
- `body`: center lower-middle (`512,540`)
- `leftBell`/`rightBell`: each bell hinge base
- `leftArm`/`rightArm`: shoulder joint anchors
- `leftLeg`/`rightLeg`: hip anchors
- `leftEye`/`rightEye`: own center
- `mouth`: center
- `sweat`/`questionMark`/`alertIcon`/`confetti`: independent local pivots

## 2) Deformation Strategy
- body: `scaleY 0.98..1.02` breathing, tiny `translateY`
- bells: rotate `±4..8deg` by state intensity
- eyes: `translateX` scan + `scaleY` blink
- mouth: shape swap or opacity swap by expression state
- arms/legs: tiny rotate/translate accents only
- sweat/question/alert/confetti: opacity + scale + short positional drift

## 3) Bones Policy
- MVP: transform rig only (groups, constraints, keyframes)
- Post-MVP: bones optional for advanced secondary motion
- Reason:
  - lower authoring complexity
  - easier debugging against app input contract
  - reduced risk in first production rollout

## 4) Constraint Notes
- Maintain canonical silhouette and face identity.
- Keep asymmetry intentional but minimal.
- Avoid high-frequency jitter on live surfaces.
