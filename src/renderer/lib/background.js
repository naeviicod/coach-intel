import { asset } from './assets.js';

export const DEFAULT_BACKGROUND = 'pit';
const ART_CACHE = '20260820-2k';

// `zoom` scales the art inside the viewport. Both wallpapers are frame art —
// bright edges around a deliberately empty middle — so at 1:1 a wide window
// leaves a large dead centre. Pushing them past the frame makes the lit
// structure read across the page instead of hugging the corners.
export const BACKGROUND_OPTIONS = [
  { id: 'pit', name: 'Pit', src: null, zoom: 1, hint: 'Soft honeycomb wash in the gutters' },
  { id: 'hex', name: 'Hex', src: 'backgrounds/hex.png', zoom: 1.08, hint: 'Hex grid and topography' },
  { id: 'lattice', name: 'Lattice', src: 'backgrounds/lattice.png', zoom: 1.32, hint: 'Crystal lattice on the sides' },
];

export function resolveBackground(id) {
  const raw = String(id || '').trim();
  if (raw === 'frame') return 'hex';
  return BACKGROUND_OPTIONS.some((opt) => opt.id === raw) ? raw : DEFAULT_BACKGROUND;
}

export function backgroundOption(id) {
  const resolved = resolveBackground(id);
  return BACKGROUND_OPTIONS.find((opt) => opt.id === resolved);
}

export function backgroundUrl(src) {
  return `${asset(src)}?v=${ART_CACHE}`;
}

// Decode the wallpaper while the splash is still up. Without this the art pops
// in a frame or two after the splash clears, which is the flash the crossfade
// is meant to remove.
export function preloadBackground(id) {
  const option = backgroundOption(id);
  if (!option.src || typeof Image === 'undefined') return Promise.resolve(option.id);
  return new Promise((resolve) => {
    const img = new Image();
    const done = () => resolve(option.id);
    img.onload = () => (img.decode ? img.decode().then(done, done) : done());
    img.onerror = done;
    img.src = backgroundUrl(option.src);
  });
}

export function applyBackground(id) {
  const option = backgroundOption(id);
  const atmosphere = typeof document === 'undefined' ? null : document.getElementById('atmosphere');
  if (!atmosphere) return option.id;
  atmosphere.dataset.background = option.id;
  atmosphere.classList.toggle('art-bg', Boolean(option.src));
  atmosphere.style.setProperty('--art-zoom', String(option.zoom || 1));
  const art = atmosphere.querySelector('.arena-art');
  const img = atmosphere.querySelector('.arena-art-img');
  if (img) {
    if (option.src) img.src = backgroundUrl(option.src);
    else img.removeAttribute('src');
  }
  if (art && !img) art.style.backgroundImage = option.src ? `url("${backgroundUrl(option.src)}")` : '';
  return option.id;
}
