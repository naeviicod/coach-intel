import { detectPlatform } from './platform.js';

// Released artifact names are invariant. A signed/notarized DMG cannot be
// personalized by changing its name or contents after release.
export const PLATFORM_META = {
  windows: {
    label: 'Windows',
    installer: 'NSIS installer (.exe)',
    arch: '64-bit (x64)',
    minOS: 'Windows 10 64-bit or later',
  },
  mac: {
    label: 'Mac',
    installer: 'Signed disk image (.dmg)',
    arch: 'Universal: Apple Silicon + Intel',
    minOS: 'macOS 11 or later',
  },
};

// The repo's own configured electron-builder publish target (package.json
// build.publish) — a real, existing URL, not invented.
export const RELEASES_PAGE_URL = 'https://github.com/naeviicod/coach-intel/releases';

export function displayGamerTag(identity) {
  const name = String(identity?.name || '').trim();
  if (!name || name === 'Signed in') return 'Player';
  return name;
}

export function releaseFilename(platform, version) {
  const value = String(version || '').trim();
  if (!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(value)) return null;
  if (platform === 'windows') return `Coach-Intel-Setup-${value}.exe`;
  if (platform === 'mac') return `Coach-Intel-${value}-macOS.dmg`;
  return null;
}

export function releaseDateLabel(publishedAt) {
  if (!publishedAt) return null;
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Resolves everything one platform tile needs to render, from the real
// app_releases row (or null, when there's no release yet or the lookup
// failed — both surface as an honest "unavailable" state, never a fake link).
export function platformDownload(release, platform) {
  const url = (platform === 'windows' ? release?.windows_url : platform === 'mac' ? release?.mac_url : null) || null;
  return {
    platform,
    meta: PLATFORM_META[platform] || null,
    available: Boolean(url),
    url,
    filename: url ? releaseFilename(platform, release?.version) : null,
    version: release?.version || null,
    releaseDate: releaseDateLabel(release?.published_at),
    notes: release?.notes ? String(release.notes).trim() : null,
  };
}

export function recommendedPlatform(userAgent) {
  const detected = detectPlatform(userAgent);
  return detected === 'windows' || detected === 'mac' ? detected : null;
}
