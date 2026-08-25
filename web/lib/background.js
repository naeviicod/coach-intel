export const DEFAULT_BACKGROUND = 'pit';
const ART_CACHE = '20260821-1k';

export const BACKGROUND_OPTIONS = [
  { id: 'pit', name: 'Pit', src: null, zoom: 1 },
  { id: 'hex', name: 'Hex', src: 'backgrounds/hex.png', zoom: 1.08 },
  { id: 'lattice', name: 'Lattice', src: 'backgrounds/lattice.png', zoom: 1.32 },
  { id: 'sector', name: 'Sector', src: 'backgrounds/sector.png', zoom: 1.16 },
  { id: 'focus', name: 'Focus', src: 'backgrounds/focus.png', zoom: 1.14 },
  { id: 'command-ring', name: 'Command Ring', src: 'backgrounds/command-ring.png', zoom: 1.16 },
  { id: 'blackout', name: 'Blackout', src: 'backgrounds/blackout.png', zoom: 1.14 },
  { id: 'prism', name: 'Prism', src: 'backgrounds/prism.png', zoom: 1.2 },
  { id: 'vector', name: 'Vector', src: 'backgrounds/vector.png', zoom: 1.14 },
  { id: 'strata', name: 'Strata', src: 'backgrounds/strata.png', zoom: 1.12 },
  { id: 'hex-front', name: 'Hex Front', src: 'backgrounds/hex-front.png', zoom: 1.16 },
  { id: 'orbit', name: 'Orbit', src: 'backgrounds/orbit.png', zoom: 1.14 },
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
