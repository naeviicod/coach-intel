import { PlaybooksView } from '../../../components/playbooks-view';
import { loadWorkspace } from '../../../lib/workspace';

export const metadata = { title: 'Strats & Playbooks · Coach Intel' };

export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const data = await loadWorkspace();
  return <PlaybooksView teams={data.teams} strats={data.strats} rulesetDocs={data.rulesetDocs} teamId={sp.team} canEdit={data.canEdit} />;
}
