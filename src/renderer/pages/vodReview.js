import { el } from '../utils.js';
import { iconBtn } from './teamHub/parts.js';
import { openModal, modalActions } from '../components/modal.js';
import { openForm, toast } from './planningShared.js';
import { fmtClock, parseClock, parseVodUrl } from '../lib/vodLink.js';

export function openVodReview(vod, teamId, reload) {
  const media = parseVodUrl(vod.url);
  let currentTime = media.start || 0;
  let iframe = null;

  const body = el('div', { class: 'vod-review' }, [
    el('h3', {}, vod.title),
    el('div', { class: 'field-hint', style: 'margin:-8px 0 14px;' }, [
      media.label || vod.source,
      vod.map || vod.mode ? ` · ${[vod.mode, vod.map].filter(Boolean).join(' · ')}` : '',
      vod.opponent ? ` · vs ${vod.opponent}` : '',
    ].join('')),
  ]);

  const stage = el('div', { class: 'vod-review-stage' });
  if (media.kind === 'youtube' && typeof media.embedUrl === 'function') {
    iframe = el('iframe', {
      class: 'vod-frame',
      src: media.embedUrl(currentTime),
      title: vod.title,
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
      allowfullscreen: 'allowfullscreen',
    });
    stage.append(el('div', { class: 'vod-frame-wrap' }, [iframe]));
    bindYoutubeTime(iframe, (t) => { currentTime = t; });
  } else if (media.watchUrl) {
    stage.append(
      el('div', { class: 'vod-watch-card' }, [
        el('div', { class: 'vod-watch-kicker' }, media.label || 'VOD'),
        el('div', { class: 'vod-watch-copy' }, 'Open the VOD, then add notes at the timestamps you care about. Each marker can jump back to that moment.'),
        el('button', { class: 'btn primary', onclick: () => openAt(media, currentTime) }, `Watch on ${media.label || 'link'}`),
      ])
    );
  } else {
    stage.append(el('div', { class: 'field-hint' }, 'Add a YouTube or Twitch link to watch this VOD from Coach Intel.'));
  }
  body.append(stage);

  const list = el('div', { class: 'vod-markers' });
  const renderMarkers = () => {
    list.innerHTML = '';
    const markers = [...(vod.markers || [])].sort((a, b) => a.t - b.t);
    if (!markers.length) {
      list.append(el('div', { class: 'field-hint', style: 'padding:6px 2px;' }, 'No notes yet. Jump to a moment and add what the team should take from it.'));
      return;
    }
    for (const marker of markers) {
      list.append(
        el('div', { class: 'crow', style: 'cursor:pointer;align-items:flex-start;' }, [
          el('button', {
            type: 'button',
            class: 'vod-ts',
            onclick: () => seekTo(iframe, media, marker.t),
          }, fmtClock(marker.t)),
          el('div', {
            class: 'crow-main',
            onclick: () => seekTo(iframe, media, marker.t),
          }, [
            el('div', { class: 'crow-title', style: 'white-space:normal;' }, marker.label || 'Marker'),
            marker.note ? el('div', { class: 'field-hint', style: 'margin-top:3px;line-height:1.5;' }, marker.note) : null,
          ]),
          el('div', { class: 'crow-actions edit-only' }, [
            iconBtn('trash', 'Remove marker', async () => {
              const markersNext = (vod.markers || []).filter((m) => m.id !== marker.id);
              vod.markers = markersNext;
              await window.cci.saveVod(teamId, { ...vod, markers: markersNext });
              renderMarkers();
            }),
          ]),
        ])
      );
    }
  };
  renderMarkers();
  body.append(el('div', { class: 'section-title', style: 'margin:16px 0 8px;' }, 'Timestamped notes'));
  body.append(list);

  const overlay = openModal(body, { width: media.kind === 'youtube' ? '760px' : '560px' });
  body.append(
    modalActions([
      el('button', { class: 'btn subtle', onclick: () => overlay.remove() }, 'Close'),
      media.watchUrl
        ? el('button', { class: 'btn subtle', onclick: () => openAt(media, currentTime) }, `Open ${media.label || 'link'}`)
        : null,
      el('button', {
        class: 'btn primary edit-only',
        onclick: () => addMarker(vod, teamId, () => currentTime, renderMarkers),
      }, '+ Add note'),
    ])
  );
}

function addMarker(vod, teamId, getTime, renderMarkers) {
  openForm({
    title: 'Add note',
    fields: [
      { key: 'time', label: 'Timestamp', placeholder: 'mm:ss (e.g. 4:12)', hint: 'Minutes:seconds into the VOD. Uses the player time when available.' },
      { key: 'label', label: 'Label', required: true, placeholder: 'Rotation, bad trade, great flank…' },
      { key: 'note', label: 'Note', type: 'textarea', placeholder: 'What to take away from this moment' },
    ],
    values: { time: fmtClock(getTime()) },
    onSubmit: async (values) => {
      const marker = { id: `m${Date.now().toString(36)}`, t: parseClock(values.time), label: values.label, note: values.note };
      const markers = [...(vod.markers || []), marker];
      vod.markers = markers;
      await window.cci.saveVod(teamId, { ...vod, markers });
      renderMarkers();
    },
  });
}

function seekTo(iframe, media, seconds) {
  if (iframe && media.kind === 'youtube') {
    youtubeCommand(iframe, 'seekTo', [Math.max(0, seconds), true]);
    youtubeCommand(iframe, 'playVideo', []);
    return;
  }
  openAt(media, seconds);
}

async function openAt(media, seconds) {
  const url = typeof media.stampUrl === 'function' ? media.stampUrl(seconds) : media.watchUrl;
  if (!url) return;
  const ok = await window.cci.openMedia?.(url);
  if (!ok) toast('Could not open that VOD link', 'error');
}

function youtubeCommand(iframe, func, args) {
  iframe?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
}

function bindYoutubeTime(iframe, onTime) {
  const onMessage = (e) => {
    if (typeof e.data !== 'string') return;
    let data;
    try { data = JSON.parse(e.data); } catch { return; }
    if (data.event === 'infoDelivery' && data.info?.currentTime != null) onTime(data.info.currentTime);
  };
  window.addEventListener('message', onMessage);
  iframe.addEventListener('load', () => {
    iframe.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1 }), '*');
  });
}
