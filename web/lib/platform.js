function detectPlatform(ua = '') {
  const s = String(ua);
  if (/iPhone|iPad|iPod|Android/i.test(s)) return 'mobile';
  if (/Windows|Win32|Win64|WOW64/i.test(s)) return 'windows';
  if (/Macintosh|Mac OS X|MacIntel/i.test(s)) return 'mac';
  return 'other';
}

function asLink(id, label, href) {
  if (!href) return null;
  return { id, label, href };
}

function pickDownload(release, platform) {
  const mac = asLink('mac', 'Download for Mac', release?.mac_url);
  const win = asLink('windows', 'Download for Windows', release?.windows_url);

  if (platform === 'windows') return { primary: win, other: mac, both: null };
  if (platform === 'mac') return { primary: mac, other: win, both: null };

  const both = [mac, win].filter(Boolean);
  return { primary: null, other: null, both: both.length ? both : null };
}

module.exports = { detectPlatform, pickDownload };
