import { DatabaseView } from '../../../components/database-view';
import { loadWorkspace } from '../../../lib/workspace';

export const metadata = { title: 'Member Database · Coach Intel' };

export default async function Page() {
  const data = await loadWorkspace();
  return <DatabaseView teams={data.teams} members={data.members} matches={data.matches} canEdit={data.canEdit} />;
}
