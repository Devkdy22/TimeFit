import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../../..');
const mobileRoot = path.join(repoRoot, 'apps/mobile');

function collectFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  const entries = readdirSync(root);
  const files: string[] = [];
  for (const entry of entries) {
    const current = path.join(root, entry);
    const stat = statSync(current);
    if (stat.isDirectory()) {
      if (['node_modules', '.expo', '.turbo', 'android', 'ios'].includes(entry)) {
        continue;
      }
      files.push(...collectFiles(current));
      continue;
    }
    if (/\.(ts|tsx|js|jsx|json|md|example)$/.test(entry) || entry === '.env.example') {
      files.push(current);
    }
  }
  return files;
}

function readFiles(files: string[]): string {
  return files.map((file) => readFileSync(file, 'utf8')).join('\n');
}

describe('mobile external API boundary', () => {
  it('does not expose server-only provider keys through mobile public env names', () => {
    const mobileText = readFiles([
      path.join(mobileRoot, '.env.example'),
      ...collectFiles(path.join(mobileRoot, 'src')),
      ...collectFiles(path.join(mobileRoot, 'app')),
      ...collectFiles(path.join(mobileRoot, 'docs')),
    ]);

    expect(mobileText).not.toContain('EXPO_PUBLIC_ODSAY_API_KEY');
    expect(mobileText).not.toContain('EXPO_PUBLIC_KAKAO_REST_API_KEY');
    expect(mobileText).not.toContain('EXPO_PUBLIC_SEOUL_BUS_API_KEY');
    expect(mobileText).not.toContain('EXPO_PUBLIC_DATA_API_KEY');
  });

  it('keeps server-only provider hosts out of mobile source', () => {
    const mobileSource = readFiles([
      ...collectFiles(path.join(mobileRoot, 'src')),
      ...collectFiles(path.join(mobileRoot, 'app')),
    ]);

    expect(mobileSource).not.toContain('api.odsay.com');
    expect(mobileSource).not.toContain('apis-navi.kakaomobility.com');
    expect(mobileSource).not.toContain('apis.data.go.kr');
    expect(mobileSource).not.toContain('ws.bus.go.kr');
  });
});
