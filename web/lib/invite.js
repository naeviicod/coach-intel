export const INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export async function previewInvite(supabase, token) {
  if (!INVITE_TOKEN_RE.test(String(token || ''))) {
    return { ok: false, error: 'Invalid invite' };
  }
  const { data, error } = await supabase.rpc('invite_preview', { invite_token: token });
  if (error) return { ok: false, error: error.message };
  return data && typeof data === 'object' ? data : { ok: false, error: 'Invite not found' };
}

export async function redeemInvite(supabase, token) {
  if (!INVITE_TOKEN_RE.test(String(token || ''))) {
    return { ok: false, error: 'Invalid invite' };
  }
  const { data, error } = await supabase.rpc('redeem_invite', { invite_token: token });
  if (error) return { ok: false, error: error.message };
  return data && typeof data === 'object' ? data : { ok: false, error: 'Could not accept that invite' };
}
