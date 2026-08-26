import { createBrowserSupabase } from './supabase/browser';

function isFolder(entry) {
  return !entry?.metadata && !/\.(png|jpe?g|webp)$/i.test(entry?.name || '');
}

export function scoreboardAssetUrl(path) {
  return `/api/assets/${String(path || '').split('/').map(encodeURIComponent).join('/')}`;
}

export async function deleteScoreboard(path) {
  if (!path) throw new Error('Missing scoreboard path.');
  const supabase = createBrowserSupabase();
  const { error } = await supabase.storage.from('org-assets').remove([path]);
  if (error) throw error;
}

export async function readScoreboardText(imageUrl) {
  if (!imageUrl) return '';
  try {
    const blob = await fetch(imageUrl).then((res) => {
      if (!res.ok) throw new Error('Could not open that scoreboard.');
      return res.blob();
    });
    if (typeof TextDetector === 'function') {
      const bitmap = await createImageBitmap(blob);
      const hits = await new TextDetector().detect(bitmap);
      const text = (hits || []).map((hit) => hit.rawValue).filter(Boolean).join('\n');
      if (text.trim()) return text;
    }
    const { recognize } = await import('tesseract.js');
    const result = await recognize(blob, 'eng');
    return String(result?.data?.text || '').trim();
  } catch {
    // Fall through to paste if the board cannot be read.
  }
  return '';
}

export async function listScoreboardInbox(teamId) {
  if (!teamId) return [];
  const supabase = createBrowserSupabase();
  const { data: top, error } = await supabase.storage.from('org-assets').list(`scoreboards/${teamId}`, { limit: 100 });
  if (error) return [];
  const out = [];
  for (const entry of top || []) {
    if (!entry?.name || entry.name.startsWith('.')) continue;
    if (isFolder(entry)) {
      const prefix = `scoreboards/${teamId}/${entry.name}`;
      const { data: files } = await supabase.storage.from('org-assets').list(prefix, { limit: 100 });
      for (const file of files || []) {
        if (!file?.name || file.name.startsWith('.')) continue;
        if (isFolder(file)) continue;
        out.push({
          name: file.name,
          date: entry.name,
          path: `${prefix}/${file.name}`,
          updated_at: file.updated_at || entry.updated_at,
        });
      }
      continue;
    }
    out.push({
      name: entry.name,
      date: String(entry.updated_at || '').slice(0, 10),
      path: `scoreboards/${teamId}/${entry.name}`,
      updated_at: entry.updated_at,
    });
  }
  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.name).localeCompare(String(a.name)));
}

export async function uploadScoreboards(teamId, files) {
  const supabase = createBrowserSupabase();
  const date = new Date().toISOString().slice(0, 10);
  const uploaded = [];
  for (const file of files) {
    const path = `scoreboards/${teamId}/${date}/${file.name}`;
    const { error } = await supabase.storage.from('org-assets').upload(path, file, { upsert: true });
    if (error) throw error;
    uploaded.push({ name: file.name, date, path, updated_at: new Date().toISOString() });
  }
  return uploaded;
}
