import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DiscordSignIn } from '../../components/discord-sign-in';
import { BrandLockup } from '../../components/brand-lockup';
import { getSessionUser } from '../../lib/supabase/server';

export const metadata = { title: 'Sign in · Coach Intel' };

export default async function SignInPage({ searchParams }) {
  const user = await getSessionUser();
  const query = await searchParams;
  const nextPath = typeof query.next === 'string' && query.next.startsWith('/') ? query.next : '/dashboard';
  if (user) redirect(nextPath);

  return (
    <div className="gateway gateway-auth">
      <div className="pit" aria-hidden="true">
        <img className="pit-art" src="/assets/splash-background.png" alt="" />
        <span className="pit-veil" />
      </div>
      <header className="gateway-header">
        <Link href="/" className="gateway-brand" aria-label="Coach Intel">
          <BrandLockup compact />
        </Link>
      </header>
      <main className="auth-card">
        <h1>Sign in</h1>
        <p>Use the same Discord account as the Coach Intel desktop app. Your org roster is already in the cloud.</p>
        {query.error ? <p className="auth-error">{query.error}</p> : null}
        <DiscordSignIn nextPath={nextPath} />
        <Link href="/" className="text-link">
          Back
        </Link>
      </main>
    </div>
  );
}
