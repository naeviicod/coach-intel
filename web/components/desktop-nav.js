'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { canAccessPage } from '../lib/access';
import { NAV_GROUPS, SETTINGS_ITEM, TEAM_NAV_PAGES } from '../lib/nav';
import { isTeamHubPath } from '../lib/hub';
import { Icon } from './icon';

function active(pathname, item) {
  if (item.page === 'teams') return pathname === '/teams';
  if (item.page === 'team-hub') return isTeamHubPath(pathname) || pathname.startsWith('/team-hub');
  if (item.aliases?.some((alias) => pathname.startsWith(`/${alias}`))) return true;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function DesktopNav({ role, teams }) {
  const pathname = usePathname();
  const firstTeam = teams[0]?.id;
  const [collapsed, setCollapsed] = useState(false);
  const [folded, setFolded] = useState({});

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem('ci-nav-collapsed') === '1');
      setFolded(JSON.parse(window.localStorage.getItem('ci-nav-folded') || '{}'));
    } catch {
      /* ignore */
    }
    const onResize = () => {
      if (window.innerWidth < 1024) setCollapsed(true);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const groups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => canAccessPage(role, item.page)),
      })).filter((group) => group.items.length),
    [role]
  );

  function persistCollapsed(next) {
    setCollapsed(next);
    try {
      window.localStorage.setItem('ci-nav-collapsed', next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  function toggleGroup(label) {
    const key = label.toLowerCase();
    const next = { ...folded, [key]: !folded[key] };
    setFolded(next);
    try {
      window.localStorage.setItem('ci-nav-folded', JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  return (
    <nav id="sidebar" className={collapsed ? 'collapsed' : ''} aria-label="Global navigation">
      <div className="sb-brand">
        <Link href="/dashboard" className="sb-wordmark" aria-label="Coach Intel">
          <img className="sb-wordmark-coach" src="/assets/wordmark-coach.png" alt="" />
          <span className="sb-wordmark-intel" />
        </Link>
      </div>
      <div className="sb-nav">
        {groups.map((group) => {
          const key = group.label.toLowerCase();
          const hasActive = group.items.some((item) => active(pathname, item));
          const isFolded = Boolean(folded[key]) && !collapsed && !hasActive;
          return (
            <div key={group.label} className={`sb-group${isFolded ? ' folded' : ''}`}>
              <button
                type="button"
                className="sb-section-label"
                aria-expanded={String(!isFolded)}
                aria-label={`${isFolded ? 'Show' : 'Hide'} ${group.label}`}
                onClick={() => toggleGroup(group.label)}
              >
                <span>{group.label}</span>
                <span className="chev">
                  <Icon name={isFolded ? 'chevronRight' : 'chevronDown'} size={15} />
                </span>
              </button>
              <div className="sb-group-items">
                {group.items.map((item) => {
                  const href =
                    TEAM_NAV_PAGES.has(item.page) && firstTeam
                      ? item.page === 'team-hub'
                        ? `/team-hub/${encodeURIComponent(firstTeam)}`
                        : `${item.href}?team=${encodeURIComponent(firstTeam)}`
                      : item.href;
                  const on = active(pathname, item);
                  return (
                    <Link
                      key={item.page}
                      href={href}
                      className={`sb-link${on ? ' active' : ''}`}
                      aria-label={item.label}
                      aria-current={on ? 'page' : undefined}
                      data-page={item.page}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon name={item.icon} />
                      <span className="sb-link-label">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="sb-bottom">
        <Link
          href={SETTINGS_ITEM.href}
          className={`sb-link${pathname.startsWith('/settings') ? ' active' : ''}`}
          aria-label={SETTINGS_ITEM.label}
          data-page="settings"
        >
          <Icon name={SETTINGS_ITEM.icon} />
          <span className="sb-link-label">{SETTINGS_ITEM.label}</span>
        </Link>
        <button
          type="button"
          className="sb-collapse"
          aria-expanded={String(!collapsed)}
          aria-controls="sidebar"
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          onClick={() => persistCollapsed(!collapsed)}
        >
          <span className="chev">
            <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={14} />
          </span>
          <span>Collapse</span>
        </button>
      </div>
    </nav>
  );
}
