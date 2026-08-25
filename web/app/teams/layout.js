import { redirect } from 'next/navigation';
import { AppShell } from '../../components/app-shell';
import { listTeams } from '../../lib/data';
import { createServerSupabase, getSessionUser } from '../../lib/supabase/server';

export default async function TeamsLayout({ children }) {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in?next=/dashboard');

  const supabase = await createServerSupabase();
  const teams = await listTeams(supabase).catch(() => []);
  const userLabel =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.user_metadata?.custom_claims?.global_name ||
    user.email ||
    'Signed in';

  return (
    <AppShell userLabel={userLabel} teams={teams}>
      {children}
    </AppShell>
  );
}
