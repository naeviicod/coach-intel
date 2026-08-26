import { OrgCalendar } from '../../../components/org-calendar';
import { EmptyState } from '../../../components/page-header';
import { calendarItems } from '../../../lib/calendar';
import { loadWorkspace } from '../../../lib/workspace';

export const metadata = { title: 'Calendar · Coach Intel' };

export default async function CalendarPage() {
  const data = await loadWorkspace();
  const teams = data.allTeams || data.teams;
  const items = calendarItems({ ...data, teams });

  return teams.length === 0 && items.length === 0 ? (
    <EmptyState
      title="No teams yet"
      body="Create a team, then add a match, meeting, or task to put it on the org calendar."
    />
  ) : (
    <OrgCalendar items={items} teams={teams} canEdit={data.canEdit} />
  );
}
