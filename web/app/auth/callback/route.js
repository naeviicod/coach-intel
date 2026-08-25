import { NextResponse } from 'next/server';
import { createServerSupabase } from '../../../lib/supabase/server';

function safeNext(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return '/dashboard';
  }
  return value;
}

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next') || request.cookies.get('ci-auth-next')?.value);

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const done = NextResponse.redirect(new URL(next, origin));
      done.cookies.set('ci-auth-next', '', { path: '/', maxAge: 0 });
      return done;
    }
  }

  const failed = new URL('/sign-in', origin);
  failed.searchParams.set('error', 'Could not complete Discord sign-in.');
  return NextResponse.redirect(failed);
}
