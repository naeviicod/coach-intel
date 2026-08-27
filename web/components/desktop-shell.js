import { accentCssText } from '../lib/accent';
import { ContentMain } from './content-main';
import { DesktopNav } from './desktop-nav';
import { DesktopTopbar } from './desktop-topbar';
import { LookSync } from './look-sync';
import { OrgLiveSync } from './org-live-sync';
import { PageGuard } from './page-guard';

const RULESET = {
  label: 'Ruleset',
  game: 'Black Ops 7',
  season: '2026',
  version: '1',
  last_checked: '2026-08-16',
};

export function DesktopShell({ userLabel, role, title, avatarUrl, org, teams, members, children }) {
  const rulesetParts = [RULESET.game, `Season ${RULESET.season}`, `v${RULESET.version}`];
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `html:has(#app.shell){${accentCssText(org?.accent)}}`,
        }}
      />
      <LookSync accent={org?.accent} background={org?.background} />
      <OrgLiveSync />
      <div id="atmosphere" className="splash-atmosphere arena settled art-bg" data-background="orbit" style={{ '--art-zoom': 1.14 }} aria-hidden="true">
        <span className="arena-field arena-field-soft" />
        <span className="arena-field" />
        <span className="arena-hex" />
        <span className="arena-grain" />
        <span className="arena-art">
          <img className="arena-art-img" src="/assets/backgrounds/orbit.png" alt="" draggable="false" />
          <span className="arena-art-tint" aria-hidden="true" />
        </span>
      </div>
      <div id="app" className="shell">
        <PageGuard role={role} />
        <DesktopNav role={role} teams={teams} />
        <div className="main-column">
          <DesktopTopbar
            userLabel={userLabel}
            role={role}
            title={title}
            avatarUrl={avatarUrl}
            org={org}
            teams={teams}
            members={members}
          />
          <ContentMain>{children}</ContentMain>
          <footer id="statusbar">
            <div className="sbar-group">
              <span className="sbar-label">{RULESET.label}</span>
              <span className="sbar-sep">│</span>
              <span>{rulesetParts.join(' · ')}</span>
            </div>
            <div className="sbar-group center">
              <span className="sbar-dot" />
              <span>All systems operational</span>
              <span className="sbar-sep">│</span>
              <span>Ruleset checked {RULESET.last_checked}</span>
            </div>
            <div className="sbar-group sources">
              <span className="sbar-label">v3.8.0</span>
              <span className="sbar-src">{RULESET.label}</span>
              <span className="sbar-src">Org cloud</span>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
