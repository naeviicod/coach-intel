import { NextResponse } from 'next/server';
import { createServerSupabase, getSessionUser } from '../../../lib/supabase/server';

const HEX_256 = /^[a-f0-9]{64}$/i;
const VERSION = /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/;

function responseWithNoReferrer(response) {
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

function callback(origin, { code, state, error }) {
  const url = new URL('coachintel://setup');
  if (code) url.searchParams.set('code', code);
  if (state) url.searchParams.set('state', state);
  if (error) url.searchParams.set('error', error);
  return responseWithNoReferrer(NextResponse.redirect(url));
}

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const state = requestUrl.searchParams.get('state') || '';
  const challenge = requestUrl.searchParams.get('challenge') || '';
  const version = requestUrl.searchParams.get('version') || '';
  if (!HEX_256.test(state) || !HEX_256.test(challenge) || !VERSION.test(version)) {
    return callback(requestUrl.origin, { state: HEX_256.test(state) ? state : null, error: 'invalid-request' });
  }

  const user = await getSessionUser();
  if (!user) {
    const signIn = new URL('/sign-in', requestUrl.origin);
    signIn.searchParams.set('next', `${requestUrl.pathname}${requestUrl.search}`);
    return responseWithNoReferrer(NextResponse.redirect(signIn));
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('authorize_desktop_setup', {
    p_platform: 'mac',
    p_release_version: version,
    p_state: state,
    p_challenge: challenge,
  });
  if (error || data?.ok !== true || !HEX_256.test(String(data.code || ''))) {
    return callback(requestUrl.origin, { state, error: 'expired-or-unavailable' });
  }
  return callback(requestUrl.origin, { code: data.code, state });
}
