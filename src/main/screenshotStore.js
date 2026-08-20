// Scoreboard screenshot inbox. Files stay on disk, scoped to a team, so the
// OCR / review pipeline has a single place to read from. Incoming boards are
// filed under inbox/YYYY-MM-DD/ from the source folder name (14-08-2026) or
// the file's date.

const fs = require('fs/promises');
const path = require('path');
const { DATA_ROOT, slugify } = require('./dataStore');

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const BUCKETS = ['inbox', 'needs-review'];
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const EU_DATE = /^(\d{2})-(\d{2})-(\d{4})$/;
// Opt-in only — set CCI_SCRIM_SB_DIR to pre-fill the scoreboard picker's
// starting folder on your machine. Unset on every other machine (main.js
// falls back to no default when this path doesn't exist).
const DEFAULT_SCRIM_SB_DIR = process.env.CCI_SCRIM_SB_DIR || null;

function dataRoot() {
  return process.env.CCI_DATA_ROOT || DATA_ROOT;
}

function safeSegment(value, label) {
  const id = String(value ?? '');
  if (!id || id === '.' || id === '..' || /[/\\]/.test(id) || id.startsWith('.')) {
    throw new Error(`Invalid ${label}: ${id}`);
  }
  return id;
}

function teamShotDir(teamId, bucket) {
  if (!BUCKETS.includes(bucket)) throw new Error(`Invalid screenshot bucket: ${bucket}`);
  return path.join(dataRoot(), 'org', 'teams', safeSegment(teamId, 'team id'), 'screenshots', bucket);
}

function extOf(name) {
  return path.extname(String(name || '')).toLowerCase();
}

function looksLikeImage(buf, ext) {
  if (!buf || buf.length < 12) return false;
  if (ext === '.png') return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (ext === '.jpg' || ext === '.jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (ext === '.webp') {
    return buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

function parseDateFolder(name) {
  const iso = String(name || '').match(ISO_DATE);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const eu = String(name || '').match(EU_DATE);
  if (eu) return `${eu[3]}-${eu[2]}-${eu[1]}`;
  return null;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function destName(original) {
  const ext = extOf(original);
  const safeExt = ext === '.jpeg' ? '.jpg' : ext;
  const raw = path.basename(String(original || ''));
  const stem = raw.slice(0, raw.length - path.extname(raw).length);
  const base = slugify(stem).slice(0, 48) || 'scoreboard';
  return `${base}${safeExt}`;
}

function parseShotKey(key) {
  const parts = String(key || '').split(/[/\\]/);
  if (parts.some((p) => !p || p === '.' || p === '..' || p.startsWith('.'))) {
    throw new Error('Invalid screenshot');
  }
  if (parts.length === 1) {
    if (!ALLOWED_EXT.has(extOf(parts[0]))) throw new Error('Invalid screenshot');
    return { date: null, filename: parts[0] };
  }
  if (parts.length === 2 && ISO_DATE.test(parts[0]) && ALLOWED_EXT.has(extOf(parts[1]))) {
    return { date: parts[0], filename: parts[1] };
  }
  throw new Error('Invalid screenshot');
}

async function uniqueName(dir, name) {
  let candidate = name;
  let n = 2;
  while (true) {
    try {
      await fs.access(path.join(dir, candidate));
    } catch (err) {
      if (err.code === 'ENOENT') return candidate;
      throw err;
    }
    const ext = path.extname(name);
    candidate = `${name.slice(0, -ext.length)}-${n}${ext}`;
    n += 1;
  }
}

function recordFor(teamId, bucket, date, filename, stat) {
  const dir = date ? path.join(teamShotDir(teamId, bucket), date) : teamShotDir(teamId, bucket);
  const full = path.join(dir, filename);
  return {
    teamId,
    filename,
    originalName: filename,
    date: date || stat.mtime.toISOString().slice(0, 10),
    bucket,
    addedAt: stat.mtime.toISOString(),
    size: stat.size,
    relative: path.relative(dataRoot(), full),
    key: date ? `${date}/${filename}` : filename,
  };
}

async function writeShot(teamId, originalName, buffer, { date } = {}) {
  const ext = extOf(originalName);
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error(`Unsupported file type: ${ext || 'unknown'}. Use PNG, JPG or WebP.`);
  }
  if (!buffer || !buffer.length) throw new Error('Empty file');
  if (buffer.length > MAX_BYTES) throw new Error('Screenshot is larger than 20 MB');
  if (!looksLikeImage(buffer, ext)) throw new Error('File is not a valid image');

  const day = date || todayDate();
  const dir = path.join(teamShotDir(teamId, 'inbox'), day);
  await fs.mkdir(dir, { recursive: true });
  const filename = await uniqueName(dir, destName(originalName));
  const full = path.join(dir, filename);
  await fs.writeFile(full, buffer);
  const stat = await fs.stat(full);
  return recordFor(teamId, 'inbox', day, filename, stat);
}

async function importTree(teamId, rootPath) {
  const imported = [];
  async function walk(dir, inheritedDate) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') return;
      throw err;
    }
    const dateHere = parseDateFolder(path.basename(dir)) || inheritedDate;
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, dateHere);
        continue;
      }
      if (!ALLOWED_EXT.has(extOf(entry.name))) continue;
      try {
        const buffer = await fs.readFile(full);
        imported.push(await writeShot(teamId, entry.name, buffer, { date: dateHere }));
      } catch {
        // Skip a bad file in a folder so one corrupt shot does not abort the rest.
      }
    }
  }
  const resolved = path.resolve(String(rootPath));
  await walk(resolved, parseDateFolder(path.basename(resolved)));
  return imported;
}

async function importScoreboards(teamId, payload = {}) {
  const imported = [];
  for (const folder of payload.folders || []) {
    imported.push(...await importTree(teamId, folder));
  }
  for (const sourcePath of payload.paths || []) {
    const resolved = path.resolve(String(sourcePath));
    const stat = await fs.stat(resolved);
    if (stat.isDirectory()) {
      imported.push(...await importTree(teamId, resolved));
      continue;
    }
    const buffer = await fs.readFile(resolved);
    const date = parseDateFolder(path.basename(path.dirname(resolved)));
    imported.push(await writeShot(teamId, path.basename(resolved), buffer, { date }));
  }
  for (const file of payload.files || []) {
    const bytes = file.bytes instanceof Uint8Array ? Buffer.from(file.bytes) : Buffer.from(file.bytes || []);
    imported.push(await writeShot(teamId, file.name || 'scoreboard.png', bytes, { date: file.date }));
  }
  return imported;
}

async function collectShots(teamId, bucket, dir, date, items) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = parseDateFolder(entry.name);
      if (nested && !date) await collectShots(teamId, bucket, full, nested, items);
      continue;
    }
    if (!ALLOWED_EXT.has(extOf(entry.name))) continue;
    const stat = await fs.stat(full);
    items.push(recordFor(teamId, bucket, date, entry.name, stat));
  }
}

async function listPending(teamId) {
  const items = [];
  for (const bucket of BUCKETS) {
    await collectShots(teamId, bucket, teamShotDir(teamId, bucket), null, items);
  }
  return items.sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
}

async function deleteScoreboard(teamId, filename, bucket = 'inbox') {
  const { date, filename: name } = parseShotKey(filename);
  const dir = date ? path.join(teamShotDir(teamId, bucket), date) : teamShotDir(teamId, bucket);
  await fs.rm(path.join(dir, name), { force: true });
  return true;
}

module.exports = {
  MAX_BYTES,
  DEFAULT_SCRIM_SB_DIR,
  parseDateFolder,
  importScoreboards,
  listPending,
  deleteScoreboard,
};
