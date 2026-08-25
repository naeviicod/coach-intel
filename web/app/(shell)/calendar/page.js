import { OrgCalendar } from '../../../components/org-calendar';
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
      <header className="page-head">
        <h1>Calendar</h1>
        <p className="lede">Org overview for every team, meeting, and assigned task</p>
      </header>
      {data.teams.length === 0 ? (
        <div className="empty-card">
          <h2>No teams yet</h2>
          <p>Create a team, then add a match, meeting, or task to put it on the org calendar.</p>
        </div>
      ) : (
        <OrgCalendar items={items} />
      )}
    </>
  );
}
