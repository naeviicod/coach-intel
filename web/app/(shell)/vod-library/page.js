import { VodLibraryView } from '../../../components/vod-library-view';
import { loadWorkspace } from '../../../lib/workspace';

export const metadata = { title: 'VOD Library · Coach Intel' };

export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const data = await loadWorkspace();
  return <VodLibraryView teams={data.teams} vods={data.vods} rulesetDocs={data.rulesetDocs} teamId={sp.team} canEdit={data.canEdit} />;
}
