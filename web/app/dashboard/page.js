import { OrgDashboard } from '../../components/org-dashboard';
import { getOrg, listAllMembers, listTeams } from '../../lib/data';
import { createServerSupabase } from '../../lib/supabase/server';

export const metadata = { title: 'Dashboard · Coach Intel' };

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const [org, teams, members] = await Promise.all([
    getOrg(supabase).catch(() => null),
    listTeams(supabase).catch(() => []),
    listAllMembers(supabase).catch(() => []),
  ]);

  return <OrgDashboard org={org} teams={teams} members={members} />;
}
