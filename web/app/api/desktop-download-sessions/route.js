import { NextResponse } from 'next/server';
import { createServerSupabase, getSessionUser } from '../../../lib/supabase/server';

const MAX_BODY_BYTES = 1024;

function noStore(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function POST(request) {
  const length = Number(request.headers.get('content-length') || '0');
  if (!Number.isFinite(length) || length > MAX_BODY_BYTES) return noStore({ error: 'invalid-request' }, 413);

  let body;
  try {
    body = await request.json();
  } catch {
    return noStore({ error: 'invalid-request' }, 400);
  }
  if (!body || typeof body !== 'object' || Object.keys(body).length !== 1 || body.platform !== 'mac') {
    return noStore({ error: 'invalid-request' }, 400);
  }

  const user = await getSessionUser();
  if (!user) return noStore({ error: 'sign-in-required' }, 401);

  const supabase = await createServerSupabase();
  const { data: release, error: releaseError } = await supabase
    .from('app_releases')
    .select('version, mac_url')
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const downloadUrl = safeHttpsUrl(release?.mac_url);
  if (releaseError || !release?.version || !downloadUrl) return noStore({ error: 'release-unavailable' }, 503);

  // The RPC derives auth.uid() itself and receives no client-supplied identity,
  // URL, account ID, or display name.
  const { data, error } = await supabase.rpc('create_desktop_download_session', {
    p_platform: 'mac',
    p_release_version: release.version,
  });
  if (error || data?.ok !== true) return noStore({ error: 'session-unavailable' }, 503);

  return noStore({ downloadUrl });
}
