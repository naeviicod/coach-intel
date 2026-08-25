'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { roleLabel } from '../lib/access';
import { initials, isNaevii, markSrc } from '../lib/marks';
import { Icon } from './icon';

function Face({ photo, name }) {
  const src = markSrc(photo);
  return (
    <div className="avatar" style={{ width: 28, height: 28, fontSize: 10 }}>
      {src ? <img src={src} alt="" /> : initials(name)}
    </div>
  );
}

export function DesktopTopbar({ userLabel, role, title, avatarUrl, org, teams, members }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const roleTitle = title || (isNaevii(userLabel) ? 'Developer' : roleLabel(role));
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits = [];
    for (const team of teams || []) {
      if (`${team.name} ${team.tag || ''}`.toLowerCase().includes(q)) {
        hits.push({ href: `/teams/${encodeURIComponent(team.id)}`, label: team.name, type: 'Team' });
      }
    }
    for (const member of members || []) {
      const label = member.gamertag || member.name || '';
      if (label.toLowerCase().includes(q)) {
        hits.push({
          href: `/teams/${encodeURIComponent(member.team_id)}`,
          label,
          type: 'Player',
        });
      }
    }
    return hits.slice(0, 8);
  }, [query, teams, members]);

  return (
    <header id="topbar">
      <div className="topbar-search">
        <span className="topbar-search-icon">⌕</span>
        <input
          type="text"
          placeholder="Search players, teams, maps, matches, intel…"
          aria-label="Global search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {open && query.trim() ? (
          <div className="topbar-search-results" style={{ display: 'block' }}>
            {results.length === 0 ? (
              <div className="topbar-search-row">No matches</div>
            ) : (
              results.map((row) => (
                <Link key={`${row.type}-${row.href}-${row.label}`} href={row.href} className="topbar-search-row">
                  {row.label}
                  <span className="type">{row.type}</span>
                </Link>
              ))
            )}
          </div>
        ) : null}
      </div>
      <div className="topbar-spacer" />
      <div className="status-pill online">
        <span className="status-dot" />
        Online · Synced
      </div>
      <div className="topbar-notif-wrap">
        <button
          type="button"
          className="topbar-icon-btn"
          aria-label="Notifications"
          title="Notifications"
          onClick={() => setNotifOpen((v) => !v)}
        >
          <Icon name="bell" size={16} />
        </button>
        {notifOpen ? (
          <div className="topbar-notif-panel" style={{ display: 'block' }}>
            <div className="topbar-notif-empty">
              Nothing yet — you’ll see it here when a VOD review, meeting or match needs attention.
            </div>
          </div>
        ) : null}
      </div>
      <div className="topbar-divider" />
      <Link href="/settings" className="topbar-profile" title="Edit your profile">
        <div>
          <div className="topbar-profile-name">
            {userLabel}
            <span className="verified-mark" title="Confirmed · signed in with Discord">
              <Icon name="check" size={9} />
            </span>
          </div>
          <div className="topbar-profile-role">{roleTitle || 'Signed in'}</div>
        </div>
        <Face photo={avatarUrl || org?.profilePhoto} name={userLabel} />
      </Link>
      <form action="/auth/sign-out" method="post">
        <button type="submit" className="topbar-signout">
          Sign out
        </button>
      </form>
    </header>
  );
}
