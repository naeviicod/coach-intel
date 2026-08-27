'use client';

import { useState } from 'react';
import { Icon } from './icon';
import { RELEASES_PAGE_URL, displayGamerTag, platformDownload } from '../lib/desktop-release';

function PlatformTile({ info, recommended }) {
  const [status, setStatus] = useState('idle'); // idle | starting | started | error
  const { meta, available, url, filename, version, releaseDate, platform } = info;
  const statusId = `platform-status-${platform}`;

  async function startDownload() {
    if (!available || status === 'starting') return;
    setStatus('starting');
    try {
      let downloadUrl = url;
      // The session is held only server-side. The static DMG remains immutable
      // and deliberately receives no member data, token, query string, or name.
      if (platform === 'mac') {
        try {
          const response = await fetch('/api/desktop-download-sessions', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ platform: 'mac' }),
          });
          if (response.ok) {
            const payload = await response.json();
            if (typeof payload?.downloadUrl === 'string' && payload.downloadUrl.startsWith('https://')) {
              downloadUrl = payload.downloadUrl;
            }
          }
        } catch { /* A static signed release remains downloadable offline. */ }
      }
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => setStatus('started'), 500);
      window.setTimeout(() => setStatus((s) => (s === 'started' ? 'idle' : s)), 4500);
    } catch {
      setStatus('error');
    }
  }

  const statusText =
    status === 'starting' ? 'Starting download…'
    : status === 'started' ? 'Download started.'
    : status === 'error' ? 'Could not start the download. Try again.'
    : '';

  return (
    <div className={`card platform-card${available ? '' : ' unavailable'}`}>
      <div className="platform-head">
        <span className="platform-icon" aria-hidden="true">
          <Icon name="desktop" size={16} />
        </span>
        <div className="platform-head-copy">
          <div className="platform-name">{meta.label}</div>
          <div className="platform-badges">
            {recommended ? <span className="pill accent">Recommended for your device</span> : null}
            {!available ? <span className="badge-soon">Coming soon</span> : null}
          </div>
        </div>
      </div>

      <div className="platform-meta">
        <div className="list-item-row about-row">
          <div className="settings-row-title">Version</div>
          <div className="about-value">{version || '—'}</div>
        </div>
        <div className="list-item-row about-row">
          <div className="settings-row-title">Installer</div>
          <div className="about-value">{meta.installer}</div>
        </div>
        <div className="list-item-row about-row">
          <div className="settings-row-title">Architecture</div>
          <div className="about-value">{meta.arch}</div>
        </div>
        <div className="list-item-row about-row">
          <div className="settings-row-title">Requires</div>
          <div className="about-value">{meta.minOS}</div>
        </div>
        <div className="list-item-row about-row">
          <div className="settings-row-title">Released</div>
          <div className="about-value">{releaseDate || '—'}</div>
        </div>
      </div>

      <div className="platform-actions">
        <button
          type="button"
          className="btn primary"
          disabled={!available || status === 'starting'}
          onClick={startDownload}
          aria-describedby={statusId}
        >
          {status === 'starting'
            ? 'Starting…'
            : status === 'started'
            ? 'Download started ✓'
            : available
            ? `Download for ${meta.label}`
            : 'Currently unavailable'}
        </button>
        <div id={statusId} role="status" aria-live="polite" className="field-hint platform-status">
          {statusText}
          {available && filename ? <span className="platform-filename">{filename}</span> : null}
        </div>
        {platform === 'mac' && available ? (
          <div className="field-hint platform-setup-note">After moving Coach Intel to Applications, its secure first-run setup will greet you.</div>
        ) : null}
      </div>
    </div>
  );
}

export function DesktopDownloadCard({ identity, release, detectedPlatform }) {
  const tag = displayGamerTag(identity);
  const windows = platformDownload(release, 'windows');
  const mac = platformDownload(release, 'mac');

  return (
    <div className="card section platform-download">
      <div className="section-title">Download</div>
      <p className="field-hint platform-personalize">
        Prepared for <strong>{tag}</strong>
        {release?.version ? <> · Coach Intel v{release.version}</> : null}
      </p>

      <div className="platform-grid">
        <PlatformTile info={windows} recommended={detectedPlatform === 'windows'} />
        <PlatformTile info={mac} recommended={detectedPlatform === 'mac'} />
      </div>

      {release?.notes ? <p className="field-hint platform-notes">{release.notes}</p> : null}

      <div className="list-item-row">
        <div>
          <div className="settings-row-title">Release notes</div>
          <div className="field-hint">Full changelog and past versions on GitHub.</div>
        </div>
        <a className="btn sm" href={RELEASES_PAGE_URL} target="_blank" rel="noopener noreferrer">
          View releases
        </a>
      </div>
    </div>
  );
}
