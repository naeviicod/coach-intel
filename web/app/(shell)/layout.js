import { redirect } from 'next/navigation';
import { DesktopShell } from '../../components/desktop-shell';
import { ensureProfile, getProfile, listTeams } from '../../lib/data';
import { createServerSupabase, getSessionUser } from '../../lib/supabase/server';

export default async function ShellLayout({ children }) {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in?next=/dashboard');

  const supabase = await createServerSupabase();
  await ensureProfile(supabase).catch(() => null);
  const [teams, profile] = await Promise.all([
    listTeams(supabase).catch(() => []),
    getProfile(supabase, user.id),
  ]);
  const userLabel =
    profile?.discord_username ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.user_metadata?.custom_claims?.global_name ||
    user.email ||
    'Signed in';

  return (
    <DesktopShell userLabel={userLabel} role={profile?.role} teams={teams}>
      {children}
    </DesktopShell>
  );
}
