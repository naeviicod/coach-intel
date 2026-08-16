import { asset } from './assets.js';

export function mapSlug(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function mapImageSrc(name) {
  const id = mapSlug(name);
  return id ? asset(`maps/${id}.jpg`) : null;
}

export function mapImageRel(name, ext, layoutKey) {
  const id = mapSlug(name);
  const safe = String(ext || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = String(layoutKey || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!id || !safe) return null;
  return key ? `maps/${id}-${key}.${safe}` : `maps/${id}.${safe}`;
}

export function modeLayoutKey(mode) {
  const m = String(mode || '').toLowerCase();
  if (m.includes('hardpoint') || m === 'hp') return 'hp';
  if (m.includes('search') || m.includes('destroy') || m === 'snd') return 'snd';
  if (m.includes('overload') || m === 'ovl') return 'ovl';
  return '';
}

async function firstExisting(urls) {
  for (const url of urls) {
    if (!url) continue;
    const hit = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => resolve(null);
      img.src = url;
    });
    if (hit) return hit;
  }
  return null;
}

export async function resolveMapImage(name) {
  const id = mapSlug(name);
  if (!id) return null;
  const data = [];
  if (window.cci?.dataUrlForPath) {
    for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
      data.push(window.cci.dataUrlForPath(`maps/${id}.${ext}`));
    }
  }
  const fromData = (await Promise.all(data)).find(Boolean);
  if (fromData) return fromData;
  return firstExisting([asset(`maps/${id}.jpg`), asset(`maps/${id}.webp`), asset(`maps/${id}.png`)]);
}

export async function resolveMapLayout(name, mode) {
  const id = mapSlug(name);
  const key = modeLayoutKey(mode);
  if (!id) return null;
  if (key && window.cci?.dataUrlForPath) {
    for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
      const url = await window.cci.dataUrlForPath(`maps/${id}-${key}.${ext}`);
      if (url) return url;
    }
    const bundled = await firstExisting([
      asset(`maps/${id}-${key}.jpg`),
      asset(`maps/${id}-${key}.webp`),
      asset(`maps/${id}-${key}.png`),
    ]);
    if (bundled) return bundled;
  }
  return resolveMapImage(name);
}
