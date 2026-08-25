const { createClient } = require('@supabase/supabase-js');
const { supabasePublicConfig } = require('./env');

async function getLatestRelease() {
  const { url, key } = supabasePublicConfig();
  if (!url || !key) return null;

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('app_releases')
    .select('version, notes, mac_url, windows_url, published_at')
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[releases]', error.message);
    return null;
  }
  return data || null;
}

module.exports = { getLatestRelease };
