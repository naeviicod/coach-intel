import { OrgDashboard } from '../../../components/org-dashboard';
import { seesAllTeams } from '../../../lib/access';
import { loadWorkspace } from '../../../lib/workspace';

export const metadata = { title: 'Dashboard · Coach Intel' };

export default async function DashboardPage() {
  const data = await loadWorkspace();
  return (
    <OrgDashboard
      {...data}
      allowedTeamIds={seesAllTeams(data.role) ? null : data.teamIds}
    />
  );
}
