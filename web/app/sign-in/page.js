import { redirect } from 'next/navigation';
import { PublicGateway } from '../../components/public-gateway';
import { getSessionUser } from '../../lib/supabase/server';

export const metadata = { title: 'Sign in · Coach Intel' };

export default async function SignInPage({ searchParams }) {
  const user = await getSessionUser();
  const query = await searchParams;
  const nextPath = typeof query.next === 'string' && query.next.startsWith('/') ? query.next : '/dashboard';
  if (user) redirect(nextPath);

  return <PublicGateway error={query.error} nextPath={nextPath} />;
}
