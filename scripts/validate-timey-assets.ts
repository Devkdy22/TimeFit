import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

const canonicalSvg = path.join(ROOT, 'apps/mobile/assets/characters/timey/source/timey.svg');
const riveReadySvg = path.join(ROOT, 'design/mascot/rive/source/timey-rive-ready.svg');
const layerMapDoc = path.join(ROOT, 'design/mascot/rive/LAYER_MAP.md');
const riggingPlanDoc = path.join(ROOT, 'design/mascot/rive/RIGGING_PLAN.md');
const animationSpecDoc = path.join(ROOT, 'design/mascot/rive/ANIMATION_SPEC.md');
const contractDoc = path.join(ROOT, 'design/mascot/rive/STATE_MACHINE_CONTRACT.md');
const editorGuideDoc = path.join(ROOT, 'design/mascot/rive/RIVE_EDITOR_GUIDE.md');
const appQaDoc = path.join(ROOT, 'design/mascot/rive/APP_QA_CHECKLIST.md');
const riveFile = path.join(ROOT, 'apps/mobile/assets/animations/timey/timey.riv');
const threeDDir = path.join(ROOT, 'apps/mobile/assets/characters/timey/3d');
const unusedDir = path.join(ROOT, 'apps/mobile/assets/characters/timey/unused');

const required3D = ['idle.png', 'warning.png', 'urgent.png', 'success.png'];

function exists(p: string) {
  return fs.existsSync(p);
}

function sizeOf(p: string) {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

function print(line: string) {
  // eslint-disable-next-line no-console
  console.log(line);
}

function validate() {
  print(`SVG READY: ${exists(canonicalSvg) ? 'YES' : 'NO'} (${canonicalSvg})`);
  print(`RIVE READY SVG: ${exists(riveReadySvg) ? 'YES' : 'NO'} (${riveReadySvg})`);
  print(`DOC LAYER_MAP: ${exists(layerMapDoc) ? 'YES' : 'NO'} (${layerMapDoc})`);
  print(`DOC RIGGING_PLAN: ${exists(riggingPlanDoc) ? 'YES' : 'NO'} (${riggingPlanDoc})`);
  print(`DOC ANIMATION_SPEC: ${exists(animationSpecDoc) ? 'YES' : 'NO'} (${animationSpecDoc})`);
  print(`DOC STATE_MACHINE_CONTRACT: ${exists(contractDoc) ? 'YES' : 'NO'} (${contractDoc})`);
  print(`DOC RIVE_EDITOR_GUIDE: ${exists(editorGuideDoc) ? 'YES' : 'NO'} (${editorGuideDoc})`);
  print(`DOC APP_QA_CHECKLIST: ${exists(appQaDoc) ? 'YES' : 'NO'} (${appQaDoc})`);

  if (!exists(riveFile)) {
    print(`RIVE MISSING: ${riveFile}`);
  } else {
    const bytes = sizeOf(riveFile);
    if (bytes === 0) {
      print(`RIVE EMPTY: ${riveFile} (0 bytes)`);
    } else {
      print(`RIVE READY: ${riveFile} (${bytes} bytes)`);
    }
  }

  const missing3D: string[] = [];
  const placeholder3D: string[] = [];

  for (const file of required3D) {
    const p = path.join(threeDDir, file);
    if (!exists(p)) {
      missing3D.push(file);
      continue;
    }
    const bytes = sizeOf(p);
    if (bytes <= 128) {
      placeholder3D.push(file);
    }
  }

  if (missing3D.length > 0) {
    print(`3D MISSING: ${missing3D.join(', ')}`);
  }

  if (placeholder3D.length > 0) {
    print(`3D PLACEHOLDER: ${placeholder3D.join(', ')}`);
  } else if (missing3D.length === 0) {
    print('3D READY');
  }

  const deprecatedPaths = [
    path.join(ROOT, 'apps/mobile/assets/characters/timey/original'),
    path.join(ROOT, 'apps/mobile/assets/characters/timey/webp'),
  ];

  const deprecatedInUse = deprecatedPaths.filter((p) => exists(p));
  if (deprecatedInUse.length > 0) {
    print(`DEPRECATED PLACEHOLDER PATH PRESENT: ${deprecatedInUse.join(', ')}`);
  }

  const fallbackOk = exists(canonicalSvg);
  print(`FALLBACK OK: ${fallbackOk ? 'YES' : 'NO'} (requested 3d -> 3d idle -> canonical SVG)`);
  print(`UNUSED DIR: ${exists(unusedDir) ? 'YES' : 'NO'} (${unusedDir})`);

  const handoffDocsReady =
    exists(riveReadySvg) &&
    exists(layerMapDoc) &&
    exists(riggingPlanDoc) &&
    exists(animationSpecDoc) &&
    exists(contractDoc) &&
    exists(editorGuideDoc) &&
    exists(appQaDoc);
  const riveReady = exists(riveFile) && sizeOf(riveFile) > 0;
  const handoffReady = handoffDocsReady && fallbackOk;
  print(`RIVE_HANDOFF_READY: ${handoffReady ? 'true' : 'false'}`);
  print(`RIVE_RUNTIME_READY: ${riveReady ? 'true' : 'false'}`);
}

validate();
