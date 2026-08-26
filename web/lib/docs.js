import { createBrowserSupabase } from './supabase/browser';

export function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'item';
}

export async function saveDoc({ kind, teamId = '', id, payload }) {
  const supabase = createBrowserSupabase();
  const now = new Date().toISOString();
  const row = {
    kind,
    team_id: teamId || '',
    id,
    payload: { ...payload, updated_at: now },
    updated_at: now,
    deleted_at: null,
  };
  const { error } = await supabase.from('shared_docs').upsert(row, { onConflict: 'kind,team_id,id' });
  if (error) throw error;
  return row.payload;
}

export async function saveStrat({ teamId, existing, strat }) {
  const now = new Date().toISOString();
  const id = strat.strategy_id || existing?.strategy_id || existing?.id || newId('strat');
  const versions = [...(existing?.versions || [])];
  const nextVersion = (versions[versions.length - 1]?.version || 0) + 1;
  versions.push({
    version: nextVersion,
    label: strat.versionLabel || `Saved ${now}`,
    player_positions: strat.player_positions || [],
    drawings: strat.drawings || [],
    notes: strat.notes || '',
    piece_scale: strat.piece_scale,
    created_at: now,
  });
  return saveDoc({
    kind: 'strat',
    teamId,
    id,
    payload: {
      ...existing,
      ...strat,
      strategy_id: id,
      team_id: teamId,
      versions,
      created_at: existing?.created_at || now,
    },
  });
}

export async function deleteDoc({ kind, teamId = '', id }) {
  const supabase = createBrowserSupabase();
  const { error } = await supabase
    .from('shared_docs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('kind', kind)
    .eq('team_id', teamId || '')
    .eq('id', id);
  if (error) throw error;
}

export async function saveTeam({ id, name, tag }) {
  const supabase = createBrowserSupabase();
  const row = {
    id: id || slugify(name),
    name: String(name || '').trim() || 'New Team',
    tag: String(tag || '').trim() || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('teams').upsert(row);
  if (error) throw error;
  return row;
}

export async function saveMember(member) {
  const supabase = createBrowserSupabase();
  const slot = member.slot === 'bench' || member.slot === 'staff' ? member.slot : 'starter';
  const row = {
    id: member.id || newId('mem'),
    team_id: member.team_id,
    gamertag: String(member.gamertag || '').trim() || 'Player',
    name: member.name || null,
    role: member.role || 'Flex',
    slot,
    title: member.title || null,
    updated_at: new Date().toISOString(),
  };
  if (member.user_id) row.user_id = member.user_id;
  if (member.photo) row.photo = member.photo;
  if (Array.isArray(member.aliases)) row.aliases = member.aliases;
  if (member.handles && typeof member.handles === 'object') row.handles = member.handles;
  const { error } = await supabase.from('members').upsert(row);
  if (error) throw error;
  return row;
}

export async function updateMyProfile({ displayName, title }) {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase.rpc('update_my_profile', {
    new_name: String(displayName || '').trim(),
    new_title: String(title || '').trim(),
  });
  if (error) throw error;
  if (data && data.ok === false) throw new Error(data.error || 'Could not save profile.');
  return data;
}

const PHOTO_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export async function uploadMyPhoto(file) {
  const supabase = createBrowserSupabase();
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !sessionData?.user?.id) throw new Error('Sign in first.');
  const ext = PHOTO_TYPES[file?.type] || String(file?.name || '').split('.').pop()?.toLowerCase() || '';
  const safeExt = ext === 'jpeg' ? 'jpg' : ext;
  if (!['png', 'jpg', 'webp'].includes(safeExt)) throw new Error('Choose a PNG, JPG, or WebP image.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Keep photos under 5 MB.');
  const key = `org/profiles/${sessionData.user.id}.${safeExt}`;
  const { error: upError } = await supabase.storage.from('org-assets').upload(key, file, {
    contentType: file.type || `image/${safeExt}`,
    upsert: true,
  });
  if (upError) throw upError;
  const { data, error } = await supabase.rpc('update_my_photo', { new_photo: key });
  if (error) throw error;
  if (data && data.ok === false) throw new Error(data.error || 'Could not save photo.');
  return key;
}
