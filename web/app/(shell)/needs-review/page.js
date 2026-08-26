import { NeedsReviewView } from '../../../components/needs-review-view';
import { mapNames, modeNames, resolveRuleset } from '../../../lib/ruleset';
import { loadWorkspace } from '../../../lib/workspace';

export const metadata = { title: 'Scoreboard Inbox · Coach Intel' };

export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const data = await loadWorkspace();
  const ruleset = resolveRuleset(data.rulesetDocs);
  return (
    <NeedsReviewView
      teams={data.teams}
      teamId={sp.team}
      members={data.members}
      matches={data.matches}
      maps={mapNames(ruleset)}
      modes={modeNames(ruleset)}
      canEdit={data.canEdit}
    />
  );
}
