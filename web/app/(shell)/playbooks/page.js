import { PlaybooksView } from '../../../components/playbooks-view';
import { loadWorkspace } from '../../../lib/workspace';

export const metadata = { title: 'Strats & Playbooks · Coach Intel' };

export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const data = await loadWorkspace();
  const teamId = sp.team || data.teams[0]?.id;
  const canEdit = teamId ? data.canManageTeam(teamId) : data.canEdit;
  return <PlaybooksView teams={data.teams} strats={data.strats} members={data.members} rulesetDocs={data.rulesetDocs} teamId={teamId} canEdit={canEdit} />;
}
