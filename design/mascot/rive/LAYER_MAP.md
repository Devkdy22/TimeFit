# Timey Rive Layer Map

Reference image source of truth: uploaded approved Timey board.

Files:
- `/Users/kimdoyeon/Dev/TimeFit/design/mascot/rive/source/timey-rive-source.svg`
- `/Users/kimdoyeon/Dev/TimeFit/design/mascot/rive/source/timey-rive-clean.svg`

Both files keep the same semantic hierarchy for direct Rive import.

## Required Rive groups
- `bodyShell`
- `bodyDefault`
- `bodyWarning`
- `bodyUrgent`
- `bodyOffroute`
- `faceInset`
- `leftEye`
- `rightEye`
- `mouthNeutral`
- `mouthSmile`
- `mouthWarning`
- `mouthUrgent`
- `mouthOffroute`
- `mouthSurprised`
- `leftArm`
- `rightArm`
- `leftLeg`
- `rightLeg`
- `topButton`
- `groundShadow`
- `thinkingDots`
- `sweatDrop`
- `questionIcon`
- `alertIcon`
- `confetti`

## Group behavior notes
- `bodyDefault/bodyWarning/bodyUrgent/bodyOffroute`: toggle via opacity (one active at a time).
- `mouth*`: toggle via opacity (one active at a time).
- `thinkingDots/sweatDrop/questionIcon/alertIcon/confetti`: default `opacity=0`, animate visibility.
- `leftArm/rightArm`: independent rotation from shoulder area.
- `leftLeg/rightLeg`: independent bounce/rotation.
- `leftEye/rightEye`: blink with scaleY and subtle gaze shift via translateX.
- `topButton`: independent subtle motion.
- `bodyShell`: breathing/bounce parent transform friendly.

## Import checklist
1. Import SVG into Rive.
2. Verify hierarchy names are preserved exactly.
3. Confirm no anonymous names like `Path 1`, `Group 99` at top semantic level.
4. Set default opacities:
- `bodyDefault=1`, others body variants `0`
- `mouthNeutral=1`, others `0`
- icon groups `0`
