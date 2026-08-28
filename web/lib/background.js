export const DEFAULT_BACKGROUND = 'orbit';
export const SPLASH_BACKGROUND = 'orbit';
const ART_CACHE = '20260821-1k';

export const BACKGROUND_OPTIONS = [
  { id: 'pit', name: 'Pit', src: null, zoom: 1, hint: 'Soft honeycomb wash in the gutters' },
  { id: 'hex', name: 'Hex', src: 'backgrounds/hex.webp', zoom: 1.08, hint: 'Hex grid and topography' },
  { id: 'focus', name: 'Focus', src: 'backgrounds/focus.webp', zoom: 1.14, hint: 'Angular formation around a quiet center' },
  { id: 'command-ring', name: 'Command Ring', src: 'backgrounds/command-ring.webp', zoom: 1.16, hint: 'Tactical rings and a quiet center' },
  { id: 'blackout', name: 'Blackout', src: 'backgrounds/blackout.webp', zoom: 1.14, hint: 'Dark steel with lime edge light' },
  { id: 'prism', name: 'Prism', src: 'backgrounds/prism.webp', zoom: 1.2, hint: 'Symmetric crystal formation' },
  { id: 'vector', name: 'Vector', src: 'backgrounds/vector.webp', zoom: 1.14, hint: 'Diagonal tactical vectors' },
  { id: 'strata', name: 'Strata', src: 'backgrounds/strata.webp', zoom: 1.12, hint: 'Layered smoke and scan lines' },
  { id: 'hex-front', name: 'Hex Front', src: 'backgrounds/hex-front.webp', zoom: 1.16, hint: 'Luminous hexagonal perimeter' },
  { id: 'orbit', name: 'Orbit', src: 'backgrounds/orbit.webp', zoom: 1.14, hint: 'Network constellation frame' },
];

const BACKGROUND_ALIASES = { frame: 'hex', lattice: 'hex', sector: 'hex' };

export function resolveBackground(id) {
  const raw = String(id || '').trim();
  const mapped = BACKGROUND_ALIASES[raw] || raw;
  return BACKGROUND_OPTIONS.some((opt) => opt.id === mapped) ? mapped : DEFAULT_BACKGROUND;
}

export function backgroundOption(id) {
  const resolved = resolveBackground(id);
  return BACKGROUND_OPTIONS.find((option) => option.id === resolved);
}

export function nextBackground(id) {
  const current = resolveBackground(id);
  const index = BACKGROUND_OPTIONS.findIndex((option) => option.id === current);
  return BACKGROUND_OPTIONS[(index + 1) % BACKGROUND_OPTIONS.length].id;
}

export function backgroundUrl(src) {
  return `/assets/${String(src || '').replace(/^\/+/, '').replace(/^assets\//, '')}?v=${ART_CACHE}`;
}

export function applyBackground(id) {
  const option = backgroundOption(id);
  const atmosphere = typeof document === 'undefined' ? null : document.getElementById('atmosphere');
  if (!atmosphere) return option.id;
  atmosphere.dataset.background = option.id;
  atmosphere.classList.toggle('art-bg', Boolean(option.src));
  atmosphere.style.setProperty('--art-zoom', String(option.zoom || 1));
  const img = atmosphere.querySelector('.arena-art-img');
  if (img) {
    if (option.src) img.src = backgroundUrl(option.src);
    else img.removeAttribute('src');
  }
  return option.id;
}
