import { Suspense } from 'react';
import { WarRoomView } from '../../../components/war-room-view';
import { loadWorkspace } from '../../../lib/workspace';

export const metadata = { title: 'War Room · Coach Intel' };

export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const data = await loadWorkspace();
  return (
    <Suspense>
      <WarRoomView
        teams={data.teams}
        opponents={data.opponents}
        matches={data.matches}
        strats={data.strats}
        vods={data.vods}
        notes={data.notes}
        vetoes={data.vetoes}
        rulesetDocs={data.rulesetDocs}
        teamId={sp.team}
      />
    </Suspense>
  );
}
