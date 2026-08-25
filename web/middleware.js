import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './lib/config';

export async function middleware(request) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const needsAuth = path.startsWith('/dashboard') || path.startsWith('/teams');
  if (needsAuth && !user) {
    const signIn = new URL('/sign-in', request.url);
    signIn.searchParams.set('next', path);
    return NextResponse.redirect(signIn);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|assets/).*)'],
};
