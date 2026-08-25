import { NeedsReviewView } from '../../../components/needs-review-view';
import { loadWorkspace } from '../../../lib/workspace';

export const metadata = { title: 'Scoreboard Inbox · Coach Intel' };

export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const data = await loadWorkspace();
  return <NeedsReviewView teams={data.teams} teamId={sp.team} canEdit={data.canEdit} />;
}
