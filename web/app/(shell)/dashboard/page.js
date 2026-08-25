import { OrgDashboard } from '../../../components/org-dashboard';
import { loadAppData } from '../../../lib/data';
import { createServerSupabase } from '../../../lib/supabase/server';

export const metadata = { title: 'Dashboard · Coach Intel' };

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const data = await loadAppData(supabase);
  return <OrgDashboard {...data} />;
}
