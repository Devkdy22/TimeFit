# Timey 3D Reference Package

## Canonical Source
- SVG canonical asset: `reference.svg`
- PNG reference snapshot: `reference.png`
- In-app canonical renderer: `apps/mobile/src/components/timey/source/TimeyCanonicalSvg.tsx`

## Identity Constraints
- Do not redesign the character.
- Preserve exact silhouette, twin bells, face identity, proportions, mint palette, and friendly TimeFit personality.
- Only convert rendering style to soft 3D.

## Export Pipeline (Recommended)
1. Open dev export screen: `/dev/timey-export`.
2. Choose export dimension: `1024` or `2048`.
3. Keep mascot centered on white background.
4. Capture lossless screenshot and trim to exact square.
5. Save as `reference.png` with transparent-safe workflow in design tool.

### Tooling Options
- A. Web render + browser capture (recommended first)
  - Stable for Expo web and easiest for design handoff.
- B. `react-native-view-shot`
  - App-side capture if we need scripted snapshots later.
- C. Direct SVG export
  - Use `reference.svg` in Figma/Illustrator and export PNG 1024x1024.

## 3D Asset Contract
Required minimum (`apps/mobile/assets/characters/timey/3d/`):
- `idle.png`
- `warning.png`
- `urgent.png`
- `success.png`

Optional:
- `searching.png`
- `rerouting.png`
- `offroute.png`
- `panic.png`

Fallback behavior in app:
- requested 3d state
- -> 3d idle
- -> canonical SVG

## Prompts

### Prompt A (idle)
Create a soft 3D version of this exact mascot.

Do NOT redesign.

Preserve:
- exact silhouette
- twin bells
- face identity
- proportions
- mint color palette
- friendly personality

Convert:
- soft rounded 3D
- clay-like premium app mascot
- subtle shadow
- polished mobile startup mascot quality

transparent background
front view
centered
1024x1024

### Prompt B (warning)
Create a soft 3D warning expression version of this exact mascot.
Use the same silhouette, bells, face proportions, and mint palette base.
Only change facial expression and subtle emotion cues for warning.
No redesign, no iconification, no generic alarm clock.
Transparent background, centered, front view, 1024x1024.

### Prompt C (urgent)
Create a soft 3D urgent expression version of this exact mascot.
Preserve exact identity and structure.
Only increase urgency through expression/posture accents.
No redesign, no stock clock style.
Transparent background, centered, front view, 1024x1024.

### Prompt D (success)
Create a soft 3D success expression version of this exact mascot.
Preserve exact identity and proportions.
Only adjust expression to positive completion/success.
No redesign.
Transparent background, centered, front view, 1024x1024.
