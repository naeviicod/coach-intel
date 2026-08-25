import '../desktop-ui.css';
import '../desktop-web.css';
import { redirect } from 'next/navigation';
import { DesktopShell } from '../../components/desktop-shell';
import { roleLabel } from '../../lib/access';
import { ensureProfile, getOrg, getProfile, listAllMembers, listTeams } from '../../lib/data';
import { isNaevii } from '../../lib/marks';
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
  const userLabel =
    org?.profileName ||
    profile?.discord_username ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.user_metadata?.custom_claims?.global_name ||
    user.email ||
    'Signed in';
  const title =
    org?.profileTitle ||
    (isNaevii(userLabel) || isNaevii(profile?.discord_username) ? 'Developer' : roleLabel(profile?.role));

  return (
    <DesktopShell
      userLabel={userLabel}
      role={profile?.role}
      title={title}
      avatarUrl={profile?.avatar_url}
      org={org}
      teams={teams}
      members={members}
    >
      {children}
    </DesktopShell>
  );
}
