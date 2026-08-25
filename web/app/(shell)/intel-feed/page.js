import { IntelFeedView } from '../../../components/intel-feed-view';
import { loadWorkspace } from '../../../lib/workspace';

export const metadata = { title: 'Intel Feed · Coach Intel' };

export default async function Page() {
  const data = await loadWorkspace();
  return <IntelFeedView teams={data.teams} members={data.members} matches={data.matches} scrims={data.scrims} />;
}
