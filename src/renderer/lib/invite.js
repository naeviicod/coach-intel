import { el } from '../utils.js';
import { openModal, toast } from '../components/modal.js';
import { ROLE_LABELS } from './access.js';

export const ACCESS_ROLES = [
  { value: 'user', label: 'Player', hint: 'Analytics + Team Hub, only their team.' },
  { value: 'free_agent', label: 'Free Agent', hint: 'Stays in the org without a starting lineup slot.' },
  { value: 'team_leader', label: 'Team leader', hint: 'Sees everything. Read-only except adding, editing, and removing players on their own team.' },
  { value: 'coach', label: 'Coach', hint: 'Full staff access across the org.' },
  { value: 'analyst', label: 'Analyst', hint: 'Analytics only, across the org.' },
  { value: 'creative', label: 'Creative', hint: 'Team Hub + member directory, their team. For artists, designers, and content.' },
  { value: 'admin', label: 'Admin', hint: 'Sees everything across the org.' },
  { value: 'developer', label: 'Developer', hint: 'Builds Coach Intel. Same pages as Admin — below Org owner.' },
  { value: 'owner', label: 'Org owner', hint: 'Every org right. Cannot remove or demote Super Admin.' },
];

export function suggestedAccessRole(member) {
  const title = String(member?.title || '').toLowerCase();
  if (/\borg\s*owner\b|\bowner\b/.test(title) && !/team/.test(title)) return 'owner';
  if (/\badmin\b|\bgeneral\s*manager\b|\bgm\b/.test(title)) return 'admin';
  if (member?.slot === 'fa' || /free\s*agent|\bf\/?a\b/.test(title)) return 'free_agent';
  if (/team\s*leader|team\s*manager/.test(title)) return 'team_leader';
  if (/head\s*coach|\bcoach\b/.test(title)) return 'coach';
  if (/analyst/.test(title)) return 'analyst';
  if (/artist|graphic|designer|content|social|video\s*editor/.test(title)) return 'creative';
  return 'user';
}

export function accessRoleLabel(role) {
  return ACCESS_ROLES.find((item) => item.value === role)?.label
    || ROLE_LABELS[role]
    || 'Player';
}

const INVITE_SITE = 'https://coach.championshipseries.eu';

export function inviteeSlug(gamertag) {
  const slug = String(gamertag || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return slug || 'player';
}

export function inviteUrl(token, gamertag) {
  const t = String(token || '').trim();
  if (!t) return `${INVITE_SITE}/join`;
  if (!gamertag) return `${INVITE_SITE}/join/${t}`;
  return `${INVITE_SITE}/join/${inviteeSlug(gamertag)}/${t}`;
}

export function openInviteModal(ctx, teamId, member, { onDone } = {}) {
  const suggested = suggestedAccessRole(member);
  const body = el('div', { class: 'invite-sheet' }, [
    el('h3', {}, `Invite ${member.gamertag}`),
    el('p', { class: 'field-hint invite-sheet-lead' },
      'Website join link with their gamertag on it. They sign in with Discord in a browser — no desktop install. Org owner gets every org right except Super Admin.'),
    el('div', { class: 'invite-status', id: 'invite-status' }, 'Loading…'),
    el('div', { class: 'field' }, [
      el('label', {}, 'Access in Coach Intel'),
      el(
        'div',
        { class: 'invite-role-grid', id: 'invite-role-grid' },
        ACCESS_ROLES.map((role) =>
          el('button', {
            type: 'button',
            class: `invite-role-card${role.value === suggested ? ' active' : ''}${role.value === 'owner' ? ' owner' : ''}`,
            'data-role': role.value,
            onclick: (e) => {
              body.querySelectorAll('.invite-role-card').forEach((card) => card.classList.remove('active'));
              e.currentTarget.classList.add('active');
              roleSelect.value = role.value;
            },
          }, [
            el('strong', {}, role.label),
            el('span', {}, role.hint),
          ])
        )
      ),
      el(
        'select',
        { id: 'invite-role', class: 'invite-role-select' },
        ACCESS_ROLES.map((role) =>
          el('option', {
            value: role.value,
            selected: role.value === suggested ? 'selected' : null,
          }, `${role.label} — ${role.hint}`)
        )
      ),
    ]),
    el('div', { class: 'field' }, [
      el('label', { for: 'invite-email' }, 'Their email (optional)'),
      el('input', {
        type: 'email',
        id: 'invite-email',
        placeholder: 'xx@gmail.com',
        autocomplete: 'off',
      }),
      el('div', { class: 'field-hint' }, 'Not shown on the join page. The page greets them by their gamertag from the roster.'),
    ]),
    el('div', { class: 'field', id: 'invite-link-field', style: 'display:none;' }, [
      el('label', {}, 'Invite link'),
      el('input', { type: 'text', id: 'invite-link', readonly: 'readonly' }),
      el('div', { class: 'field-hint' }, 'Send it in Discord. It looks like coach.championshipseries.eu/join/bracke/… — they open it in a browser, no desktop app.'),
    ]),
  ]);
  const overlay = openModal(body, { width: '560px' });

  const statusEl = body.querySelector('#invite-status');
  const linkField = body.querySelector('#invite-link-field');
  const linkInput = body.querySelector('#invite-link');
  const roleSelect = body.querySelector('#invite-role');

  const paintStatus = async () => {
    const result = await window.cci.invites.status(teamId, member.id);
    if (!result?.ok) {
      statusEl.textContent = result?.error || 'Could not load invite status.';
      return result;
    }
    const { linked, invite } = result.data || {};
    if (linked?.discord_username || linked?.id) {
      statusEl.textContent = `Linked to Discord: ${linked.discord_username || linked.id}${linked.role ? ` · ${accessRoleLabel(linked.role)}` : ''}`;
    } else if (invite) {
      statusEl.textContent = `Open invite (${accessRoleLabel(invite.access_role)}) — expires ${fmtExpiry(invite.expires_at)}.`;
      linkField.style.display = '';
      linkInput.value = invite.url;
      roleSelect.value = invite.access_role;
      body.querySelectorAll('.invite-role-card').forEach((card) => {
        card.classList.toggle('active', card.getAttribute('data-role') === invite.access_role);
      });
    } else {
      statusEl.textContent = 'Not invited yet.';
    }
    return result;
  };

  const actions = el('div', { class: 'modal-actions' }, [
    el('button', { class: 'btn subtle', type: 'button', onclick: () => overlay.remove() }, 'Close'),
    el('button', {
      class: 'btn subtle',
      type: 'button',
      onclick: async () => {
        const result = await window.cci.invites.revoke(teamId, member.id);
        if (!result?.ok) return toast(result?.error || 'Could not revoke.', 'error');
        linkField.style.display = 'none';
        toast('Invite revoked and Discord unlinked.');
        await paintStatus();
        onDone?.();
      },
    }, 'Revoke'),
    el('button', {
      class: 'btn primary',
      type: 'button',
      onclick: async () => {
        const result = await window.cci.invites.create({
          teamId,
          memberId: member.id,
          accessRole: roleSelect.value,
          email: body.querySelector('#invite-email')?.value,
        });
        if (!result?.ok) return toast(result?.error || 'Could not create the invite.', 'error');
        const url = result.data.url;
        linkField.style.display = '';
        linkInput.value = url;
        await window.cci.copyText(url);
        toast('Invite link copied.');
        await paintStatus();
        onDone?.();
      },
    }, 'Copy invite link'),
  ]);
  body.append(actions);
  paintStatus();
}

function fmtExpiry(iso) {
  if (!iso) return 'in 14 days';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'in 14 days';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
