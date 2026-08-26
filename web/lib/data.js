function withTeamLogo(row) {
  if (!row) return row;
  return { ...row, logo: row.logo || (row.id ? `org/logos/teams/${row.id}.png` : null) };
}

export async function listTeams(supabase) {
  const query = supabase.from('teams').select('id, name, tag, logo').order('created_at', { ascending: true });
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(withTeamLogo);
}

export async function getTeam(supabase, teamId) {
  const { data, error } = await supabase.from('teams').select('id, name, tag, logo').eq('id', teamId).maybeSingle();
  if (error) throw error;
  return withTeamLogo(data);
}

async function attachProfileFaces(supabase, rows) {
  const list = rows || [];
  const ids = [...new Set(list.map((row) => row.user_id).filter(Boolean))];
  if (!ids.length) return list;
  let profiles = [];
  const withPhoto = await supabase.from('profiles').select('id, avatar_url, photo').in('id', ids);
  if (withPhoto.error) {
    const retry = await supabase.from('profiles').select('id, avatar_url').in('id', ids);
    profiles = retry.data || [];
  } else {
    profiles = withPhoto.data || [];
  }
  const byId = new Map(profiles.map((row) => [row.id, row]));
  return list.map((row) => {
    const linked = row.user_id ? byId.get(row.user_id) : null;
    return {
      ...row,
      photo: row.photo || linked?.photo || null,
      avatar_url: linked?.avatar_url || null,
    };
  });
}

export async function listMembers(supabase, teamId) {
  const { data, error } = await supabase
    .from('members')
    .select('id, gamertag, name, role, slot, title, user_id, photo')
    .eq('team_id', teamId)
    .order('gamertag', { ascending: true });
  if (error) throw error;
  return attachProfileFaces(supabase, data || []);
}

export async function getProfile(supabase, userId) {
  const full = await supabase
    .from('profiles')
    .select('id, discord_username, avatar_url, role, display_name, title, photo')
    .eq('id', userId)
    .maybeSingle();
  if (!full.error) return full.data;
  const { data } = await supabase
    .from('profiles')
    .select('id, discord_username, avatar_url, role, display_name, title')
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
    .select('id, team_id, gamertag, name, role, slot, title, user_id, photo');
  if (error) throw error;
  return attachProfileFaces(supabase, data || []);
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
    id: row.payload?.strategy_id || row.payload?.id || row.id,
    team_id: row.team_id,
    updated_at: row.payload?.updated_at || row.updated_at,
  }));
}

export async function listGuildLinks(supabase) {
  const { data, error } = await supabase.from('discord_guild_links').select('id, guild_id, team_id, enabled');
  if (error) return [];
  return data || [];
}

export async function loadDocBundles(supabase) {
  const [events, tasks, matches, notes, strats, scrims, vods, vetoes, opponents, rankingsDocs, rulesetDocs] =
    await Promise.all([
      listDocs(supabase, 'event').catch(() => []),
      listDocs(supabase, 'task').catch(() => []),
      listDocs(supabase, 'match').catch(() => []),
      listDocs(supabase, 'note').catch(() => []),
      listDocs(supabase, 'strat').catch(() => []),
      listDocs(supabase, 'scrim').catch(() => []),
      listDocs(supabase, 'vod').catch(() => []),
      listDocs(supabase, 'veto').catch(() => []),
      listDocs(supabase, 'opponent').catch(() => []),
      listDocs(supabase, 'rankings').catch(() => []),
      listDocs(supabase, 'ruleset').catch(() => []),
    ]);
  const rankings = rankingsDocs.find((d) => d.id === 'current') || rankingsDocs[0] || { region: '', teams: [] };
  return {
    events,
    tasks,
    matches,
    notes,
    strats,
    scrims,
    vods,
    vetoes,
    opponents,
    rankings,
    rulesetDocs,
  };
}

export async function loadAppData(supabase) {
  const [org, teams, members, docs] = await Promise.all([
    getOrg(supabase).catch(() => null),
    listTeams(supabase).catch(() => []),
    listAllMembers(supabase).catch(() => []),
    loadDocBundles(supabase),
  ]);
  return { org, teams, members, ...docs };
}
