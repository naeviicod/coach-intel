import { el, fmtDue } from '../utils.js';
import { taskRow, miniEmpty } from './teamHub/parts.js';

const FILTERS = [
  { key: 'open', label: 'Open' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'done', label: 'Done' },
  { key: 'all', label: 'All' },
];

export async function render(container, ctx) {
  const teams = await window.cci.getTeams();
  if (!teams.length) {
    container.append(el('div', { class: 'card empty-state' }, 'No teams yet.'));
    return;
  }

  // Tasks are owned by teams; this page is the cross-team roll-up, and every
  // write still goes back to the owning team's store.
  const scoped = teams.find((t) => t.id === ctx.param);
  const scope = scoped ? [scoped] : teams;

  let filter = 'open';
  let teamFilter = scoped ? scoped.id : '';

  container.append(
    el('div', { class: 'page-header' }, [
      el('div', {}, [
        el('div', { class: 'page-title' }, 'Tasks'),
        el('div', { class: 'page-subtitle' }, scoped ? scoped.name : 'Across every team in your organization'),
      ]),
      el('button', { class: 'btn primary', onclick: () => openComposer() }, '+ New Task'),
    ])
  );

  const bar = el('div', { class: 'filter-bar' });
  const composer = el('div', {});
  const list = el('div', { class: 'card compact' });
  container.append(bar, composer, list);

  function drawBar() {
    bar.innerHTML = '';
    for (const f of FILTERS) {
      bar.append(
        el(
          'button',
          {
            type: 'button',
            class: `mode-chip${filter === f.key ? ' active' : ''}`,
            'aria-pressed': String(filter === f.key),
            onclick: () => {
              filter = f.key;
              drawBar();
              draw();
            },
          },
          f.label
        )
      );
    }
    if (teams.length > 1 && !scoped) {
      bar.append(
        el(
          'select',
          {
            'aria-label': 'Filter by team',
            style: 'margin-left:auto;',
            onchange: (e) => {
              teamFilter = e.target.value;
              draw();
            },
          },
          [
            el('option', { value: '' }, 'All teams'),
            ...teams.map((t) => el('option', { value: t.id, selected: teamFilter === t.id ? 'selected' : null }, t.name)),
          ]
        )
      );
    }
  }

  function openComposer(team = scope[0]) {
    composer.innerHTML = '';
    const title = el('input', { type: 'text', placeholder: 'What needs doing?', 'aria-label': 'Task title' });
    const due = el('input', { type: 'date', 'aria-label': 'Due date' });
    const teamPick =
      teams.length > 1 && !scoped
        ? el('select', { 'aria-label': 'Team' }, teams.map((t) => el('option', { value: t.id }, t.name)))
        : null;
    const assigneePick = el('select', { 'aria-label': 'Assign to' }, [el('option', { value: '' }, 'Unassigned')]);
    const error = el('div', { class: 'field-hint', style: 'color:var(--loss);display:none;' }, 'A title is required.');

    async function loadAssignees(teamId) {
      const current = assigneePick.value;
      assigneePick.innerHTML = '';
      assigneePick.append(el('option', { value: '' }, 'Unassigned'));
      let members = [];
      try {
        members = await window.cci.getMembers(teamId);
      } catch (err) {
        console.error('[tasks] could not load members for assignment', err);
      }
      for (const m of members) {
        assigneePick.append(el('option', { value: m.id, selected: m.id === current ? 'selected' : null }, m.gamertag));
      }
    }
    loadAssignees(teamPick ? teamPick.value : team.id);
    if (teamPick) teamPick.addEventListener('change', () => loadAssignees(teamPick.value));

    composer.append(
      el('div', { class: 'card compact', style: 'margin-bottom:12px;' }, [
        el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;' }, [
          el('div', { style: 'flex:1;min-width:200px;' }, [title]),
          due,
          teamPick,
          assigneePick,
          el('button', { class: 'btn primary sm', onclick: save }, 'Add'),
          el('button', { class: 'btn subtle sm', onclick: () => (composer.innerHTML = '') }, 'Cancel'),
        ]),
        error,
      ])
    );
    title.focus();

    async function save(ev) {
      const btn = ev?.currentTarget;
      if (btn?.disabled) return;
      if (!title.value.trim()) {
        error.style.display = '';
        title.focus();
        return;
      }
      if (btn) btn.disabled = true;
      try {
        const teamId = teamPick ? teamPick.value : team.id;
        await window.cci.saveTask(teamId, {
          title: title.value.trim(),
          due: due.value || null,
          assignee_id: assigneePick.value || null,
        });
        composer.innerHTML = '';
        await draw();
      } catch (err) {
        if (btn) btn.disabled = false;
        error.textContent = err?.message || 'Could not save the task.';
        error.style.display = '';
      }
    }
  }

  async function draw() {
    list.innerHTML = '';
    const rows = [];
    const membersByTeam = new Map();
    for (const team of scope) {
      if (teamFilter && team.id !== teamFilter) continue;
      const tasks = await window.cci.getTasks(team.id);
      for (const task of tasks) rows.push({ ...task, team });
    }

    const visible = rows.filter((t) => {
      if (filter === 'open') return !t.done;
      if (filter === 'done') return t.done;
      if (filter === 'overdue') return !t.done && fmtDue(t.due).overdue;
      return true;
    });

    if (!visible.length) {
      list.append(
        miniEmpty(
          filter === 'open' ? 'No open tasks' : 'Nothing here',
          filter === 'open'
            ? 'Prep work you assign to a team shows up here and in that team’s hub.'
            : 'Try a different filter.',
          el('button', { class: 'btn primary sm', onclick: () => openComposer() }, '+ New Task')
        )
      );
      return;
    }

    for (const task of visible) {
      let assigneeName = null;
      if (task.assignee_id) {
        if (!membersByTeam.has(task.team.id)) {
          membersByTeam.set(task.team.id, await window.cci.getMembers(task.team.id).catch(() => []));
        }
        assigneeName = membersByTeam.get(task.team.id).find((m) => m.id === task.assignee_id)?.gamertag || null;
      }
      const row = taskRow(task, {
        assigneeName,
        onToggle: async (t) => {
          await window.cci.saveTask(t.team.id, { task_id: t.task_id, done: !t.done });
          await draw();
        },
      });
      row.append(
        el('div', { style: 'display:flex;align-items:center;gap:6px;flex-shrink:0;' }, [
          teams.length > 1
            ? el('button', { class: 'btn subtle sm', onclick: () => ctx.navigate('team-hub', task.team.id) }, task.team.name)
            : null,
          el(
            'button',
            {
              class: 'btn subtle sm danger',
              'aria-label': `Delete ${task.title}`,
              onclick: async () => {
                if (!confirm(`Delete "${task.title}"?`)) return;
                await window.cci.deleteTask(task.team.id, task.task_id);
                await draw();
              },
            },
            'Delete'
          ),
        ])
      );
      list.append(row);
    }
  }

  drawBar();
  await draw();
}
