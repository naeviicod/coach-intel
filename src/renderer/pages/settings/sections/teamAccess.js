import { el, initials } from '../../../utils.js';

const ROLES = ['owner', 'team_leader', 'coach', 'analyst', 'member'];
const ROLE_LABELS = {
  owner: 'Owner',
  team_leader: 'Team leader',
  coach: 'Coach',
  analyst: 'Analyst',
  member: 'Member',
};

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

  const { profiles, me } = result.data;
  const canEditRoles = Boolean(me && (me.role === 'owner' || me.role === 'team_leader'));

  const card = el('div', { class: 'card section' }, [
    el('div', { class: 'section-title' }, 'Who can sign in'),
    el(
      'div',
      { class: 'field-hint', style: 'margin-bottom:10px;' },
      'Everyone who has signed in to Coach Intel with Discord, and their role. New sign-ins land here automatically.'
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
            ROLES.map((r) =>
              el('option', { value: r, selected: person.role === r ? 'selected' : null }, ROLE_LABELS[r] || r)
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

  panel.append(
    el('div', { class: 'card section' }, [
      el('div', { class: 'section-title' }, 'Session'),
      el(
        'button',
        {
          class: 'btn subtle danger',
          onclick: async () => {
            await window.cci.auth.signOut();
            window.location.reload();
          },
        },
        'Sign out'
      ),
    ])
  );
}
