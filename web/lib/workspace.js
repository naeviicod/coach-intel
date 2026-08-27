import { cache } from 'react';
import { canEdit, canEditTeam, canTransferMembers, canManageOrg, resolveAccessRole, scopeTeams } from './access';
import { getOrg, getProfile, listAllMembers, listTeams, loadDocBundles } from './data';
import { sessionIdentity } from './identity';
import { createServerSupabase, getSessionUser } from './supabase/server';
import { rememberDocs, rememberRoster } from './workspace-cache';

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
  const roster = rememberRoster(async () => {
    const [org, teams, members] = await Promise.all([
      getOrg(supabase).catch(() => null),
      listTeams(supabase).catch(() => []),
      listAllMembers(supabase).catch(() => []),
    ]);
    return { org, teams, members };
  });
  const user = await getSessionUser();
  const [bundle, profile] = await Promise.all([
    roster,
    user ? getProfile(supabase, user.id) : null,
  ]);
  return { user, profile, ...bundle };
});

const loadCachedDocs = cache(async (teamId = '', kindsKey = '') => {
  const supabase = await createServerSupabase();
  const kinds = kindsKey ? kindsKey.split(',') : undefined;
  const loader = () => loadDocBundles(supabase, { teamId: teamId || undefined, kinds });
  if (teamId || kindsKey) return loader();
  return rememberDocs(loader);
});

function emptyDocs() {
  return {
    ...EMPTY_DOCS,
    rankings: { region: '', teams: [] },
  };
}

export async function loadWorkspace({ rosterOnly = false, teamId = '', kinds } = {}) {
  const kindsKey = Array.isArray(kinds) && kinds.length ? [...kinds].sort().join(',') : '';
  const [core, docs] = await Promise.all([
    loadRosterCore(),
    rosterOnly ? emptyDocs() : loadCachedDocs(teamId || '', kindsKey),
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
    isOrgAdmin: canManageOrg(role, { local: !profile }),
    teamIds,
    role,
    profile,
    identity,
    canManageTeam: (teamId) => canEditTeam(role, teamId, { local: !profile, teamIds }),
  };
}
