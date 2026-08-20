#!/usr/bin/env node
// One-time backfill: uploads every image already under data/org/{members,logos}
// and data/maps on this machine into the org-assets Supabase Storage bucket
// (scripts/supabase/schema.sql), so a second signed-in machine — a fresh
// install, a teammate's laptop — sees the same photos and logos instead of
// only the path strings that point to them. New uploads sync automatically
// from here on (src/main/main.js); this is only for images that predate that.
//
// Safe to re-run: every upload uses upsert, nothing local is touched.
//
// Needs the service role key, not the publishable one — this bypasses Row
// Level Security for a one-time trusted write. The app itself never uses this
// key; get it from the Supabase dashboard under Settings -> API -> service_role,
// and don't put it anywhere except this one command:
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/supabase/migrate-images.js

const fs = require('fs/promises');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL } = require('../../src/main/supabase/config');

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY (Supabase dashboard -> Settings -> API -> service_role) and re-run:');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=... node scripts/supabase/migrate-images.js');
  process.exit(1);
}

const DATA_ROOT = path.join(__dirname, '..', '..', 'data');
const ORG_DIR = path.join(DATA_ROOT, 'org');
const MAPS_DIR = path.join(DATA_ROOT, 'maps');
const BUCKET = 'org-assets';
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

// Storage keys are always forward-slashed, regardless of the OS walking the
// local tree — the app itself builds these relative-path strings the same way
// (plain template literals, never path.join), so this just matches that.
function toKey(relative) {
  return relative.split(path.sep).join('/');
}

async function walk(dir, base) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.join(base, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full, rel)));
    else if (IMAGE_EXT.has(path.extname(entry.name).toLowerCase())) out.push(rel);
  }
  return out;
}

async function main() {
  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const relatives = [
    ...(await walk(path.join(ORG_DIR, 'members'), path.join('org', 'members'))),
    ...(await walk(path.join(ORG_DIR, 'logos'), path.join('org', 'logos'))),
    ...(await walk(MAPS_DIR, 'maps')),
  ];
  // org/profile-photo.* lives directly under org/, not a subfolder.
  for (const name of await fs.readdir(ORG_DIR).catch(() => [])) {
    if (IMAGE_EXT.has(path.extname(name).toLowerCase())) relatives.push(path.join('org', name));
  }

  if (!relatives.length) {
    console.log('No local images found under data/org or data/maps — nothing to migrate.');
    return;
  }

  let ok = 0;
  let failed = 0;
  for (const relative of relatives) {
    const key = toKey(relative);
    const fullPath = path.join(DATA_ROOT, relative);
    try {
      const buffer = await fs.readFile(fullPath);
      const { error } = await client.storage.from(BUCKET).upload(key, buffer, {
        contentType: MIME[path.extname(fullPath).toLowerCase()] || 'application/octet-stream',
        upsert: true,
      });
      if (error) throw error;
      console.log(`Uploaded ${key}`);
      ok += 1;
    } catch (err) {
      console.error(`Failed ${key}:`, err.message);
      failed += 1;
    }
  }
  console.log(`Done: ${ok} uploaded, ${failed} failed.`);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
