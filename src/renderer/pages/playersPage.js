import { el, playerAvatar, roleBadge, statsForMember, aggregate, teamMark, verifiedMark, icon } from '../utils.js';
import { openMemberModal, openTransferModal, changeMemberPhoto } from '../lib/teamManage.js';
import { defaultSlot, isStaffMember, isFreeAgent, nextLineupSlot, splitRoster, memberOrgGroup } from '../lib/roster.js';
import { isNaevii, memberStaffTitle, orgTitles, memberDiscordVerified } from '../lib/profile.js';
import { openInviteModal } from '../lib/invite.js';
import { toast } from '../components/modal.js';

const ORG_GROUPS = {
  staff: { title: 'Staff', kicker: 'Org group', meta: 'Analysts, creatives, and org staff', icon: 'database' },
  coaches: { title: 'Coaches', kicker: 'Org group', meta: 'Coaching staff across the org', icon: 'scouting' },
  admins: { title: 'Admins', kicker: 'Org group', meta: 'Org owner, Super Admin, and org admins', icon: 'settings' },
  fa: { title: 'Free Agents', kicker: 'Org group', meta: 'In the org, not on a starting lineup', icon: 'players' },
};

function groupMeta(members) {
  const { starters, bench, staff, freeAgents } = splitRoster(members);
  return lineupMeta(starters.length, bench.length, staff.length, freeAgents.length);
}

export async function render(container, ctx) {
  const teams = ctx.teams?.length ? ctx.teams : await window.cci.getTeams();
  const group = String(ctx.param || '');
  const manageFor = (teamId) => (ctx.canEditTeam ? ctx.canEditTeam(teamId) : ctx.canEdit);

  container.append(
    el('div', { class: 'page-header' }, [
      el('div', {}, [
        el('div', { class: 'page-title' }, 'Members'),
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

  async function packTeam(team, { withMatches, repair }) {
    const [rawMembers, matches] = await Promise.all([
      window.cci.getMembers(team.id),
      withMatches ? window.cci.getMatches(team.id) : Promise.resolve([]),
    ]);
    const members = repair
      ? await repairPlayingNaevii(team.id, rawMembers, manageFor(team.id))
      : rawMembers;
    return { team, members, matches };
  }

  if (!group) {
    const packed = await Promise.all(teams.map((team) => packTeam(team, { withMatches: false, repair: false })));
    const orgRows = packed.flatMap(({ team, members }) => members.map((member) => ({ member, team })));
    const orgOf = (key) => orgRows.filter((row) => memberOrgGroup(row.member) === key);
    container.append(el('div', { class: 'player-group-board' }, [
      el('div', { class: 'player-group-block' }, [
        el('div', { class: 'player-group-label' }, 'Rosters'),
        el('div', { class: 'player-group-grid' }, packed.map(({ team, members }) =>
          groupTile(ctx, `team-${team.id}`, team.tag || 'Team', `${team.name} Roster`, groupMeta(members), members.length, team)
        )),
      ]),
      el('div', { class: 'player-group-block' }, [
        el('div', { class: 'player-group-label' }, 'Organization'),
        el('div', { class: 'player-group-grid' }, Object.entries(ORG_GROUPS).map(([key, info]) =>
          groupTile(ctx, key, info.kicker, info.title, info.meta, orgOf(key).length, null, info.icon)
        )),
      ]),
    ]));
    return;
  }

  if (group.startsWith('team-')) {
    const teamId = group.slice(5);
    const team = teams.find((row) => row.id === teamId);
    if (!team) {
      ctx.navigate('players');
      return;
    }
    const pack = await packTeam(team, { withMatches: true, repair: true });
    container.append(rosterCard(pack.team, pack.members, pack.matches, ctx, teams));
    return;
  }

  const packed = await Promise.all(teams.map((team) => packTeam(team, { withMatches: true, repair: true })));
  const orgRows = packed.flatMap(({ team, members, matches }) =>
    members.map((member) => ({ member, team, matches }))
  );
  const rows = orgRows.filter((row) => memberOrgGroup(row.member) === group);
  const anyManage = rows.some((row) => manageFor(row.team.id));
  const card = el('div', { class: `card section${anyManage ? ' roster-manage' : ''}` }, [
    el('div', { class: 'card-head' }, [
      el('div', { class: 'card-title' }, ORG_GROUPS[group]?.title || 'Group'),
      el('div', { class: 'card-meta' }, String(rows.length)),
    ]),
  ]);
  if (!rows.length) {
    card.append(el('div', { class: 'field-hint' }, 'Nobody in this group yet. Add a member and set their slot or title.'));
  } else {
    for (const row of rows) {
      card.append(memberRow(row.member, row.team, row.matches, ctx, {
        manage: manageFor(row.team.id),
        canTransfer: Boolean(ctx.canTransfer),
      }));
    }
  }
  container.append(card);
}

function groupTile(ctx, key, kicker, title, meta, count, team, iconName) {
  return el('button', {
    type: 'button',
    class: 'card player-group-card',
    onclick: () => ctx.navigate('players', key),
  }, [
    team
      ? teamMark(team, { class: 'team-logo lg' })
      : el('div', { class: 'player-group-mark' }, [
          el('span', { class: 'icon', html: icon(iconName || 'players', 22) }),
        ]),
    el('div', { class: 'player-group-copy' }, [
      kicker ? el('div', { class: 'player-group-kicker' }, kicker) : null,
      el('div', { class: 'team-identity-name' }, title),
      el('div', { class: 'team-meta' }, meta),
    ]),
    el('div', { class: 'player-group-count' }, String(count)),
  ]);
}

function rosterCard(team, members, matches, ctx, teams) {
  const { starters, bench, staff, freeAgents } = splitRoster(members);
  const playing = starters.length + bench.length;
  const manage = ctx.canEditTeam ? ctx.canEditTeam(team.id) : ctx.canEdit;
  const canTransfer = Boolean(ctx.canTransfer);
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
      el('div', { class: 'edit-only roster-header-actions' }, [
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

function actionSlot(child) {
  if (!child) return null;
  return el('span', { class: 'row-action-slot' }, [child]);
}

function memberRow(member, team, matches, ctx, { manage, canTransfer } = {}) {
  const totals = aggregate(statsForMember(matches, member.id));
  const av = playerAvatar(member);
  if (manage) {
    av.classList.add('avatar-action');
    av.title = `Change ${member.gamertag || 'player'} photo`;
    av.setAttribute('role', 'button');
    av.tabIndex = 0;
    av.addEventListener('click', (e) => {
      e.stopPropagation();
      changeMemberPhoto(ctx, team.id, member, av);
    });
    av.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      changeMemberPhoto(ctx, team.id, member, av);
    });
  }
  const onBench = member.slot === 'bench';
  const staff = isStaffMember(member);
  const orgRole = memberStaffTitle(member);
  const titles = orgTitles(member).filter((t) => !/^player$/i.test(t));
  const protectedPerson = isNaevii(member.gamertag) || isNaevii(member.name);
  return el('div', { class: 'roster-block' }, [
    el('div', { class: 'roster-row' }, [
    manage
      ? el('input', {
          type: 'checkbox',
          class: 'roster-check',
          'data-member-id': member.id,
          title: `Select ${member.gamertag}`,
        })
      : null,
    av,
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
    el('div', { class: 'roster-tags' }, [
      ...titles.map((t) => el('span', { class: `role-badge org ${String(t).replace(/\s+/g, '-')}` }, t)),
      staff ? null : roleBadge(member.role),
      staff || isFreeAgent(member) ? el('span', { class: 'pill' }, staff ? 'Staff' : 'F/A') : el('span', { class: 'pill', 'data-slot-pill': '1', hidden: onBench ? null : 'hidden' }, 'Bench'),
    ]),
    el('span', { class: 'roster-pipe', 'aria-hidden': 'true' }, '|'),
    el('div', { class: 'crow-meta roster-kd' }, totals.matches ? `${totals.kd} K/D` : '—'),
    el('span', { class: 'roster-pipe', 'aria-hidden': 'true' }, '|'),
    el('div', { class: 'row-actions edit-only' }, [
      actionSlot(staff || isFreeAgent(member) ? null : el('button', {
        class: 'btn sm',
        'data-slot-toggle': '1',
        onclick: (e) => toggleSlot(ctx, team.id, member, e.currentTarget.closest('.roster-row')),
      }, onBench ? 'Start' : 'Bench')),
      actionSlot(el('button', { class: 'btn sm', onclick: () => openMemberModal(ctx, team.id, member) }, 'Edit')),
      actionSlot(canTransfer
        ? el('button', {
          class: 'btn sm',
          onclick: () => openTransferModal(ctx, team, member),
        }, 'Transfer')
        : null),
      actionSlot(memberDiscordVerified(member)
        ? null
        : el('button', {
        class: 'btn sm',
        onclick: () => openInviteModal(ctx, team.id, member),
      }, 'Invite')),
      actionSlot(protectedPerson
        ? null
        : el('button', {
          class: 'btn sm danger',
          onclick: async () => {
            if (!confirm(`Remove ${member.gamertag} from ${team.name}?`)) return;
            try {
              await window.cci.deleteMember(team.id, member.id);
              ctx.navigate('players');
            } catch (err) {
              toast(err?.message || 'Could not remove that person.', 'error');
            }
          },
        }, 'Remove')),
    ].filter(Boolean)),
    ]),
  ]);
}

function groupTitle(slot) {
  return slot === 'bench' ? 'Backup / Bench' : 'Starting lineup';
}

function applyRowSlot(row, member) {
  const onBench = member.slot === 'bench';
  const btn = row.querySelector('[data-slot-toggle]');
  if (btn) btn.textContent = onBench ? 'Start' : 'Bench';
  const pill = row.querySelector('[data-slot-pill]');
  if (pill) {
    pill.hidden = !onBench;
    pill.textContent = onBench ? 'Bench' : '';
  }
}

function bumpGroupMeta(card, fromSlot, toSlot) {
  const titles = [...(card?.querySelectorAll('.card-head .card-title') || [])];
  const bump = (title, delta) => {
    const meta = titles.find((node) => node.textContent === title)?.closest('.card-head')?.querySelector('.card-meta');
    if (!meta) return;
    meta.textContent = String(Math.max(0, Number(meta.textContent || 0) + delta));
  };
  bump(groupTitle(fromSlot), -1);
  bump(groupTitle(toSlot), 1);
}

function moveRowToGroup(row, slot) {
  const block = row.closest('.roster-block') || row;
  const card = block.closest('.card');
  if (!card) return;
  const head = [...card.querySelectorAll('.card-head .card-title')]
    .find((node) => node.textContent === groupTitle(slot))
    ?.closest('.card-head');
  if (!head) return;
  let insertAfter = head;
  let next = head.nextElementSibling;
  if (next?.classList.contains('field-hint')) {
    next.hidden = true;
    next = next.nextElementSibling;
  }
  while (next && (next.classList.contains('roster-row') || next.classList.contains('roster-block'))) {
    insertAfter = next;
    next = next.nextElementSibling;
  }
  insertAfter.after(block);
}

function toggleSlot(ctx, teamId, member, row) {
  const previous = member.slot;
  const next = nextLineupSlot(previous);
  const card = row?.closest('.card');
  member.slot = next;
  applyRowSlot(row, member);
  moveRowToGroup(row, next);
  bumpGroupMeta(card, previous, next);
  window.cci.saveMember(teamId, {
    ...member,
    linked: undefined,
    slot: next,
  }).catch((err) => {
    member.slot = previous;
    applyRowSlot(row, member);
    moveRowToGroup(row, previous);
    bumpGroupMeta(card, next, previous);
    toast(err?.message || 'Could not update lineup.', 'error');
  });
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
