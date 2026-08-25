import { loadAppData } from '../../../lib/data';
import { createServerSupabase } from '../../../lib/supabase/server';

export const metadata = { title: 'Tasks · Coach Intel' };

export default async function TasksPage() {
  const supabase = await createServerSupabase();
  const { teams, tasks } = await loadAppData(supabase);
  const teamName = (id) => teams.find((t) => t.id === id)?.name || 'Team';
  const open = tasks.filter((t) => !t.done);

  return (
    <>
      <header className="page-head">
        <h1>Tasks</h1>
        <p className="lede">Open work across the organization</p>
      </header>
      {open.length === 0 ? (
        <div className="empty-card">
          <h2>Nothing pending</h2>
          <p>No open tasks and no screenshots waiting for review.</p>
        </div>
      ) : (
        <ul className="dash-teams dash-card">
          {open.map((task) => (
            <li key={task.id || task.task_id}>
              <span className="team-name">{task.title || 'Task'}</span>
              <span className="team-meta">
                {teamName(task.team_id)}
                {task.due ? ` · due ${String(task.due).slice(0, 10)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
