import { el, playerAvatar, roleBadge, statsForMember, aggregate, teamMark, verifiedMark } from '../utils.js';
import { openMemberModal, openTransferModal } from '../lib/teamManage.js';
import { defaultSlot, isStaffMember, isFreeAgent, nextLineupSlot, splitRoster, memberOrgGroup } from '../lib/roster.js';
import { isNaevii, memberStaffTitle, orgTitles, memberDiscordVerified } from '../lib/profile.js';
import { openInviteModal } from '../lib/invite.js';
import { toast } from '../components/modal.js';

function groupMeta(members) {
  const { starters, bench, staff, freeAgents } = splitRoster(members);
  return lineupMeta(starters.length, bench.length, staff.length, freeAgents.length);
}

export async function render(container, ctx) {
  const teams = await window.cci.getTeams();
  const group = String(ctx.param || '');

  container.append(
    el('div', { class: 'page-header' }, [
      el('div', {}, [
        el('div', { class: 'page-title' }, 'Players'),
        el('div', { class: 'page-subtitle' }, 'Open a team, staff, coaches, admins, or free agents. Invite copies a website join link.'),
      ]),
      group
        ? el('button', { class: 'btn sm', type: 'button', onclick: () => ctx.navigate('players') }, 'All groups')
        : null,
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

  const packed = [];
  for (const team of teams) {
    const [rawMembers, matches] = await Promise.all([window.cci.getMembers(team.id), window.cci.getMatches(team.id)]);
    const members = await repairPlayingNaevii(team.id, rawMembers, ctx.canEditTeam ? ctx.canEditTeam(team.id) : ctx.canEdit);
    packed.push({ team, members, matches });
  }

  const orgRows = packed.flatMap(({ team, members, matches }) =>
    members.map((member) => ({ member, team, matches }))
  );
  const orgOf = (key) => orgRows.filter((row) => memberOrgGroup(row.member) === key);

  if (!group) {
    container.append(el('div', { class: 'player-group-grid' }, [
      ...packed.map(({ team, members }) =>
        groupTile(ctx, `team-${team.id}`, `${team.name} Roster`, groupMeta(members), members.length, team)
      ),
      groupTile(ctx, 'staff', 'Staff', 'Analysts, creatives, and org staff', orgOf('staff').length),
      groupTile(ctx, 'coaches', 'Coaches', 'Coaching staff across the org', orgOf('coaches').length),
      groupTile(ctx, 'admins', 'Admins', 'Owners, admins, and developers', orgOf('admins').length),
      groupTile(ctx, 'fa', 'Free Agents', 'In the org, not on a starting lineup', orgOf('fa').length),
    ]));
    return;
  }

  if (group.startsWith('team-')) {
    const teamId = group.slice(5);
    const pack = packed.find((row) => row.team.id === teamId);
    if (!pack) {
      ctx.navigate('players');
      return;
    }
    container.append(rosterCard(pack.team, pack.members, pack.matches, ctx, teams));
    return;
  }

  const labels = { staff: 'Staff', coaches: 'Coaches', admins: 'Admins', fa: 'Free Agents' };
  const rows = orgOf(group);
  const anyManage = rows.some((row) => (ctx.canEditTeam ? ctx.canEditTeam(row.team.id) : ctx.canEdit));
  const card = el('div', { class: `card section${anyManage ? ' roster-manage' : ''}` }, [
    el('div', { class: 'card-head' }, [
      el('div', { class: 'card-title' }, labels[group] || 'Group'),
      el('div', { class: 'card-meta' }, String(rows.length)),
    ]),
  ]);
  if (!rows.length) {
    card.append(el('div', { class: 'field-hint' }, 'Nobody in this group yet. Add a member and set their slot or title.'));
  } else {
    for (const row of rows) {
      const manage = ctx.canEditTeam ? ctx.canEditTeam(row.team.id) : ctx.canEdit;
      card.append(memberRow(row.member, row.team, row.matches, ctx, {
        manage,
        canTransfer: Boolean(ctx.canTransfer) && teams.some((t) => t.id !== row.team.id),
      }));
    }
  }
  container.append(card);
}

function groupTile(ctx, key, title, meta, count, team) {
  return el('button', {
    type: 'button',
    class: 'card player-group-card',
    onclick: () => ctx.navigate('players', key),
  }, [
    team ? teamMark(team, { class: 'team-logo lg' }) : el('div', { class: 'team-logo lg' }, title.slice(0, 2)),
    el('div', { style: 'min-width:0;flex:1;text-align:left;' }, [
      el('div', { class: 'team-identity-name' }, title),
      el('div', { class: 'team-meta' }, meta),
    ]),
    el('div', { class: 'card-meta' }, String(count)),
  ]);
}

function rosterCard(team, members, matches, ctx, teams) {
  const { starters, bench, staff, freeAgents } = splitRoster(members);
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

  const card = el('div', { class: `card section${manage ? ' roster-manage' : ' team-readonly'}` }, [
    el('div', { class: 'team-identity', style: 'margin-bottom:16px;' }, [
      teamMark(team, { class: 'team-logo lg' }),
      el('div', { style: 'min-width:0;flex:1;' }, [
        el('div', { class: 'team-identity-kicker' }, team.tag ? `${team.tag} roster` : 'Team roster'),
        el('div', { class: 'team-identity-name' }, `${team.name} Roster`),
        el('div', { class: 'team-meta' }, lineupMeta(starters.length, bench.length, staff.length, freeAgents.length)),
      ]),
      el('div', { class: 'edit-only', style: 'display:flex;gap:8px;flex-wrap:wrap;' }, [
        el('button', {
          class: 'btn primary',
          onclick: () => openMemberModal(ctx, team.id, null, { slot: defaultSlot(members) }),
        }, '+ Add Member'),
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
  appendGroup(card, 'Free Agents', freeAgents, team, matches, ctx, {
    empty: 'No free agents on this roster. Add someone who stays in the org off the starting lineup.',
    manage,
    canTransfer,
  });

  return card;
}

function lineupMeta(starters, bench, staff, fa) {
  const bits = [`${starters} starter${starters === 1 ? '' : 's'}`];
  if (bench) bits.push(`${bench} bench`);
  if (staff) bits.push(`${staff} staff`);
  if (fa) bits.push(`${fa} F/A`);
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
    staff || isFreeAgent(member) ? el('span', { class: 'pill' }, staff ? 'Staff' : 'F/A') : onBench ? el('span', { class: 'pill' }, 'Bench') : null,
    el('div', { class: 'crow-meta', style: 'width:70px;text-align:right;' }, totals.matches ? `${totals.kd} K/D` : '—'),
    el('div', { class: 'row-actions edit-only' }, [
      staff || isFreeAgent(member) ? null : el('button', {
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
