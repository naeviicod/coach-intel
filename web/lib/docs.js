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
  const row = {
    id: member.id || newId('mem'),
    team_id: member.team_id,
    gamertag: String(member.gamertag || '').trim() || 'Player',
    name: member.name || null,
    role: member.role || 'Flex',
    slot: member.slot || 'starter',
    title: member.title || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('members').upsert(row);
  if (error) throw error;
  return row;
}
