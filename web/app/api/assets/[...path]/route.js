import { NextResponse } from 'next/server';
import { createServerSupabase } from '../../../../lib/supabase/server';

export async function GET(request, { params }) {
  const parts = (await params).path || [];
  const key = parts.map((part) => decodeURIComponent(part)).join('/');
  if (!key || key.includes('..') || key.startsWith('/')) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.storage.from('org-assets').createSignedUrl(key, 60 * 60 * 6);
    if (!error && data?.signedUrl) {
      return NextResponse.redirect(data.signedUrl);
    }
  } catch {
    /* fall through to the public copy bundled with the site */
  }

  const fallback = new URL(`/assets/${key.split('/').map(encodeURIComponent).join('/')}`, request.url);
  return NextResponse.redirect(fallback);
}
