import { headers } from 'next/headers';
import { SettingsShell } from '../../../../components/settings-shell';
import { recommendedPlatform } from '../../../../lib/desktop-release';
import { getLatestRelease } from '../../../../lib/releases';
import { loadWorkspace } from '../../../../lib/workspace';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Settings · Coach Intel' };

export default async function Page({ params }) {
  const { section } = await params;
  const [data, release, requestHeaders] = await Promise.all([loadWorkspace(), getLatestRelease(), headers()]);
  if (section === 'teams') redirect('/teams');
  return (
    <SettingsShell
      section={section}
      org={data.org}
      isOrgAdmin={data.isOrgAdmin}
      identity={data.identity}
      profile={data.profile}
      role={data.role}
      members={data.members}
      teams={data.allTeams || data.teams}
      release={release}
      detectedPlatform={recommendedPlatform(requestHeaders.get('user-agent') || '')}
    />
  );
}
