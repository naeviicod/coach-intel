import { ScrimHubView } from '../../../components/scrim-hub-view';
import { loadWorkspace } from '../../../lib/workspace';

export const metadata = { title: 'Scrim Hub · Coach Intel' };

export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const data = await loadWorkspace();
  return <ScrimHubView teams={data.teams} scrims={data.scrims} teamId={sp.team} canEdit={data.canEdit} />;
}
