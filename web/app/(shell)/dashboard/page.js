import { OrgDashboard } from '../../../components/org-dashboard';
import { seesAllTeams } from '../../../lib/access';
import { loadWorkspace } from '../../../lib/workspace';

export const metadata = { title: 'Dashboard · Coach Intel' };

export default async function DashboardPage() {
  const data = await loadWorkspace();
  return (
    <OrgDashboard
      org={data.org}
      teams={data.teams}
      members={data.members}
      tasks={data.tasks}
      matches={data.matches}
      notes={data.notes}
      allowedTeamIds={seesAllTeams(data.role) ? null : data.teamIds}
    />
  );
}
