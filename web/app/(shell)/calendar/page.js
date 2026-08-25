import { OrgCalendar } from '../../../components/org-calendar';
import { PageHeader, EmptyState } from '../../../components/page-header';
import { calendarItems } from '../../../lib/calendar';
import { loadAppData } from '../../../lib/data';
import { createServerSupabase } from '../../../lib/supabase/server';

export const metadata = { title: 'Calendar · Coach Intel' };

export default async function CalendarPage() {
  const supabase = await createServerSupabase();
  const data = await loadAppData(supabase);
  const items = calendarItems(data);

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="Org overview — matches, meetings, reviews and tasks for every team and staff seat"
      />
      {data.teams.length === 0 ? (
        <EmptyState
          title="No teams yet"
          body="Create a team, then add a match, meeting, or task to put it on the org calendar."
        />
      ) : (
        <OrgCalendar items={items} teams={data.teams} />
      )}
    </>
  );
}
