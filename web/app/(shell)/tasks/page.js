import { AddTask, ToggleTask } from '../../../components/add-records';
import { PageHeader, EmptyState } from '../../../components/page-header';
import { loadWorkspace } from '../../../lib/workspace';
import { fmtDue } from '../../../lib/marks';

export const metadata = { title: 'Tasks · Coach Intel' };

export default async function TasksPage() {
  const { teams, tasks, canEdit } = await loadWorkspace();
  const teamName = (id) => teams.find((t) => t.id === id)?.name || 'Team';
  const open = tasks.filter((t) => !t.done);

  return (
    <>
      <PageHeader title="Tasks" subtitle="Open work across the organization" />
      <AddTask teams={teams} canEdit={canEdit} />
      {open.length === 0 ? (
        <EmptyState title="Nothing pending" body="No open tasks and no screenshots waiting for review." />
      ) : (
        <div className="card">
          {open.map((task) => {
            const due = fmtDue(task.due);
            return (
              <div key={task.id || task.task_id} className="crow">
                <div className="crow-main">
                  <div className="crow-title">{task.title || 'Task'}</div>
                  <div className="crow-sub">{teamName(task.team_id)}</div>
                </div>
                <div className={`crow-meta${due.overdue ? ' overdue' : ''}`}>{due.label}</div>
                <ToggleTask task={task} canEdit={canEdit} />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
