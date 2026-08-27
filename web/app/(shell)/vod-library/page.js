import { VodLibraryView } from '../../../components/vod-library-view';
import { loadWorkspace } from '../../../lib/workspace';

export const metadata = { title: 'VOD Library · Coach Intel' };

export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const teamId = sp.team || '';
  const data = await loadWorkspace({ teamId, kinds: ['vod', 'ruleset'] });
  return <VodLibraryView teams={data.teams} vods={data.vods} rulesetDocs={data.rulesetDocs} teamId={teamId} canEdit={data.canEdit} />;
}
