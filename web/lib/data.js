export async function listTeams(supabase) {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, tag, logo')
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
    .select('id, gamertag, name, role, slot, title')
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
