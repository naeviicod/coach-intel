import { NextResponse } from 'next/server';
import { createServerSupabase } from '../../../../lib/supabase/server';

const ASSET_CACHE_CONTROL = 'private, max-age=3600, stale-while-revalidate=86400';

function assetRedirect(url) {
  const response = NextResponse.redirect(url);
  response.headers.set('Cache-Control', ASSET_CACHE_CONTROL);
  response.headers.set('Vary', 'Cookie');
  return response;
}

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
      return assetRedirect(data.signedUrl);
    }
  } catch {
    /* fall through to the public copy bundled with the site */
  }

  const fallback = new URL(`/assets/${key.split('/').map(encodeURIComponent).join('/')}`, request.url);
  return assetRedirect(fallback);
}
