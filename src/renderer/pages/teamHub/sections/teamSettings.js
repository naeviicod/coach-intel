import { el, teamMark } from '../../../utils.js';
import { uploadTeamLogo } from '../../../lib/teamManage.js';
import { hubHead, miniEmpty } from '../parts.js';

export async function render(root, hub) {
  const [members, strats, matches, notes, tasks] = await Promise.all([
    window.cci.getMembers(hub.team.id),
    window.cci.getStrats(hub.team.id),
    window.cci.getMatches(hub.team.id),
    window.cci.getNotes(hub.team.id),
    window.cci.getTasks(hub.team.id),
  ]);

  root.append(hubHead('Team Settings', `Identity and stored data for ${hub.team.name}`, [hub.ctxToggle]));

  const name = el('input', { type: 'text', value: hub.team.name || '', 'aria-label': 'Team name' });
  const tag = el('input', { type: 'text', value: hub.team.tag || '', placeholder: 'e.g. NAV', 'aria-label': 'Team tag' });
  const status = el('div', { class: 'field-hint', style: 'margin-top:10px;' }, '');

  root.append(
    el('div', { class: 'card', style: 'margin-bottom:14px;' }, [
      el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, 'Identity')]),
      el('div', { class: 'logo-well', style: 'margin-bottom:14px;' }, [
        teamMark(hub.team, { class: 'team-logo lg' }),
        el('div', { style: 'min-width:0;flex:1;' }, [
          el('div', { class: 'settings-row-title' }, 'Team logo'),
          el('div', { class: 'field-hint' }, 'Square PNG or JPG. Shown on Teams, Players, and Roster.'),
          el('button', {
            class: 'btn sm',
            style: 'margin-top:8px;',
            onclick: async () => {
              const saved = await uploadTeamLogo(hub.team);
              if (!saved) return;
              await hub.refreshShell();
              hub.go('settings');
            },
          }, hub.team.logo ? 'Change Logo' : 'Upload Logo'),
        ]),
      ]),
      el('div', { class: 'grid cols-2' }, [
        el('div', {}, [el('label', { class: 'field-label' }, 'Team name'), name]),
        el('div', {}, [el('label', { class: 'field-label' }, 'Tag'), tag]),
      ]),
      status,
      el('div', { style: 'margin-top:12px;' }, [
        el(
          'button',
          {
            class: 'btn primary sm',
            onclick: async () => {
              if (!name.value.trim()) {
                status.textContent = 'Team name cannot be empty.';
                status.style.color = 'var(--loss)';
                return;
              }
              await window.cci.saveTeam({ ...hub.team, name: name.value.trim(), tag: tag.value.trim() });
              status.textContent = 'Saved. Reopening the hub with the new name.';
              status.style.color = '';
              hub.go('settings');
            },
          },
          'Save Changes'
        ),
      ]),
    ])
  );

  root.append(
    el('div', { class: 'card', style: 'margin-bottom:14px;' }, [
      el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, 'Stored for this team')]),
      el('div', { class: 'kpi-row' }, [
        stat('Members', members.length),
        stat('Strats', strats.length),
        stat('Matches', matches.length),
        stat('Notes', notes.length),
        stat('Tasks', tasks.length),
      ]),
      el('div', { class: 'field-hint', style: 'margin-top:10px;' }, `Team ID: ${hub.team.id}`),
    ])
  );

  root.append(
    el('div', { class: 'card' }, [
      miniEmpty(
        'Roster lives on the Players page',
        'Add, edit, or remove members under Analytics → Players. Team name and logo stay here and on Teams.',
        el('button', { class: 'btn subtle sm', onclick: () => hub.navigate('players') }, 'Open Players')
      ),
    ])
  );
}

function stat(label, value) {
  return el('div', { class: 'kpi static' }, [
    el('div', { class: 'kpi-label' }, label),
    el('div', { class: 'kpi-value' }, String(value)),
  ]);
}
