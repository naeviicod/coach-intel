import { canEdit, canEditTeam, canTransferMembers, resolveAccessRole, scopeTeams } from './access';
import { getProfile, loadAppData } from './data';
import { sessionIdentity } from './identity';
import { createServerSupabase, getSessionUser } from './supabase/server';

export async function loadWorkspace() {
  const supabase = await createServerSupabase();
  const user = await getSessionUser();
  const [data, profile] = await Promise.all([
    loadAppData(supabase),
    user ? getProfile(supabase, user.id) : null,
  ]);
  const identity = sessionIdentity({ user, profile, members: data.members, org: data.org });
  const linked = (data.members || []).filter((row) => user?.id && row.user_id === user.id);
  const teamIds = linked.map((row) => row.team_id).filter(Boolean);
  const role = resolveAccessRole(profile, {
    names: [identity?.name, ...linked.flatMap((row) => [row.gamertag, row.name])],
  });
  const teams = scopeTeams(data.teams, { role, teamIds });
  return {
    ...data,
    teams,
    canEdit: canEdit(role),
    canTransfer: canTransferMembers(role, { local: !profile }),
    teamIds,
    role,
    profile,
    identity,
    canManageTeam: (teamId) => canEditTeam(role, teamId, { local: !profile, teamIds }),
  };
}
