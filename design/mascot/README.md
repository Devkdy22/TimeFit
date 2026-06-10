# Timey Mascot Source Workflow

## Folder Roles
- `design/mascot/blender`: 3D source scenes and modeling files for Timey.
- `design/mascot/rive`: Rive source files and state machine authoring.
- `design/mascot/exports/png`: review renders for design QA.
- `design/mascot/exports/webp`: optimized export candidates before app ingestion.
- `apps/mobile/assets/characters/timey/source`: canonical SVG source.
- `apps/mobile/src/components/timey/source/TimeyCanonicalSvg.tsx`: canonical SVG component renderer.
- `apps/mobile/assets/characters/timey/flat`: optional exported flat PNG targets.
- `apps/mobile/assets/characters/timey/3d`: soft-3D runtime assets derived from canonical SVG.
- `apps/mobile/assets/characters/timey/unused`: deprecated placeholders that must not be used in UI.
- `apps/mobile/assets/animations/timey`: runtime Rive binaries used by React Native.

Never commit source files into `apps/mobile/assets`, and never use runtime assets as design source.

## Export Rules
- Preserve the provided Timey identity; do not redesign silhouette, face, or proportions.
- Keep character canvas tightly cropped and square.
- Avoid oversized textures; mobile target assets only.
- Rive output naming must match the runtime contracts in code.

## Naming Convention
- Static: `timey_<state>.webp`
- Rive animation: `timey_<purpose>.riv`
- Allowed state names: `default`, `happy`, `running`, `warning`, `urgent`, `late`, `success`, `thinking`, `sleep`

## State Meaning
- `default`: 일반 홈 상태
- `happy`: 버퍼 충분 (`bufferMinutes >= 10`)
- `running`: 이동 중
- `warning`: 주의 (`bufferMinutes <= 5 && > 0`)
- `urgent`: 출발 위험 (`bufferMinutes <= 0`)
- `late`: 이미 지연 (`etaDelayMinutes > 0`)
- `success`: 도착 완료
- `thinking`: 경로 재탐색/재계산
- `sleep`: idle/background

## Asset Replacement Guide
1. Update source in `design/mascot/blender` or `design/mascot/rive`.
2. Export review artifacts to `design/mascot/exports/png` and `design/mascot/exports/webp`.
3. After QA, keep canonical source in `source/timey.svg`, update `TimeyCanonicalSvg.tsx`, and export runtime assets into `flat`/`3d`.
4. Keep filenames identical to runtime mapping keys.
5. Verify Home, Route Recommend, and Transit screens on iPhone small/notch and Android small widths.
