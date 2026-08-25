import { VetoLabView } from '../../../components/veto-lab-view';
import { loadWorkspace } from '../../../lib/workspace';

export const metadata = { title: 'Veto Lab · Coach Intel' };

export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const data = await loadWorkspace();
  return (
    <VetoLabView
      teams={data.teams}
      vetoes={data.vetoes}
      opponents={data.opponents}
      matches={data.matches}
      rulesetDocs={data.rulesetDocs}
      teamId={sp.team}
      canEdit={data.canEdit}
    />
  );
}
