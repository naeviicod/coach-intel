import { ScoutingView } from '../../../components/scouting-view';
import { loadWorkspace } from '../../../lib/workspace';

export const metadata = { title: 'Scouting · Coach Intel' };

export default async function Page() {
  const data = await loadWorkspace();
  return (
    <ScoutingView
      opponents={data.opponents}
      matches={data.matches}
      vetoes={data.vetoes}
      canEdit={data.canEdit}
    />
  );
}
