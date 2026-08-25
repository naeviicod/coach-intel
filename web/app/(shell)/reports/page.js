import { ReportsView } from '../../../components/reports-view';
import { loadWorkspace } from '../../../lib/workspace';

export const metadata = { title: 'Reports · Coach Intel' };

export default async function Page() {
  const data = await loadWorkspace();
  return (
    <ReportsView
      teams={data.teams}
      members={data.members}
      matches={data.matches}
      scrims={data.scrims}
      opponents={data.opponents}
    />
  );
}
