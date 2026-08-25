import { RankingsView } from '../../../components/rankings-view';
import { loadWorkspace } from '../../../lib/workspace';

export const metadata = { title: 'Rankings · Coach Intel' };

export default async function Page() {
  const data = await loadWorkspace();
  return <RankingsView teams={data.teams} matches={data.matches} rankings={data.rankings} canEdit={data.canEdit} />;
}
