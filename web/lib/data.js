export async function listTeams(supabase) {
  const query = supabase.from('teams').select('id, name, tag, logo').order('created_at', { ascending: true });
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getTeam(supabase, teamId) {
  const { data, error } = await supabase.from('teams').select('id, name, tag, logo').eq('id', teamId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listMembers(supabase, teamId) {
  const { data, error } = await supabase
    .from('members')
    .select('id, gamertag, name, role, slot, title, user_id')
    .eq('team_id', teamId)
    .order('gamertag', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getProfile(supabase, userId) {
  const { data } = await supabase
    .from('profiles')
    .select('id, discord_username, avatar_url, role')
    .eq('id', userId)
    .maybeSingle();
  return data;
}

export async function ensureProfile(supabase) {
  await supabase.rpc('ensure_profile');
}

export async function listAllMembers(supabase) {
  const { data, error } = await supabase
    .from('members')
    .select('id, team_id, gamertag, name, role, slot, title, user_id');
  if (error) throw error;
  return data || [];
}

export async function getOrg(supabase) {
  const { data } = await supabase
    .from('shared_docs')
    .select('payload')
    .eq('kind', 'org')
    .eq('id', 'profile')
    .is('deleted_at', null)
    .maybeSingle();
  return data?.payload && typeof data.payload === 'object' ? data.payload : null;
}

export async function listDocs(supabase, kind) {
  const { data, error } = await supabase
    .from('shared_docs')
    .select('id, team_id, payload, updated_at')
    .eq('kind', kind)
    .is('deleted_at', null);
  if (error) throw error;
  return (data || []).map((row) => ({
    ...(row.payload && typeof row.payload === 'object' ? row.payload : {}),
    id: row.payload?.id || row.id,
    team_id: row.team_id,
    updated_at: row.payload?.updated_at || row.updated_at,
  }));
}

export async function loadAppData(supabase) {
  const [org, teams, members, events, tasks, matches] = await Promise.all([
    getOrg(supabase).catch(() => null),
    listTeams(supabase).catch(() => []),
    listAllMembers(supabase).catch(() => []),
    listDocs(supabase, 'event').catch(() => []),
    listDocs(supabase, 'task').catch(() => []),
    listDocs(supabase, 'match').catch(() => []),
  ]);
  return { org, teams, members, events, tasks, matches };
}
