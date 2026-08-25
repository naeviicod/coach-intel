export async function listTeams(supabase) {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, tag, logo, accent')
    .order('created_at', { ascending: true });
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
