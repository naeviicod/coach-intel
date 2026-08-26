'use client';

import Link from 'next/link';
import { resolveSettingsSection } from '../lib/settings-access';
import { Icon } from './icon';
import { PageHeader } from './page-header';
import { AccountCard, BackgroundCard, OrganizationCard, ProfileCard } from './settings-view';
import {
  AboutCard,
  DataCard,
  FeedbackCard,
  GameRulesCard,
  IntegrationsCard,
  TeamAccessCard,
} from './settings-sections';

export function SettingsShell({
  section,
  org,
  isOrgAdmin,
  identity,
  profile,
  role,
  members,
  teams,
}) {
  const { visible, def, sectionKey } = resolveSettingsSection(role, isOrgAdmin, section);

  return (
    <div className="settings-page">
      <PageHeader title="Settings" subtitle={def.sub} />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {visible.map((item) => {
            const on = item.key === sectionKey;
            return (
              <Link
                key={item.key}
                href={`/settings/${item.key}`}
                className={`rail-link${on ? ' active' : ''}`}
                aria-current={on ? 'page' : undefined}
              >
                <Icon name={item.icon} size={14} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="settings-panel">
          {sectionKey === 'profile' ? (
            <>
              <ProfileCard identity={identity} profile={profile} />
              <BackgroundCard />
              <AccountCard />
            </>
          ) : null}
          {sectionKey === 'organization' ? <OrganizationCard org={org} isOrgAdmin={isOrgAdmin} /> : null}
          {sectionKey === 'game-rules' ? <GameRulesCard /> : null}
          {sectionKey === 'integrations' ? <IntegrationsCard /> : null}
          {sectionKey === 'team-access' ? <TeamAccessCard members={members} teams={teams} /> : null}
          {sectionKey === 'data' ? <DataCard /> : null}
          {sectionKey === 'feedback' ? <FeedbackCard /> : null}
          {sectionKey === 'about' ? <AboutCard /> : null}
        </div>
      </div>
    </div>
  );
}
