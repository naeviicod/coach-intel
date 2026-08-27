import { NextResponse } from 'next/server';
import { createServerSupabase } from '../../../../lib/supabase/server';

const HEX_256 = /^[a-f0-9]{64}$/i;
const MAX_BODY_BYTES = 1024;

function noStore(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
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
  const { code, verifier, state } = body || {};
  if (!HEX_256.test(String(code || '')) || !HEX_256.test(String(verifier || '')) || !HEX_256.test(String(state || ''))) {
    return noStore({ error: 'invalid-request' }, 400);
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('redeem_desktop_setup_code', {
    p_code: code,
    p_verifier: verifier,
    p_state: state,
  });
  if (error || data?.ok !== true) return noStore({ error: 'expired-or-unavailable' }, 410);

  // The RPC is intentionally limited to this one display-only value.
  return noStore({ displayName: typeof data.display_name === 'string' ? data.display_name : null });
}
