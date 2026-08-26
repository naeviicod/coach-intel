import { cache } from 'react';
import { canEdit, canEditTeam, canTransferMembers, resolveAccessRole, scopeTeams } from './access';
import { getOrg, getProfile, listAllMembers, listTeams, loadDocBundles } from './data';
import { sessionIdentity } from './identity';
import { createServerSupabase, getSessionUser } from './supabase/server';

const EMPTY_DOCS = {
  events: [],
  tasks: [],
  matches: [],
  notes: [],
  strats: [],
  scrims: [],
  vods: [],
  vetoes: [],
  opponents: [],
  rankings: { region: '', teams: [] },
  rulesetDocs: [],
};

export const loadRosterCore = cache(async () => {
  const supabase = await createServerSupabase();
  const user = await getSessionUser();
  const [org, teams, members, profile] = await Promise.all([
    getOrg(supabase).catch(() => null),
    listTeams(supabase).catch(() => []),
    listAllMembers(supabase).catch(() => []),
    user ? getProfile(supabase, user.id) : null,
  ]);
  return { user, org, teams, members, profile };
});

const loadCachedDocs = cache(async () => {
  const supabase = await createServerSupabase();
  return loadDocBundles(supabase);
});

function emptyDocs() {
  return {
    ...EMPTY_DOCS,
    rankings: { region: '', teams: [] },
  };
}

export async function loadWorkspace({ rosterOnly = false } = {}) {
  const [core, docs] = await Promise.all([
    loadRosterCore(),
    rosterOnly ? emptyDocs() : loadCachedDocs(),
  ]);
  const { user, org, teams: allTeams, members, profile } = core;
  const identity = sessionIdentity({ user, profile, members, org });
  const linked = (members || []).filter((row) => user?.id && row.user_id === user.id);
  const teamIds = linked.map((row) => row.team_id).filter(Boolean);
  const role = resolveAccessRole(profile, {
    names: [identity?.name, ...linked.flatMap((row) => [row.gamertag, row.name])],
  });
  const teams = scopeTeams(allTeams, { role, teamIds });
  return {
    org,
    ...docs,
    members,
    teams,
    allTeams,
    canEdit: canEdit(role),
    canTransfer: canTransferMembers(role, { local: !profile }),
    teamIds,
    role,
    profile,
    identity,
    canManageTeam: (teamId) => canEditTeam(role, teamId, { local: !profile, teamIds }),
  };
}
