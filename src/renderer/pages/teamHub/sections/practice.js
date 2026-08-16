import { el, fmtDue } from '../../../utils.js';
import { hubHead, miniEmpty, taskRow } from '../parts.js';

// No scheduling model exists yet, so the planner is honest about that and shows
// the dated work this team already has instead of an invented calendar.
export async function render(root, hub) {
  const [tasks, strats] = await Promise.all([
    window.cci.getTasks(hub.team.id),
    window.cci.getStrats(hub.team.id),
  ]);

  root.append(hubHead('Practice Planner', 'Scheduling is not built yet', [hub.ctxToggle]));

  root.append(
    el('div', { class: 'card', style: 'margin-bottom:14px;' }, [
      miniEmpty(
        'No practice schedule',
        'Blocks, session times and attendance are not tracked yet. Until then, use dated objectives to plan what the team works on.',
        el('button', { class: 'btn primary sm', onclick: () => hub.go('objectives') }, 'Open Objectives')
      ),
    ])
  );

  const dated = tasks.filter((t) => t.due && !t.done).sort((a, b) => (a.due > b.due ? 1 : -1));
  const upcoming = el('div', { class: 'card compact', style: 'margin-bottom:14px;' }, [
    el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, 'Dated work')]),
  ]);
  if (!dated.length) {
    upcoming.append(el('div', { class: 'field-hint', style: 'padding:6px 2px;' }, 'No objectives have a target date.'));
  } else {
    for (const task of dated) {
      const row = taskRow(task, {
        onToggle: async (t) => {
          await window.cci.saveTask(hub.team.id, { task_id: t.task_id, done: !t.done });
          hub.go('practice');
        },
      });
      if (fmtDue(task.due).overdue) row.classList.add('overdue');
      upcoming.append(row);
    }
  }
  root.append(upcoming);

  const inPractice = strats.filter((s) => String(s.status || '').toUpperCase() === 'IN PRACTICE');
  const card = el('div', { class: 'card compact' }, [
    el('div', { class: 'card-head' }, [
      el('div', { class: 'card-title' }, 'Strats in practice'),
      el('div', { class: 'card-meta' }, `${inPractice.length}`),
    ]),
  ]);
  if (!inPractice.length) {
    card.append(
      el('div', { class: 'field-hint', style: 'padding:6px 2px;' }, 'Set a strat to "IN PRACTICE" and it shows up here.')
    );
  } else {
    for (const strat of inPractice) {
      card.append(
        el(
          'div',
          {
            class: 'crow',
            role: 'button',
            tabindex: '0',
            onclick: () => hub.go('strats', 'edit', strat.strategy_id),
            onkeydown: (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                hub.go('strats', 'edit', strat.strategy_id);
              }
            },
          },
          [
            el('div', { class: 'crow-main' }, [
              el('div', { class: 'crow-title' }, strat.strategy_name),
              el('div', { class: 'crow-sub' }, [el('span', {}, `${strat.map} · ${strat.mode}`)]),
            ]),
          ]
        )
      );
    }
  }
  root.append(card);
}
