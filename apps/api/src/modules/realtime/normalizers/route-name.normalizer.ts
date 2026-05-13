export function normalizeRouteName(raw: string | undefined): string {
  if (!raw) {
    return '';
  }

  return raw
    .trim()
    .replace(/\s+/g, '')
    .replace(/(번|버스)$/g, '')
    .toLowerCase();
}

