import { MapsModesView } from '../../../components/maps-modes-view';
import { loadWorkspace } from '../../../lib/workspace';

export const metadata = { title: 'Maps & Modes · Coach Intel' };

export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const data = await loadWorkspace();
  return <MapsModesView teams={data.teams} matches={data.matches} rulesetDocs={data.rulesetDocs} teamId={sp.team} />;
}
