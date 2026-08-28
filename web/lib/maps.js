const COVERS = {
  colossus: 'colossus.webp',
  den: 'den.webp',
  exposure: 'exposure.webp',
  fringe: 'fringe.webp',
  gridlock: 'gridlock.webp',
  hacienda: 'hacienda.webp',
  raid: 'raid.webp',
  sake: 'sake.webp',
  scar: 'scar.webp',
};

const LAYOUTS = {
  'colossus-hp': 'colossus-hp.webp',
  'den-hp': 'den-hp.webp',
  'den-snd': 'den-snd.webp',
  'den-ovl': 'den-ovl.webp',
  'exposure-ovl': 'exposure-ovl.webp',
  'gridlock-hp': 'gridlock-hp.webp',
  'gridlock-snd': 'gridlock-snd.webp',
  'gridlock-ovl': 'gridlock-ovl.webp',
  'hacienda-hp': 'hacienda-hp.webp',
  'hacienda-snd': 'hacienda-snd.webp',
  'hacienda-ovl': 'hacienda-ovl.webp',
  'raid-snd': 'raid-snd.webp',
  'scar-hp': 'scar-hp.webp',
  'scar-ovl': 'scar-ovl.webp',
};

export function mapSlug(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function modeLayoutKey(mode) {
  const m = String(mode || '').toLowerCase();
  if (m.includes('hardpoint') || m === 'hp') return 'hp';
  if (m.includes('search') || m.includes('destroy') || m === 'snd') return 'snd';
  if (m.includes('overload') || m === 'ovl') return 'ovl';
  return '';
}

function publicSrc(file) {
  return file ? `/assets/maps/${file}` : null;
}

export function mapCoverSrc(name) {
  const id = mapSlug(name);
  if (!id) return null;
  if (COVERS[id]) return publicSrc(COVERS[id]);
  const layout = Object.keys(LAYOUTS).find((key) => key.startsWith(`${id}-`));
  return layout ? publicSrc(LAYOUTS[layout]) : null;
}

export function mapLayoutSrc(name, mode) {
  const id = mapSlug(name);
  const key = modeLayoutKey(mode);
  if (!id) return null;
  if (key && LAYOUTS[`${id}-${key}`]) return publicSrc(LAYOUTS[`${id}-${key}`]);
  return mapCoverSrc(name);
}

export function mapModeArts(name, modes = []) {
  const cover = mapCoverSrc(name);
  return (modes || [])
    .map((mode) => {
      const src = mapLayoutSrc(name, mode);
      if (!src) return null;
      return { mode, src, distinct: src !== cover };
    })
    .filter(Boolean);
}
