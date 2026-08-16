import { el } from '../utils.js';
import { openModal } from '../components/modal.js';

export const ROLES = ['IGL', 'AR', 'SMG', 'Sniper', 'Flex', 'Main Sub', 'Main AR'];

export async function uploadTeamLogo(team) {
  const src = await window.cci.pickImage();
  if (!src || !team?.id) return null;
  const ext = String(src.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const rel = await window.cci.copyImage(src, `org/logos/teams/${team.id}.${ext}`);
  return window.cci.saveTeam({ ...team, logo: rel });
}

export function openTeamModal(ctx, team, { onSaved } = {}) {
  const isEdit = Boolean(team);
  const body = el('div', {}, [
    el('h3', {}, isEdit ? `Edit ${team.name}` : 'Add Team'),
    el('div', { class: 'field' }, [
      el('label', { for: 'team-name' }, 'Team Name'),
      el('input', { type: 'text', id: 'team-name', value: team?.name || '', autofocus: true }),
    ]),
    el('div', { class: 'field' }, [
      el('label', { for: 'team-tag' }, 'Tag / Abbreviation'),
      el('input', { type: 'text', id: 'team-tag', value: team?.tag || '', placeholder: 'e.g. ROM' }),
      el('div', { class: 'field-hint' }, 'Short mark shown next to the team name.'),
    ]),
  ]);
  const overlay = openModal(body);
  body.append(
    el('div', { class: 'modal-actions' }, [
      el('button', { class: 'btn subtle', onclick: () => overlay.remove() }, 'Cancel'),
      el('button', {
        class: 'btn primary',
        onclick: async () => {
          const name = body.querySelector('#team-name').value.trim();
          if (!name) return;
          const saved = await window.cci.saveTeam({
            id: team?.id,
            name,
            tag: body.querySelector('#team-tag').value.trim() || null,
            logo: team?.logo || null,
          });
          overlay.remove();
          await ctx.refreshShell();
          if (onSaved) onSaved(saved);
          else ctx.navigate('teams');
        },
      }, 'Save'),
    ])
  );
}

export function openMemberModal(ctx, teamId, member, { onSaved } = {}) {
  const isEdit = Boolean(member);
  const body = el('div', {}, [
    el('h3', {}, isEdit ? `Edit ${member.gamertag}` : 'Add Player'),
    el('div', { class: 'inline-fields' }, [
      el('div', { class: 'field' }, [
        el('label', { for: 'member-gamertag' }, 'Gamertag'),
        el('input', { type: 'text', id: 'member-gamertag', value: member?.gamertag || '' }),
      ]),
      el('div', { class: 'field' }, [
        el('label', { for: 'member-name' }, 'Display Name'),
        el('input', { type: 'text', id: 'member-name', value: member?.name || '' }),
      ]),
    ]),
    el('div', { class: 'field' }, [
      el('label', { for: 'member-role' }, 'Role'),
      el(
        'select',
        { id: 'member-role' },
        ROLES.map((r) => el('option', { value: r, selected: member?.role === r ? 'selected' : null }, r))
      ),
      el('div', { class: 'field-hint' }, 'Shown on the Players page and Team Hub roster.'),
    ]),
    el('div', { class: 'field' }, [
      el('label', { for: 'member-aliases' }, 'OCR Aliases (comma-separated)'),
      el('input', { type: 'text', id: 'member-aliases', value: (member?.aliases || []).join(', ') }),
      el('div', { class: 'field-hint' }, 'Common OCR misreads of this gamertag, so stats still attribute correctly.'),
    ]),
  ]);
  const overlay = openModal(body);
  body.append(
    el('div', { class: 'modal-actions' }, [
      el('button', { class: 'btn subtle', onclick: () => overlay.remove() }, 'Cancel'),
      el('button', {
        class: 'btn primary',
        onclick: async () => {
          const gamertag = body.querySelector('#member-gamertag').value.trim();
          if (!gamertag) return;
          const name = body.querySelector('#member-name').value.trim();
          const saved = await window.cci.saveMember(teamId, {
            id: member?.id,
            gamertag,
            name: name || gamertag,
            role: body.querySelector('#member-role').value,
            aliases: body
              .querySelector('#member-aliases')
              .value.split(',')
              .map((a) => a.trim())
              .filter(Boolean),
            photo: member?.photo || null,
          });
          overlay.remove();
          if (onSaved) onSaved(saved);
          else ctx.navigate('players');
        },
      }, 'Save'),
    ])
  );
}
