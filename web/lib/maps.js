const COVERS = {
  colossus: 'colossus.jpg',
  den: 'den.jpg',
  exposure: 'exposure.jpg',
  fringe: 'fringe.jpg',
  gridlock: 'gridlock.jpg',
  hacienda: 'hacienda.jpg',
  raid: 'raid.jpg',
  sake: 'sake.jpg',
  scar: 'scar.jpg',
};

const LAYOUTS = {
  'colossus-hp': 'colossus-hp.webp',
  'den-hp': 'den-hp.png',
  'den-snd': 'den-snd.png',
  'den-ovl': 'den-ovl.png',
  'exposure-ovl': 'exposure-ovl.webp',
  'gridlock-hp': 'gridlock-hp.png',
  'gridlock-snd': 'gridlock-snd.png',
  'gridlock-ovl': 'gridlock-ovl.png',
  'hacienda-hp': 'hacienda-hp.png',
  'hacienda-snd': 'hacienda-snd.png',
  'hacienda-ovl': 'hacienda-ovl.png',
  'raid-snd': 'raid-snd.png',
  'scar-hp': 'scar-hp.png',
  'scar-ovl': 'scar-ovl.png',
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
