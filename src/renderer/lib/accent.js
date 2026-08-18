export const DEFAULT_ACCENT = '#b6f542';

export const ACCENT_PRESETS = [
  { name: 'Intel Lime', hex: '#b6f542' },
  { name: 'Mint', hex: '#5ee0b0' },
  { name: 'Ice', hex: '#7ec8e3' },
  { name: 'Amber', hex: '#e8c15a' },
  { name: 'Coral', hex: '#e87a6a' },
  { name: 'Violet', hex: '#9b8cff' },
  { name: 'White', hex: '#e8ece8' },
];

export function normalizeHex(value) {
  const raw = String(value || '').trim();
  const m = raw.match(/^#?([0-9a-fA-F]{6})$/);
  return m ? `#${m[1].toLowerCase()}` : null;
}

function lighten(hex) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift) => Math.min(255, ((n >> shift) & 255) + 36).toString(16).padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

const BRAND_HSL = hexToHsl(DEFAULT_ACCENT);

function brandTintFilter(hex) {
  const color = normalizeHex(hex) || DEFAULT_ACCENT;
  if (color === DEFAULT_ACCENT) return 'none';
  const t = hexToHsl(color);
  if (t.s < 0.12) return `saturate(0) brightness(${(1 + t.l * 0.35).toFixed(2)})`;
  // Hue-rotate on lime under-saturates most targets into a dusty wash.
  // Hold brightness near 1 and push saturation so the recolor stays solid.
  const rotate = Math.round(t.h - BRAND_HSL.h);
  const sat = Math.min(2.6, Math.max(1.2, (t.s / Math.max(BRAND_HSL.s, 0.2)) * 1.55));
  return `hue-rotate(${rotate}deg) saturate(${sat.toFixed(2)}) brightness(1.05)`;
}

export function resolveAccent({ invite, shared, org, firstLaunch } = {}) {
  const fromInvite = normalizeHex(invite);
  if (firstLaunch && !fromInvite) return DEFAULT_ACCENT;
  return fromInvite || normalizeHex(shared) || normalizeHex(org) || DEFAULT_ACCENT;
}

export function applyAccent(hex) {
  const color = normalizeHex(hex) || DEFAULT_ACCENT;
  const root = document.documentElement;
  root.style.setProperty('--accent', color);
  root.style.setProperty('--accent-bright', lighten(color));
  root.style.setProperty('--accent-dim', `${color}42`);
  root.style.setProperty('--brand-tint', brandTintFilter(color));
  return color;
}
