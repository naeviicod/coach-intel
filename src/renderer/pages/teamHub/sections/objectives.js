import { el, fmtDue } from '../../../utils.js';
import { hubHead, miniEmpty, taskRow } from '../parts.js';

// Objectives are tasks with a due date and an owner: same store, one lens.
export async function render(root, hub) {
  root.append(
    hubHead('Objectives', `What ${hub.team.name} is working on`, [
      el('button', { class: 'btn primary', onclick: () => openComposer() }, '+ New Objective'),
      hub.ctxToggle,
    ])
  );

  const composer = el('div', {});
  const open = el('div', { class: 'card compact', style: 'margin-bottom:14px;' });
  const done = el('div', { class: 'card compact' });
  root.append(composer, open, done);

  function openComposer() {
    composer.innerHTML = '';
    const title = el('input', { type: 'text', placeholder: 'e.g. Cut first-blood deaths on Skyline Hardpoint', 'aria-label': 'Objective' });
    const due = el('input', { type: 'date', 'aria-label': 'Target date' });
    const error = el('div', { class: 'field-hint', style: 'color:var(--loss);display:none;' }, 'Describe the objective first.');

    composer.append(
      el('div', { class: 'card', style: 'margin-bottom:14px;' }, [
        el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;' }, [
          el('div', { style: 'flex:1;min-width:220px;' }, [title]),
          due,
          el('button', { class: 'btn primary sm', onclick: save }, 'Add'),
          el('button', { class: 'btn subtle sm', onclick: () => (composer.innerHTML = '') }, 'Cancel'),
        ]),
        error,
      ])
    );
    title.focus();

    async function save() {
      if (!title.value.trim()) {
        error.style.display = '';
        title.focus();
        return;
      }
      await window.cci.saveTask(hub.team.id, { title: title.value.trim(), due: due.value || null });
      composer.innerHTML = '';
      await draw();
    }
  }

  async function draw() {
    const tasks = await window.cci.getTasks(hub.team.id);
    const active = tasks.filter((t) => !t.done);
    const complete = tasks.filter((t) => t.done);

    open.innerHTML = '';
    open.append(el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, `Open · ${active.length}`)]));
    if (!active.length) {
      open.append(
        miniEmpty(
          'No open objectives',
          'Set a target the team can measure, like a map win rate or a specific habit to fix.',
          el('button', { class: 'btn primary sm', onclick: () => openComposer() }, '+ New Objective')
        )
      );
    } else {
      for (const task of active) open.append(row(task));
    }

    done.innerHTML = '';
    done.append(el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, `Completed · ${complete.length}`)]));
    if (!complete.length) {
      done.append(el('div', { class: 'field-hint', style: 'padding:6px 2px;' }, 'Nothing completed yet.'));
    } else {
      for (const task of complete) done.append(row(task));
    }
  }

  function row(task) {
    const node = taskRow(task, {
      onToggle: async (t) => {
        await window.cci.saveTask(hub.team.id, { task_id: t.task_id, done: !t.done });
        await draw();
      },
    });
    node.append(
      el(
        'button',
        {
          class: 'btn subtle sm',
          'aria-label': `Delete ${task.title}`,
          onclick: async () => {
            if (!confirm(`Delete "${task.title}"?`)) return;
            await window.cci.deleteTask(hub.team.id, task.task_id);
            await draw();
          },
        },
        'Delete'
      )
    );
    if (!task.done && fmtDue(task.due).overdue) node.classList.add('overdue');
    return node;
  }

  await draw();
}
