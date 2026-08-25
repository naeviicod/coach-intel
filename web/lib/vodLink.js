// Parse YouTube / Twitch VOD URLs and stamp a timestamp onto a watch link.

export function fmtClock(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

export function parseClock(str) {
  const parts = String(str || '').trim().split(':').map((p) => parseInt(p, 10));
  if (!parts.length || parts.some((p) => Number.isNaN(p))) return 0;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export function parseVodUrl(raw) {
  const url = String(raw || '').trim();
  if (!url) return { kind: 'none', url: '', watchUrl: '', embedUrl: null, label: '' };
  let parsed;
  try {
    parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
  } catch {
    return { kind: 'other', url, watchUrl: url, embedUrl: null, label: 'Link' };
  }
  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

  if (host === 'youtu.be' || host.endsWith('youtube.com') || host === 'youtube-nocookie.com') {
    const id = youtubeId(parsed);
    if (!id) return { kind: 'other', url, watchUrl: parsed.toString(), embedUrl: null, label: 'YouTube' };
    const start = youtubeStart(parsed);
    return {
      kind: 'youtube',
      id,
      start,
      url,
      watchUrl: `https://www.youtube.com/watch?v=${id}`,
      embedUrl: (t = start) =>
        `https://www.youtube-nocookie.com/embed/${id}?start=${Math.max(0, Math.floor(t || 0))}&enablejsapi=1&rel=0`,
      stampUrl: (t) => `https://www.youtube.com/watch?v=${id}&t=${Math.max(0, Math.floor(t || 0))}s`,
      label: 'YouTube',
    };
  }

  if (host === 'twitch.tv' || host === 'm.twitch.tv' || host === 'clips.twitch.tv' || host === 'player.twitch.tv') {
    const video = twitchVideoId(parsed);
    const clip = twitchClipId(parsed, host);
    if (video) {
      return {
        kind: 'twitch',
        id: video,
        url,
        watchUrl: `https://www.twitch.tv/videos/${video}`,
        embedUrl: null,
        stampUrl: (t) => `https://www.twitch.tv/videos/${video}${twitchStamp(t)}`,
        label: 'Twitch',
      };
    }
    if (clip) {
      return {
        kind: 'twitch-clip',
        id: clip,
        url,
        watchUrl: `https://clips.twitch.tv/${clip}`,
        embedUrl: null,
        stampUrl: (t) => `https://clips.twitch.tv/${clip}${t ? twitchStamp(t) : ''}`,
        label: 'Twitch clip',
      };
    }
    return {
      kind: 'twitch',
      url,
      watchUrl: parsed.toString(),
      embedUrl: null,
      stampUrl: (t) => parsed.toString() + twitchStamp(t),
      label: 'Twitch',
    };
  }

  return { kind: 'other', url, watchUrl: parsed.toString(), embedUrl: null, stampUrl: () => parsed.toString(), label: 'Link' };
}

function youtubeId(parsed) {
  if (parsed.hostname.replace(/^www\./, '') === 'youtu.be') {
    return parsed.pathname.split('/').filter(Boolean)[0] || '';
  }
  const v = parsed.searchParams.get('v');
  if (v) return v;
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (['embed', 'live', 'shorts', 'v'].includes(parts[0]) && parts[1]) return parts[1];
  return '';
}

function youtubeStart(parsed) {
  const t = parsed.searchParams.get('t') || parsed.searchParams.get('start') || '';
  if (!t) return 0;
  if (/^\d+$/.test(t)) return Number(t);
  const m = String(t).match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (!m) return 0;
  return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
}

function twitchVideoId(parsed) {
  const parts = parsed.pathname.split('/').filter(Boolean);
  const videos = parts.indexOf('videos');
  if (videos >= 0 && parts[videos + 1]) return parts[videos + 1].replace(/^v/, '');
  if (parts[0] === 'video' && parts[1]) return parts[1].replace(/^v/, '');
  return parsed.searchParams.get('video') || '';
}

function twitchClipId(parsed, host) {
  if (host === 'clips.twitch.tv') return parsed.pathname.split('/').filter(Boolean)[0] || '';
  const parts = parsed.pathname.split('/').filter(Boolean);
  const clip = parts.indexOf('clip');
  if (clip >= 0 && parts[clip + 1]) return parts[clip + 1];
  return '';
}

function twitchStamp(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  if (!s) return '';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `?t=${h}h${m}m${sec}s`;
}
