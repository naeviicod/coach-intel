import { redirect } from 'next/navigation';
import { InviteGate } from '../../components/invite-gate';
import { safeAuthNext } from '../../lib/auth-next';
import { getSessionUser } from '../../lib/supabase/server';

export const metadata = { title: 'Sign in · Coach Intel' };

export default async function SignInPage({ searchParams }) {
  const user = await getSessionUser();
  const query = await searchParams;
  const nextPath = safeAuthNext(query.next);
  if (user) redirect(nextPath);

  return <InviteGate error={query.error} nextPath={nextPath} />;
}
