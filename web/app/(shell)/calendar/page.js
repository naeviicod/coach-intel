import { AddEvent } from '../../../components/add-records';
import { OrgCalendar } from '../../../components/org-calendar';
import { PageHeader, EmptyState } from '../../../components/page-header';
import { calendarItems } from '../../../lib/calendar';
import { loadWorkspace } from '../../../lib/workspace';

export const metadata = { title: 'Calendar · Coach Intel' };

export default async function CalendarPage() {
  const data = await loadWorkspace();
  const teams = data.allTeams || data.teams;
  const items = calendarItems({ ...data, teams });

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="Org overview — matches, meetings, reviews and tasks for every team and staff seat"
      />
      <AddEvent teams={teams} canEdit={data.canEdit} />
      {teams.length === 0 && items.length === 0 ? (
        <EmptyState
          title="No teams yet"
          body="Create a team, then add a match, meeting, or task to put it on the org calendar."
        />
      ) : (
        <OrgCalendar items={items} teams={teams} />
      )}
    </>
  );
}
