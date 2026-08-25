import { StatisticsView } from '../../../components/statistics-view';
import { loadWorkspace } from '../../../lib/workspace';

export const metadata = { title: 'Statistics · Coach Intel' };

export default async function Page() {
  const data = await loadWorkspace();
  return <StatisticsView teams={data.teams} members={data.members} matches={data.matches} />;
}
