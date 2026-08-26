export const DEFAULT_BACKGROUND = 'pit';
const ART_CACHE = '20260821-1k';

export const BACKGROUND_OPTIONS = [
  { id: 'pit', name: 'Pit', src: null, zoom: 1, hint: 'Soft honeycomb wash in the gutters' },
  { id: 'hex', name: 'Hex', src: 'backgrounds/hex.png', zoom: 1.08, hint: 'Hex grid and topography' },
  { id: 'lattice', name: 'Lattice', src: 'backgrounds/lattice.png', zoom: 1.32, hint: 'Crystal lattice on the sides' },
  { id: 'sector', name: 'Sector', src: 'backgrounds/sector.png', zoom: 1.16, hint: 'Honeycomb command perimeter' },
  { id: 'focus', name: 'Focus', src: 'backgrounds/focus.png', zoom: 1.14, hint: 'Angular formation around a quiet center' },
  { id: 'command-ring', name: 'Command Ring', src: 'backgrounds/command-ring.png', zoom: 1.16, hint: 'Tactical rings and a quiet center' },
  { id: 'blackout', name: 'Blackout', src: 'backgrounds/blackout.png', zoom: 1.14, hint: 'Dark steel with lime edge light' },
  { id: 'prism', name: 'Prism', src: 'backgrounds/prism.png', zoom: 1.2, hint: 'Symmetric crystal formation' },
  { id: 'vector', name: 'Vector', src: 'backgrounds/vector.png', zoom: 1.14, hint: 'Diagonal tactical vectors' },
  { id: 'strata', name: 'Strata', src: 'backgrounds/strata.png', zoom: 1.12, hint: 'Layered smoke and scan lines' },
  { id: 'hex-front', name: 'Hex Front', src: 'backgrounds/hex-front.png', zoom: 1.16, hint: 'Luminous hexagonal perimeter' },
  { id: 'orbit', name: 'Orbit', src: 'backgrounds/orbit.png', zoom: 1.14, hint: 'Network constellation frame' },
];

export function resolveBackground(id) {
  const raw = String(id || '').trim();
  if (raw === 'frame') return 'hex';
  return BACKGROUND_OPTIONS.some((opt) => opt.id === raw) ? raw : DEFAULT_BACKGROUND;
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
