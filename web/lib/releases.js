const { createClient } = require('@supabase/supabase-js');
const { version: CURRENT_VERSION } = require('../package.json');
const { supabasePublicConfig } = require('./env');

const GITHUB_RELEASES = 'https://github.com/naeviicod/coach-intel/releases/download';

function githubWindowsUrl(version) {
  return `${GITHUB_RELEASES}/v${version}/Coach-Intel-Setup-${version}.exe`;
}

// Settings always offers the current Windows installer. A stale app_releases
// row (for example 3.5.0) must not hide a published GitHub .exe.
function overlayCurrentRelease(row, currentVersion = CURRENT_VERSION) {
  const sameVersion = row?.version === currentVersion;
  const windowsUrl = (sameVersion && row.windows_url) || githubWindowsUrl(currentVersion);
  return {
    version: currentVersion,
    notes: sameVersion ? (row.notes || null) : null,
    mac_url: sameVersion ? (row.mac_url || null) : null,
    windows_url: windowsUrl,
    published_at: row?.published_at || null,
  };
}

async function getLatestRelease() {
  const { url, key } = supabasePublicConfig();
  if (!url || !key) return overlayCurrentRelease(null);

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
    return overlayCurrentRelease(null);
  }
  return overlayCurrentRelease(data);
}

module.exports = { getLatestRelease, overlayCurrentRelease, githubWindowsUrl };
