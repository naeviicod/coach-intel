import '../desktop-ui.css';
import '../desktop-web.css';
import { redirect } from 'next/navigation';
import { resolveAccessRole, scopeTeams } from '../../lib/access';
import { DesktopShell } from '../../components/desktop-shell';
import { sessionIdentity } from '../../lib/identity';
import { loadRosterCore } from '../../lib/workspace';

export const dynamic = 'force-dynamic';

export default async function ShellLayout({ children }) {
  const { user, teams, members, profile, org } = await loadRosterCore();
  if (!user) redirect('/sign-in?next=/dashboard');
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
      avatarUrl={identity.photo || identity.avatarUrl}
      org={org}
      teams={scopedTeams}
      members={members}
    >
      {children}
    </DesktopShell>
  );
}
