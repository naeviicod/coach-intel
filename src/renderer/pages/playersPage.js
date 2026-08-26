import { el, playerAvatar, roleBadge, statsForMember, aggregate, teamMark, verifiedMark } from '../utils.js';
import { openMemberModal, openTransferModal } from '../lib/teamManage.js';
import { defaultSlot, isStaffMember, nextLineupSlot, splitRoster } from '../lib/roster.js';
import { isNaevii, memberStaffTitle, orgTitles, memberDiscordVerified } from '../lib/profile.js';
import { openInviteModal } from '../lib/invite.js';
import { toast } from '../components/modal.js';

export async function render(container, ctx) {
  const teams = await window.cci.getTeams();

  container.append(
    el('div', { class: 'page-header' }, [
      el('div', {}, [
        el('div', { class: 'page-title' }, 'Players'),
        el('div', { class: 'page-subtitle' }, ctx.canEdit ? 'Players, staff, and creatives. Invite copies a personal join link with that player\'s gamertag on it.' : 'Members across the organization'),
      ]),
    ])
  );

  if (!teams.length) {
    container.append(el('div', { class: 'card empty-state' }, [
      el('div', { class: 'title' }, 'No teams yet'),
      el('div', {}, 'Create a team on the Teams page, then add players here.'),
      el('button', { class: 'btn primary', style: 'margin-top:14px;', onclick: () => ctx.navigate('teams') }, 'Go to Teams'),
    ]));
    return;
  }

  for (const team of teams) {
    const [rawMembers, matches] = await Promise.all([window.cci.getMembers(team.id), window.cci.getMatches(team.id)]);
    const members = await repairPlayingNaevii(team.id, rawMembers, ctx.canEditTeam ? ctx.canEditTeam(team.id) : ctx.canEdit);
    container.append(rosterCard(team, members, matches, ctx, teams));
  }
}

function rosterCard(team, members, matches, ctx, teams) {
  const { starters, bench, staff } = splitRoster(members);
  const playing = starters.length + bench.length;
  const manage = ctx.canEditTeam ? ctx.canEditTeam(team.id) : ctx.canEdit;
  const canTransfer = Boolean(ctx.canTransfer) && (teams || []).some((t) => t.id !== team.id);
  const transferSelected = el('button', {
    class: 'btn primary',
    onclick: () => {
      if (!(teams || []).some((t) => t.id !== team.id)) {
        toast('Add another team first, then you can transfer players.');
        return;
      }
      const picked = selectedMembers(card, members);
      if (!picked.length) {
        toast('Select one or more players to transfer.');
        return;
      }
      openTransferModal(ctx, team, picked);
    },
  }, 'Transfer selected');

  const card = el('div', { class: `card section${manage ? '' : ' team-readonly'}` }, [
    el('div', { class: 'team-identity', style: 'margin-bottom:16px;' }, [
      teamMark(team, { class: 'team-logo lg' }),
      el('div', { style: 'min-width:0;flex:1;' }, [
        el('div', { class: 'team-identity-kicker' }, team.tag ? `${team.tag} roster` : 'Team roster'),
        el('div', { class: 'team-identity-name' }, `${team.name} Roster`),
        el('div', { class: 'team-meta' }, lineupMeta(starters.length, bench.length, staff.length)),
      ]),
      el('div', { class: 'edit-only', style: 'display:flex;gap:8px;flex-wrap:wrap;' }, [
        el('button', {
          class: 'btn primary',
          onclick: () => openMemberModal(ctx, team.id, null, { slot: defaultSlot(members) }),
        }, '+ Add Player'),
        canTransfer ? transferSelected : null,
      ]),
    ]),
  ]);

  card.addEventListener('change', (e) => {
    if (!e.target.classList.contains('roster-check')) return;
    const n = card.querySelectorAll('.roster-check:checked').length;
    transferSelected.textContent = n ? `Transfer selected (${n})` : 'Transfer selected';
  });

  if (!members.length) {
    card.append(el('div', { class: 'field-hint' }, 'No members yet. Add a player to this roster.'));
    return card;
  }

  appendGroup(card, 'Starting lineup', starters, team, matches, ctx, { empty: 'No starters yet. Add a player or promote someone from the bench.', manage, canTransfer });
  appendGroup(card, 'Backup / Bench', bench, team, matches, ctx, {
    empty: playing >= 4 ? 'No bench yet. Add a backup for when someone sits.' : null,
    manage,
    canTransfer,
  });
  appendGroup(card, 'Staff & Org', staff, team, matches, ctx, {
    empty: 'No staff yet. Add a coach, analyst, artist, or other org member.',
    manage,
    canTransfer,
  });

  return card;
}

function lineupMeta(starters, bench, staff) {
  const bits = [`${starters} starter${starters === 1 ? '' : 's'}`];
  if (bench) bits.push(`${bench} bench`);
  if (staff) bits.push(`${staff} staff`);
  return bits.join(' · ');
}

function selectedMembers(card, members) {
  const ids = new Set(
    [...card.querySelectorAll('.roster-check:checked')].map((node) => node.getAttribute('data-member-id'))
  );
  return members.filter((m) => ids.has(m.id));
}

function appendGroup(card, title, members, team, matches, ctx, { empty, manage, canTransfer } = {}) {
  if (!members.length && !empty) return;
  card.append(el('div', { class: 'card-head', style: 'padding:8px 0 6px;' }, [
    el('div', { class: 'card-title' }, title),
    el('div', { class: 'card-meta' }, String(members.length)),
  ]));
  if (!members.length) {
    card.append(el('div', { class: 'field-hint', style: 'padding:4px 0 12px;' }, empty));
    return;
  }
  for (const member of members) card.append(memberRow(member, team, matches, ctx, { manage, canTransfer }));
}

function memberRow(member, team, matches, ctx, { manage, canTransfer } = {}) {
  const totals = aggregate(statsForMember(matches, member.id));
  const onBench = member.slot === 'bench';
  const staff = isStaffMember(member);
  const orgRole = memberStaffTitle(member);
  const titles = orgTitles(member).filter((t) => !/^player$/i.test(t));
  return el('div', { class: 'roster-row' }, [
    manage
      ? el('input', {
          type: 'checkbox',
          class: 'roster-check',
          'data-member-id': member.id,
          title: `Select ${member.gamertag}`,
        })
      : null,
    playerAvatar(member),
    el('div', {
      style: 'flex:1;min-width:0;cursor:pointer;',
      onclick: () => ctx.navigate('member', `${team.id}/${member.id}`),
    }, [
      el('div', { class: 'gamertag' }, [
        member.gamertag,
        memberDiscordVerified(member) ? verifiedMark() : null,
      ]),
      (() => {
        const sub = [member.name && member.name !== member.gamertag ? member.name : '', orgRole]
          .filter(Boolean)
          .join(' · ');
        return sub ? el('div', { class: 'member-name' }, sub) : null;
      })(),
    ]),
    ...titles.map((t) => el('span', { class: `role-badge org ${String(t).replace(/\s+/g, '-')}` }, t)),
    staff ? null : roleBadge(member.role),
    staff ? el('span', { class: 'pill' }, 'Staff') : onBench ? el('span', { class: 'pill' }, 'Bench') : null,
    el('div', { class: 'crow-meta', style: 'width:70px;text-align:right;' }, totals.matches ? `${totals.kd} K/D` : '—'),
    el('div', { class: 'row-actions edit-only' }, [
      staff ? null : el('button', {
        class: 'btn sm',
        onclick: () => toggleSlot(ctx, team.id, member),
      }, onBench ? 'Start' : 'Bench'),
      el('button', { class: 'btn sm', onclick: () => openMemberModal(ctx, team.id, member) }, 'Edit'),
      canTransfer
        ? el('button', {
          class: 'btn sm',
          onclick: () => openTransferModal(ctx, team, member),
        }, 'Transfer')
        : null,
      el('button', {
        class: 'btn sm',
        onclick: () => openInviteModal(ctx, team.id, member),
      }, member.linked ? 'Linked' : 'Invite'),
      el('button', {
        class: 'btn sm danger',
        onclick: async () => {
          if (!confirm(`Remove ${member.gamertag} from ${team.name}?`)) return;
          await window.cci.deleteMember(team.id, member.id);
          ctx.navigate('players');
        },
      }, 'Remove'),
    ]),
  ]);
}

async function toggleSlot(ctx, teamId, member) {
  try {
    await window.cci.saveMember(teamId, {
      ...member,
      linked: undefined,
      slot: nextLineupSlot(member.slot),
    });
  } catch (err) {
    toast(err?.message || 'Could not update lineup.', 'error');
  }
  ctx.navigate('players');
}

async function repairPlayingNaevii(teamId, members, canEdit) {
  if (!canEdit) return members;
  return Promise.all(
    (members || []).map(async (member) => {
      if (member.slot !== 'staff') return member;
      if (!isNaevii(member.gamertag) && !isNaevii(member.name)) return member;
      const next = { ...member, slot: 'starter' };
      try {
        return await window.cci.saveMember(teamId, next);
      } catch {
        return next;
      }
    })
  );
}
