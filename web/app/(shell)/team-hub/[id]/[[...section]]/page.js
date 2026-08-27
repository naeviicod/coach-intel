import { notFound, redirect } from 'next/navigation';
import { TeamHub } from '../../../../../components/team-hub';
import { parseHubSection, hubDocKinds } from '../../../../../lib/hub';
import { resolveRuleset } from '../../../../../lib/ruleset';
import { loadWorkspace } from '../../../../../lib/workspace';

export async function generateMetadata({ params }) {
  const { id } = await params;
  return { title: `${decodeURIComponent(id)} · Coach Intel` };
}

export default async function TeamHubPage({ params }) {
  const { id, section: sectionParts } = await params;
  const teamId = decodeURIComponent(id);
  const { key, sub } = parseHubSection(sectionParts);
  const data = await loadWorkspace({ teamId, kinds: hubDocKinds(key) });
  const team = data.teams.find((item) => item.id === teamId);
  if (!team) {
    if (!data.teams[0]) redirect('/teams');
    notFound();
  }

  const scoped = (rows) => (rows || []).filter((row) => row.team_id === team.id);

  return (
    <TeamHub
      team={team}
      teams={data.teams}
      section={key}
      sub={sub}
      members={scoped(data.members)}
      matches={scoped(data.matches)}
      notes={scoped(data.notes)}
      strats={scoped(data.strats)}
      events={scoped(data.events)}
      tasks={scoped(data.tasks)}
      scrims={scoped(data.scrims)}
      opponents={data.opponents}
      ruleset={resolveRuleset(data.rulesetDocs)}
      canEdit={data.canEdit}
      author={data.org?.profileName || 'Coach'}
      reviewCount={0}
    />
  );
}
