import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const ROOT = fs.existsSync(path.join(cwd, 'apps/mobile')) ? cwd : path.resolve(__dirname, '..');

const canonicalSvg = path.join(ROOT, 'apps/mobile/assets/characters/timey/source/timey.svg');
const riveReadySvg = path.join(ROOT, 'design/mascot/rive/source/timey-rive-ready.svg');
const layerMapDoc = path.join(ROOT, 'design/mascot/rive/LAYER_MAP.md');
const riggingPlanDoc = path.join(ROOT, 'design/mascot/rive/RIGGING_PLAN.md');
const animationSpecDoc = path.join(ROOT, 'design/mascot/rive/ANIMATION_SPEC.md');
const contractDoc = path.join(ROOT, 'design/mascot/rive/STATE_MACHINE_CONTRACT.md');
const editorGuideDoc = path.join(ROOT, 'design/mascot/rive/RIVE_EDITOR_GUIDE.md');
const appQaDoc = path.join(ROOT, 'design/mascot/rive/APP_QA_CHECKLIST.md');
const riveFile = path.join(ROOT, 'apps/mobile/assets/animations/timey/timey_state_machine.riv');
const threeDDir = path.join(ROOT, 'apps/mobile/assets/characters/timey/3d');
const unusedDir = path.join(ROOT, 'apps/mobile/assets/characters/timey/unused');
const base2DAsset = path.join(threeDDir, 'timey-base-v5-mouth-large.png');

const required3D = ['timey-warning-v1.png', 'timey-walking-v1.png', 'timey-success-v1.png'];
const production3DAssets = ['timey-base-v5-mouth-large.png', ...required3D];
const production3DBudgetBytes = 2 * 1024 * 1024;
const maximum3DImageDimension = 1536;
const minimumRiveBytes = 128;

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

function hasEntries(p: string) {
  try {
    return fs.readdirSync(p).length > 0;
  } catch {
    return false;
  }
}

function readPngDimensions(p: string): { width: number; height: number } | null {
  try {
    const buffer = fs.readFileSync(p);
    const isPng = buffer.length >= 24 && buffer.readUInt32BE(0) === 0x89504e47 && buffer.readUInt32BE(4) === 0x0d0a1a0a;
    if (!isPng) return null;
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  } catch {
    return null;
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
    if (bytes < minimumRiveBytes) {
      print(`RIVE INVALID: ${riveFile} (${bytes} bytes; minimum ${minimumRiveBytes})`);
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
    print('3D STATE ASSETS READY');
  }

  const base2DBytes = sizeOf(base2DAsset);
  print(`2.5D BASE: ${base2DBytes > 128 ? 'READY' : 'MISSING'} (${base2DAsset})`);
  const production3DBytes = production3DAssets.reduce((total, file) => total + sizeOf(path.join(threeDDir, file)), 0);
  const budgetStatus = production3DBytes <= production3DBudgetBytes ? 'PASS' : 'WARN';
  print(`2.5D BUNDLE BUDGET: ${budgetStatus} (${production3DBytes} / ${production3DBudgetBytes} bytes)`);

  const invalid3DImages = production3DAssets.filter((file) => {
    const dimensions = readPngDimensions(path.join(threeDDir, file));
    return !dimensions || dimensions.width > maximum3DImageDimension || dimensions.height > maximum3DImageDimension;
  });
  print(
    invalid3DImages.length === 0
      ? `2.5D IMAGE QUALITY: PASS (PNG, max ${maximum3DImageDimension}px)`
      : `2.5D IMAGE QUALITY: WARN (${invalid3DImages.join(', ')})`,
  );

  const deprecatedPaths = [
    path.join(ROOT, 'apps/mobile/assets/characters/timey/original'),
    path.join(ROOT, 'apps/mobile/assets/characters/timey/webp'),
  ];

  const deprecatedInUse = deprecatedPaths.filter((p) => hasEntries(p));
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
  const riveReady = exists(riveFile) && sizeOf(riveFile) >= minimumRiveBytes;
  const handoffReady = handoffDocsReady && fallbackOk;
  print(`RIVE_HANDOFF_READY: ${handoffReady ? 'true' : 'false'}`);
  print(`RIVE_RUNTIME_READY: ${riveReady ? 'true' : 'false'}`);
}

validate();
