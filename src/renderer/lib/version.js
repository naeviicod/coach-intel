export const VERSION_RULES = [
  { name: 'Major Update', step: '+1', example: '1.0.0 → 2.0.0' },
  { name: 'Minor Update', step: '+0.1', example: '1.0.0 → 1.1.0' },
  { name: 'Mini Update', step: '+0.0.1', example: '1.0.0 → 1.0.1' },
];

export function parseVersion(value) {
  const [major, minor, patch] = String(value || '0.0.0')
    .replace(/^v/i, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  return { major, minor, patch };
}

export function formatVersion({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

export function bumpVersion(value, kind) {
  const next = parseVersion(value);
  if (kind === 'major') return formatVersion({ major: next.major + 1, minor: 0, patch: 0 });
  if (kind === 'minor') return formatVersion({ major: next.major, minor: next.minor + 1, patch: 0 });
  return formatVersion({ major: next.major, minor: next.minor, patch: next.patch + 1 });
}
