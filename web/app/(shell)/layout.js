import '../desktop-ui.css';
import '../desktop-web.css';
import { redirect } from 'next/navigation';
import { resolveAccessRole, scopeTeams } from '../../lib/access';
import { DesktopShell } from '../../components/desktop-shell';
import { ensureProfile, getOrg, getProfile, listAllMembers, listTeams } from '../../lib/data';
import { sessionIdentity } from '../../lib/identity';
import { createServerSupabase, getSessionUser } from '../../lib/supabase/server';

export default async function ShellLayout({ children }) {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in?next=/dashboard');

  const supabase = await createServerSupabase();
  await ensureProfile(supabase).catch(() => null);
  const [teams, members, profile, org] = await Promise.all([
    listTeams(supabase).catch(() => []),
    listAllMembers(supabase).catch(() => []),
    getProfile(supabase, user.id),
    getOrg(supabase).catch(() => null),
  ]);
  const identity = sessionIdentity({ user, profile, members, org });
  const teamIds = (members || [])
    .filter((row) => row.user_id === user.id)
    .map((row) => row.team_id)
    .filter(Boolean);
  const role = identity.role || resolveAccessRole(profile);
  const scopedTeams = scopeTeams(teams, { role, teamIds });

  return (
    <DesktopShell
      userLabel={identity.name}
      role={role}
      title={identity.title}
      avatarUrl={identity.avatarUrl || identity.photo}
      org={org}
      teams={scopedTeams}
      members={members}
    >
      {children}
    </DesktopShell>
  );
}
