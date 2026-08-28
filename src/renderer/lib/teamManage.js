import { el, faceMark, comboInput } from '../utils.js';
import { openModal, toast } from '../components/modal.js';
import { HANDLE_FIELDS, TITLE_SUGGESTIONS, memberStaffTitle, normalizeHandles } from './profile.js';
import { defaultSlot, isStaffMember, normalizeSlot, isMemberDisabled } from './roster.js';
import { compressImageFromPath } from './imageUpload.js';

export const ROLES = ['IGL', 'AR', 'SMG', 'Sniper', 'Flex', 'Main Sub', 'Main AR'];

export async function uploadTeamLogo(team) {
  try {
    const src = await window.cci.pickImage();
    if (!src || !team?.id) return null;
    const bytes = await compressImageFromPath(src);
    const rel = await window.cci.writeImageBytes(bytes, `org/logos/teams/${team.id}.webp`);
    if (!rel) throw new Error('Could not copy the logo file.');
    const saved = await window.cci.saveTeam({
      id: team.id,
      name: team.name,
      tag: team.tag ?? null,
      logo: rel,
    });
    if (!saved) throw new Error('Could not save the team logo.');
    return saved;
  } catch (err) {
    console.error('[teams] logo upload failed', err);
    toast(err?.message && !err.message.includes('[object Object]') ? err.message : 'Could not save the team logo.');
    return null;
  }
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
          if (!name) {
            toast('A team name is required', 'error');
            body.querySelector('#team-name').focus();
            return;
          }
          try {
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
          } catch (err) {
            console.error('[teams] save team failed', err);
            toast(err?.message || 'Could not save the team.', 'error');
          }
        },
      }, 'Save'),
    ])
  );
}

function memberSlug(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function memberHeading(isEdit, member, slot) {
  if (isEdit) return `Edit ${member.gamertag}`;
  return { staff: 'Add Org Member', fa: 'Add Free Agent', bench: 'Add Bench Player' }[slot] || 'Add Member';
}

function slotStatus(slot) {
  return { bench: 'Bench', fa: 'Free agent', staff: 'Staff' }[slot] || 'Starter';
}

export function openMemberModal(ctx, teamId, member, { onSaved, slot, teams } = {}) {
  const isEdit = Boolean(member);
  const initialSlot = normalizeSlot(member?.slot || slot);
  const teamChoices = !isEdit && Array.isArray(teams) && teams.length > 1 ? teams : null;
  let photoRel = member?.photo || null;
  let pendingBytes = null;
  const previewHost = el('div', {
    class: 'avatar-action',
    title: 'Change photo',
    role: 'button',
    tabindex: 0,
    onclick: () => body.querySelector('[data-photo-pick]')?.click(),
  });
  const paintPreview = () => {
    previewHost.replaceChildren(faceMark({ photo: photoRel, name: member?.gamertag || member?.name || 'Player', size: 40 }));
  };
  paintPreview();

  const photoPick = {
    class: 'btn subtle sm',
    type: 'button',
    'data-photo-pick': '1',
    onclick: async () => {
      const src = await window.cci.pickImage();
      if (!src) return;
      pendingBytes = await compressImageFromPath(src);
      const id = member?.id || memberSlug(body.querySelector('#member-gamertag').value) || 'player';
      const rel = await window.cci.writeImageBytes(pendingBytes, `org/members/${teamId}/${id}.webp`);
      if (!rel) return;
      photoRel = rel;
      paintPreview();
      const pick = body.querySelector('[data-photo-pick]');
      if (pick) pick.textContent = 'Change photo';
    },
  };

  const handles = member?.handles || {};
  const body = el('div', {}, [
    isEdit
      ? el('div', { class: 'member-edit-id' }, [
          previewHost,
          el('div', { class: 'member-edit-copy' }, [
            el('div', { class: 'gamertag', id: 'member-heading-tag' }, member?.gamertag || 'Player'),
            el('span', { class: 'board-roster-on', id: 'member-heading-slot' }, slotStatus(initialSlot)),
            el('button', photoPick, photoRel ? 'Change photo' : 'Add photo'),
          ]),
        ])
      : el('h3', {}, memberHeading(isEdit, member, initialSlot)),
    teamChoices
      ? el('div', { class: 'field' }, [
          el('label', { for: 'member-team' }, 'Team'),
          el(
            'select',
            { id: 'member-team' },
            teamChoices.map((t) =>
              el('option', { value: t.id, selected: t.id === teamId ? 'selected' : null }, t.name)
            )
          ),
        ])
      : null,
    isEdit
      ? null
      : el('div', { class: 'profile-photo-row' }, [
          previewHost,
          el('div', { style: 'flex:1;' }, [
            el('div', { class: 'settings-row-title' }, 'Player photo'),
            el('div', { class: 'field-hint' }, 'Optional. Shown on the roster and player profile.'),
          ]),
          el('button', photoPick, photoRel ? 'Change photo' : 'Add photo'),
        ]),
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
    el('div', { class: 'inline-fields' }, [
      el('div', { class: 'field' }, [
        el('label', { for: 'member-title' }, 'Org Role'),
        comboInput({
          id: 'member-title',
          value: memberStaffTitle(member) || (initialSlot === 'staff' ? '' : 'Player'),
          placeholder: 'Player, Developer…',
          options: TITLE_SUGGESTIONS,
        }),
        el('div', { class: 'field-hint' }, 'Their job in the org. You can list more than one, comma-separated — Player, Developer.'),
      ]),
      el('div', { class: 'field' }, [
        el('label', { for: 'member-role' }, 'In-game Role'),
        el(
          'select',
          { id: 'member-role' },
          ROLES.map((r) => el('option', { value: r, selected: member?.role === r ? 'selected' : null }, r))
        ),
        el('div', { class: 'field-hint' }, 'For players on the roster. Staff can leave this as Flex.'),
      ]),
    ]),
    el('div', { class: 'inline-fields' }, [
      el('div', { class: 'field' }, [
        el('label', { for: 'member-slot' }, 'Lineup'),
        el('select', { id: 'member-slot' }, [
          el('option', { value: 'starter', selected: initialSlot === 'starter' ? 'selected' : null }, 'Starter'),
          el('option', { value: 'bench', selected: initialSlot === 'bench' ? 'selected' : null }, 'Backup / Bench'),
          el('option', { value: 'fa', selected: initialSlot === 'fa' ? 'selected' : null }, 'Free Agent'),
          el('option', { value: 'staff', selected: initialSlot === 'staff' ? 'selected' : null }, 'Staff / Org'),
        ]),
        el('div', { class: 'field-hint' }, 'Where they sit on this roster. Org roles are separate — a starter can also be a developer or coach.'),
      ]),
    ]),
    el('div', { class: 'field' }, [
      el('label', { for: 'member-aliases' }, 'OCR Aliases (comma-separated)'),
      el('input', { type: 'text', id: 'member-aliases', value: (member?.aliases || []).join(', ') }),
      el('div', { class: 'field-hint' }, 'Common OCR misreads of this gamertag, so stats still attribute correctly.'),
    ]),
    el('label', { class: 'check-row', style: 'margin-top:14px;' }, [
      el('input', {
        type: 'checkbox',
        id: 'member-enabled',
        checked: isMemberDisabled(member) ? null : 'checked',
      }),
      el('span', {}, 'Member is enabled'),
    ]),
    el('div', { class: 'field-hint' }, 'Turn this off to hide them from the roster without deleting. You can enable them again later.'),
    el('div', { class: 'modal-section-title' }, 'Socials & Gaming IDs'),
    el(
      'div',
      { class: 'handle-grid' },
      HANDLE_FIELDS.map((field) =>
        el('div', { class: 'field' }, [
          el('label', { for: `member-handle-${field.key}` }, field.label),
          el('input', {
            type: 'text',
            id: `member-handle-${field.key}`,
            value: handles[field.key] || '',
            placeholder: field.placeholder,
          }),
        ])
      )
    ),
  ]);
  const overlay = openModal(body, { width: '540px' });
  body.append(
    el('div', { class: 'modal-actions' }, [
      el('button', { class: 'btn subtle', onclick: () => overlay.remove() }, 'Cancel'),
      el('button', {
        class: 'btn primary',
        onclick: async () => {
          const gamertag = body.querySelector('#member-gamertag').value.trim();
          if (!gamertag) {
            toast('A gamertag is required', 'error');
            body.querySelector('#member-gamertag').focus();
            return;
          }
          const name = body.querySelector('#member-name').value.trim();
          const collected = {};
          for (const { key } of HANDLE_FIELDS) {
            collected[key] = body.querySelector(`#member-handle-${key}`)?.value || '';
          }
          const enabled = body.querySelector('#member-enabled')?.checked !== false;
          const handles = normalizeHandles(collected);
          if (!enabled) handles._disabled = '1';
          const id = member?.id || memberSlug(gamertag);
          const saveTeamId = teamChoices ? body.querySelector('#member-team').value : teamId;
          if (pendingBytes && id) {
            const rel = await window.cci.writeImageBytes(pendingBytes, `org/members/${saveTeamId}/${id}.webp`);
            if (rel) photoRel = rel;
          }
          try {
            const saved = await window.cci.saveMember(saveTeamId, {
              id: member?.id || id,
              gamertag,
              name: name || gamertag,
              role: body.querySelector('#member-role').value,
              title: body.querySelector('#member-title').value.trim(),
              slot: normalizeSlot(body.querySelector('#member-slot').value),
              aliases: body
                .querySelector('#member-aliases')
                .value.split(',')
                .map((a) => a.trim())
                .filter(Boolean),
              photo: photoRel,
              disabled: !enabled,
              handles,
            });
            overlay.remove();
            if (onSaved) onSaved(saved);
            else ctx.navigate('players');
          } catch (err) {
            console.error('[teams] save member failed', err);
            toast(
              err?.message && !err.message.includes('[object Object]')
                ? err.message
                : 'Could not save the player.'
            );
          }
        },
      }, 'Save'),
    ])
  );
}

export async function changeMemberPhoto(ctx, teamId, member, mark) {
  if (!member?.id) return;
  const src = await window.cci.pickImage();
  if (!src) return;
  const previous = [...mark.childNodes];
  try {
    const bytes = await compressImageFromPath(src);
    const rel = await window.cci.writeImageBytes(bytes, `org/members/${teamId}/${member.id}.webp`);
    if (!rel) throw new Error('Could not copy the photo.');
    const url = window.cci.dataUrlForPath ? await window.cci.dataUrlForPath(rel) : null;
    if (url) mark.replaceChildren(el('img', { src: url, alt: member.gamertag || '' }));
    await window.cci.saveMember(teamId, { ...member, linked: undefined, photo: rel });
  } catch (err) {
    mark.replaceChildren(...previous);
    toast(err?.message || 'Could not save the photo.');
  }
}

function toFileUrl(rawPath) {
  const norm = String(rawPath).replace(/\\/g, '/');
  const withSlash = norm.startsWith('/') ? norm : `/${norm}`;
  return `file://${encodeURI(withSlash)}`;
}

function matchMemberByFilename(base, members) {
  const key = String(base || '').trim().toLowerCase();
  if (!key) return null;
  return members.find((m) => String(m.gamertag || '').trim().toLowerCase() === key) || null;
}

function photoImportRow(row, index, members) {
  const options = [
    el('option', { value: '' }, '— Skip —'),
    ...members.map((m) =>
      el('option', { value: m.id, selected: row.match?.id === m.id ? 'selected' : null }, m.gamertag)
    ),
  ];
  return el('div', { class: 'photo-import-row' }, [
    el('img', { class: 'photo-import-thumb', src: toFileUrl(row.file.path), alt: '' }),
    el('div', { class: 'photo-import-name' }, row.file.base),
    el('select', { id: `photo-import-${index}` }, options),
    row.match
      ? el('span', { class: 'pill match' }, 'Matched')
      : el('span', { class: 'pill nomatch' }, 'No match'),
  ]);
}

// Bulk photo import: pick a folder, match each image's filename to a
// player's gamertag (exact, case-insensitive), let the coach fix any misses,
// then reuse the same copyImage + saveMember path the single-photo upload uses.
export async function openPhotoImportModal(ctx, team, members) {
  const folder = await window.cci.pickImageFolder();
  if (!folder) return;
  const files = await window.cci.listFolderImages(folder);
  if (!files.length) {
    toast('No image files (png/jpg/webp) found in that folder.', 'error');
    return;
  }

  const rows = files.map((file) => ({ file, match: matchMemberByFilename(file.base, members) }));
  const matchedCount = rows.filter((r) => r.match).length;

  const body = el('div', {}, [
    el('h3', {}, `Import Photos — ${team.name}`),
    el(
      'div',
      { class: 'field-hint', style: 'margin-bottom:14px;line-height:1.5;' },
      `${files.length} image${files.length === 1 ? '' : 's'} found. ${matchedCount} matched a gamertag automatically — review and fix the rest below, then import.`
    ),
    el('div', { class: 'photo-import-list' }, rows.map((row, i) => photoImportRow(row, i, members))),
  ]);

  const overlay = openModal(body, { width: '600px' });
  body.append(
    el('div', { class: 'modal-actions' }, [
      el('button', { class: 'btn subtle', type: 'button', onclick: () => overlay.remove() }, 'Cancel'),
      el('button', {
        class: 'btn primary',
        type: 'button',
        onclick: async () => {
          const selections = rows
            .map((row, i) => {
              const memberId = body.querySelector(`#photo-import-${i}`)?.value || '';
              return memberId ? { file: row.file, memberId } : null;
            })
            .filter(Boolean);
          if (!selections.length) {
            toast('Assign at least one photo to a player first.', 'error');
            return;
          }
          let ok = 0;
          let failed = 0;
          for (const { file, memberId } of selections) {
            const member = members.find((m) => m.id === memberId);
            if (!member) { failed++; continue; }
            try {
              const bytes = await compressImageFromPath(file.path);
              const rel = await window.cci.writeImageBytes(bytes, `org/members/${team.id}/${member.id}.webp`);
              if (!rel) { failed++; continue; }
              await window.cci.saveMember(team.id, { ...member, photo: rel });
              ok++;
            } catch (err) {
              console.error('[teams] photo import failed for', member.gamertag, err);
              failed++;
            }
          }
          overlay.remove();
          toast(failed ? `${ok} photo${ok === 1 ? '' : 's'} imported, ${failed} failed.` : `${ok} photo${ok === 1 ? '' : 's'} imported.`);
          ctx.navigate('players');
        },
      }, matchedCount ? `Import (${matchedCount} matched)` : 'Import'),
    ])
  );
}

function arrivalSlot(member, destMembers) {
  if (isStaffMember(member)) return 'staff';
  return defaultSlot(destMembers);
}

export async function openTransferModal(ctx, fromTeam, members, { onDone } = {}) {
  if (ctx && ctx.canTransfer === false) {
    toast('Only org owners, admins, and developers can move players between teams.', 'error');
    return;
  }
  const list = (Array.isArray(members) ? members : [members]).filter((m) => m?.id);
  if (!list.length) return;

  const teams = ((await window.cci.getTeams()) || []).filter((t) => t.id !== fromTeam.id);
  if (!teams.length) {
    toast('Add another team first, then you can transfer players.', 'error');
    return;
  }

  const bulk = list.length > 1;
  const destMembers = await window.cci.getMembers(teams[0].id);
  const initialSlot = list.every(isStaffMember) ? 'staff' : arrivalSlot(list[0], destMembers);

  const body = el('div', {}, [
    el('h3', {}, bulk ? `Transfer ${list.length} players` : `Transfer ${list[0].gamertag}`),
    el(
      'div',
      { class: 'field-hint', style: 'margin-bottom:14px;line-height:1.5;' },
      bulk
        ? `Moves ${list.map((m) => m.gamertag).join(', ')} from ${fromTeam.name}. Match history stays with ${fromTeam.name}. Discord stays linked.`
        : `Moves them from ${fromTeam.name} to another roster. Match history stays with ${fromTeam.name}. Discord stays linked.`
    ),
    el('div', { class: 'field' }, [
      el('label', { for: 'transfer-team' }, 'New team'),
      el(
        'select',
        { id: 'transfer-team' },
        teams.map((t, i) => el('option', { value: t.id, selected: i === 0 ? 'selected' : null }, t.name))
      ),
    ]),
    el('div', { class: 'field' }, [
      el('label', { for: 'transfer-slot' }, 'Lineup on arrival'),
      el('select', { id: 'transfer-slot' }, [
        bulk ? el('option', { value: 'keep', selected: 'selected' }, 'Keep current slot') : null,
        el('option', { value: 'starter', selected: !bulk && initialSlot === 'starter' ? 'selected' : null }, 'Starter'),
        el('option', { value: 'bench', selected: !bulk && initialSlot === 'bench' ? 'selected' : null }, 'Backup / Bench'),
        el('option', { value: 'fa', selected: !bulk && initialSlot === 'fa' ? 'selected' : null }, 'Free Agent'),
        el('option', { value: 'staff', selected: !bulk && initialSlot === 'staff' ? 'selected' : null }, 'Staff / Org'),
      ]),
    ]),
  ]);
  const overlay = openModal(body, { width: '480px' });
  const teamSelect = body.querySelector('#transfer-team');
  const slotSelect = body.querySelector('#transfer-slot');
  if (!bulk) {
    teamSelect.addEventListener('change', async () => {
      const roster = await window.cci.getMembers(teamSelect.value);
      slotSelect.value = arrivalSlot(list[0], roster);
    });
  }

  body.append(
    el('div', { class: 'modal-actions' }, [
      el('button', { class: 'btn subtle', type: 'button', onclick: () => overlay.remove() }, 'Cancel'),
      el('button', {
        class: 'btn primary',
        type: 'button',
        onclick: async () => {
          const toTeamId = teamSelect.value;
          const dest = teams.find((t) => t.id === toTeamId);
          if (!toTeamId || !dest) {
            toast('Pick a team to transfer to.', 'error');
            return;
          }
          const slotVal = slotSelect.value;
          const opts = slotVal === 'keep' ? {} : { slot: normalizeSlot(slotVal) };
          try {
            if (bulk) {
              await window.cci.transferMembers(fromTeam.id, toTeamId, list.map((m) => m.id), opts);
            } else {
              await window.cci.transferMember(fromTeam.id, toTeamId, list[0].id, opts);
            }
            overlay.remove();
            toast(bulk ? `${list.length} players moved to ${dest.name}.` : `${list[0].gamertag} moved to ${dest.name}.`);
            await ctx.refreshShell?.();
            if (onDone) onDone(dest);
            else ctx.navigate('players');
          } catch (err) {
            console.error('[teams] transfer failed', err);
            toast(err?.message || 'Could not transfer.', 'error');
          }
        },
      }, bulk ? `Transfer ${list.length}` : 'Transfer'),
    ])
  );
}
