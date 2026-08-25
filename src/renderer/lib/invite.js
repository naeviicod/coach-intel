import { el } from '../utils.js';
import { openModal, toast } from '../components/modal.js';
import { ROLE_LABELS } from './access.js';

export const ACCESS_ROLES = [
  { value: 'user', label: 'Player', hint: 'Analytics + Team Hub, only their team.' },
  { value: 'team_leader', label: 'Team leader', hint: 'Can edit their team. Does not see other teams.' },
  { value: 'coach', label: 'Coach', hint: 'Full staff access across the org.' },
  { value: 'analyst', label: 'Analyst', hint: 'Analytics only, across the org.' },
  { value: 'creative', label: 'Creative', hint: 'Team Hub + member directory, their team. For artists, designers, and content.' },
  { value: 'admin', label: 'Admin', hint: 'Sees everything across the org.' },
  { value: 'developer', label: 'Developer', hint: 'Builds/maintains Coach Intel. Full access, same as Admin.' },
  { value: 'owner', label: 'Org owner', hint: 'Full control. Sees every team and every page.' },
];

export function suggestedAccessRole(member) {
  const title = String(member?.title || '').toLowerCase();
  if (/\borg\s*owner\b|\bowner\b/.test(title) && !/team/.test(title)) return 'owner';
  if (/\badmin\b|\bgeneral\s*manager\b|\bgm\b/.test(title)) return 'admin';
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

export function inviteUrl(token) {
  return `${INVITE_SITE}/invite/${String(token || '').trim()}`;
}

export function openInviteModal(ctx, teamId, member, { onDone } = {}) {
  const body = el('div', {}, [
    el('h3', {}, `Invite ${member.gamertag}`),
    el('div', { class: 'field-hint', style: 'margin-bottom:14px;line-height:1.5;' },
      'Creates a one-time link. They open it in a browser, sign in with Discord, and that account is bound to this member — they get the access you pick.'),
    el('div', { class: 'field-hint', id: 'invite-status' }, 'Loading…'),
    el('div', { class: 'field' }, [
      el('label', { for: 'invite-role' }, 'Access in Coach Intel'),
      el(
        'select',
        { id: 'invite-role' },
        ACCESS_ROLES.map((role) =>
          el('option', {
            value: role.value,
            selected: role.value === suggestedAccessRole(member) ? 'selected' : null,
          }, `${role.label} — ${role.hint}`)
        )
      ),
    ]),
    el('div', { class: 'field', id: 'invite-link-field', style: 'display:none;' }, [
      el('label', {}, 'Invite link'),
      el('input', { type: 'text', id: 'invite-link', readonly: 'readonly' }),
      el('div', { class: 'field-hint' }, 'Send it in Discord. They sign in at coach.championshipseries.eu — no desktop app needed.'),
    ]),
  ]);
  const overlay = openModal(body, { width: '520px' });

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
