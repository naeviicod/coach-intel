import { el, initials } from '../../../utils.js';
import { ASSIGNABLE_ROLES, ROLE_LABELS, canEdit, resolveAccessRole } from '../../../lib/access.js';

export async function render(panel, ctx) {
  const authState = await window.cci.auth.getState();
  if (!authState.configured) {
    panel.append(
      el('div', { class: 'card section' }, [
        el('div', { class: 'section-title' }, 'Team Access'),
        el('div', { class: 'field-hint' }, 'Supabase is not configured yet — nothing to show here.'),
      ])
    );
    return;
  }

  const result = await window.cci.auth.listProfiles();
  if (!result.ok) {
    panel.append(
      el('div', { class: 'card inline-error' }, [
        el('div', { class: 'inline-error-title' }, 'Could not load the roster'),
        el('div', {}, result.error || 'Unknown error.'),
      ])
    );
    return;
  }

  const { profiles, me, linkedNames } = result.data;
  const myRole = resolveAccessRole(me, { names: linkedNames });
  const canEditRoles = Boolean(me && canEdit(myRole) && (myRole === 'owner' || myRole === 'admin' || myRole === 'developer'));

  const card = el('div', { class: 'card section' }, [
    el('div', { class: 'section-title' }, 'Who can sign in'),
    el(
      'div',
      { class: 'field-hint', style: 'margin-bottom:10px;' },
      'Everyone who has signed in to Coach Intel with Discord, and their access. Invite from Players — the link is coach.championshipseries.eu/join/… and opens the website. Team leaders see everything and may only add, edit, or remove players on their own team. Only org owners, admins, and developers can transfer players between teams.'
    ),
  ]);

  if (!profiles.length) card.append(el('div', { class: 'field-hint' }, 'Nobody has signed in yet.'));

  for (const person of profiles) {
    const isSelf = person.id === me?.id;
    const roleControl =
      canEditRoles && !isSelf
        ? el(
            'select',
            {
              onchange: async (e) => {
                const res = await window.cci.auth.updateRole(person.id, e.target.value);
                if (!res.ok) alert(res.error || 'Could not update role.');
                ctx.reload();
              },
            },
            ASSIGNABLE_ROLES.map((r) =>
              el('option', {
                value: r,
                selected: (person.role === 'member' ? 'user' : person.role) === r ? 'selected' : null,
              }, ROLE_LABELS[r] || r)
            )
          )
        : el('span', { class: 'role-badge' }, ROLE_LABELS[person.role] || person.role);

    card.append(
      el('div', { class: 'list-item-row' }, [
        el('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
          el('div', { class: 'avatar', style: 'width:32px;height:32px;' }, initials(person.discord_username || '?')),
          el('div', {}, [
            el('div', { class: 'settings-row-title' }, person.discord_username || 'Unknown Discord user'),
            isSelf ? el('div', { class: 'field-hint' }, 'You') : null,
          ]),
        ]),
        roleControl,
      ])
    );
  }
  panel.append(card);
}
