const test = require('node:test');
const assert = require('node:assert/strict');
const fss = require('fs');
const os = require('os');
const path = require('path');

const ROOT = fss.mkdtempSync(path.join(os.tmpdir(), 'cci-crud-'));
process.env.CCI_DATA_ROOT = ROOT;
const store = require('../src/main/dataStore');

test.after(() => fss.rmSync(ROOT, { recursive: true, force: true }));

test('team, player, task and match CRUD round-trip', async () => {
  await store.ensureDirectories();
  const team = await store.saveTeam({ name: 'QA_AUDIT_Team', tag: 'QAX' });
  assert.ok(team.id);
  assert.equal(team.name, 'QA_AUDIT_Team');

  const renamed = await store.saveTeam({ id: team.id, name: 'QA_AUDIT_Team_v2', tag: 'QAX' });
  assert.equal(renamed.name, 'QA_AUDIT_Team_v2');
  assert.equal((await store.getTeams()).length, 1);

  const player = await store.saveMember(team.id, { gamertag: 'QA_AUDIT_Player', name: 'QA Audit', role: 'Flex' });
  assert.equal(player.gamertag, 'QA_AUDIT_Player');
  const edited = await store.saveMember(team.id, { id: player.id, gamertag: 'QA_AUDIT_Player', name: 'QA Audit v2', role: 'Flex' });
  assert.equal(edited.name, 'QA Audit v2');
  assert.equal((await store.getMembers(team.id)).length, 1);

  const task = await store.saveTask(team.id, { title: 'QA_AUDIT_Task' });
  assert.ok(task.task_id);
  const note = await store.saveNote(team.id, { title: 'QA_AUDIT_Note', body: 'body-v1' });
  const note2 = await store.saveNote(team.id, { note_id: note.note_id, title: 'QA_AUDIT_Note_v2', body: 'body-v2' });
  assert.equal(note2.note_id, note.note_id);
  assert.equal((await store.getNotes(team.id)).length, 1);

  const attachmentPath = `org/teams/${team.id}/data/note-images/attachment-note/map.png`;
  const attachmentNote = await store.saveNote(team.id, {
    title: 'QA_AUDIT_Attachment_Note',
    body: 'body-v1',
    author: 'Naevii',
    attachments: [{ id: 'map-1', path: attachmentPath, name: 'map.png', mime: 'image/png' }],
  });
  assert.equal(attachmentNote.revision, 1);
  assert.equal(attachmentNote.updated_by, 'Naevii');
  assert.deepEqual(attachmentNote.attachments.map((item) => item.name), ['map.png']);

  const revisedNote = await store.saveNote(team.id, {
    note_id: attachmentNote.note_id,
    title: attachmentNote.title,
    body: 'body-v2',
    author: 'Coach',
    expected_revision: 1,
  });
  assert.equal(revisedNote.revision, 2);
  assert.equal(revisedNote.updated_by, 'Coach');
  assert.equal(revisedNote.history.length, 1);
  assert.equal(revisedNote.attachments[0].path, attachmentPath);
  await assert.rejects(
    () => store.saveNote(team.id, {
      note_id: attachmentNote.note_id,
      title: attachmentNote.title,
      body: 'stale',
      expected_revision: 1,
    }),
    (err) => err.code === 'NOTE_CONFLICT'
  );

  const match = await store.saveMatch(team.id, {
    opponent: 'QA_AUDIT_MatchOpp',
    mode: 'Hardpoint',
    map: 'Skyline',
    result: 'Win',
    score: '250-180',
  });
  assert.equal(match.opponent, 'QA_AUDIT_MatchOpp');
  assert.equal((await store.getMatches(team.id))[0].opponent, 'QA_AUDIT_MatchOpp');

  await store.deleteTask(team.id, task.task_id);
  await store.deleteNote(team.id, note.note_id);
  await store.deleteMatch(team.id, match.match_id);
  await store.deleteMember(team.id, player.id);
  await store.deleteTeam(team.id);

  assert.equal((await store.getTeams()).length, 0);
});

test('two task saves without an id a moment apart create two records', async () => {
  await store.ensureDirectories();
  const team = await store.saveTeam({ name: 'QA_Dup_Team', tag: 'DUP' });
  await store.saveTask(team.id, { title: 'Same title' });
  await new Promise((r) => setTimeout(r, 5));
  await store.saveTask(team.id, { title: 'Same title' });
  assert.equal((await store.getTasks(team.id)).length, 2);
  await store.deleteTeam(team.id);
});

test('transfer moves a player to another team and keeps the same id', async () => {
  await store.ensureDirectories();
  const alpha = await store.saveTeam({ name: 'QA_Xfer_Alpha', tag: 'QAA' });
  const bravo = await store.saveTeam({ name: 'QA_Xfer_Bravo', tag: 'QAB' });
  const player = await store.saveMember(alpha.id, { gamertag: 'QA_Xfer_Player', name: 'Mover', role: 'SMG', slot: 'starter' });

  const moved = await store.transferMember(alpha.id, bravo.id, player.id, { slot: 'bench' });
  assert.equal(moved.id, player.id);
  assert.equal(moved.team_id, bravo.id);
  assert.equal(moved.slot, 'bench');
  assert.equal(moved.gamertag, 'QA_Xfer_Player');
  assert.equal((await store.getMembers(alpha.id)).length, 0);
  assert.equal((await store.getMember(bravo.id, player.id)).gamertag, 'QA_Xfer_Player');

  await assert.rejects(() => store.transferMember(bravo.id, bravo.id, player.id), /different team/);
  await store.deleteTeam(alpha.id);
  await store.deleteTeam(bravo.id);
});

test('saveMember keeps Discord user_id when a later edit omits it', async () => {
  await store.ensureDirectories();
  const team = await store.saveTeam({ name: 'QA_Link_Team', tag: 'QLT' });
  const player = await store.saveMember(team.id, { gamertag: 'vxlt', role: 'Flex', user_id: 'discord-u-2' });
  assert.equal(player.user_id, 'discord-u-2');
  const benched = await store.saveMember(team.id, { ...player, user_id: undefined, slot: 'bench' });
  assert.equal(benched.user_id, 'discord-u-2');
  const loaded = await store.getMember(team.id, player.id);
  assert.equal(loaded.user_id, 'discord-u-2');
  await store.deleteTeam(team.id);
});

test('saveMember keeps a bench slot and stamps updated_at', async () => {
  await store.ensureDirectories();
  const team = await store.saveTeam({ name: 'QA_Bench_Team', tag: 'QBN' });
  const player = await store.saveMember(team.id, { gamertag: 'QA_Bench_Player', role: 'SMG', slot: 'starter' });
  const benched = await store.saveMember(team.id, { ...player, slot: 'bench' });
  assert.equal(benched.slot, 'bench');
  assert.match(String(benched.updated_at || ''), /^\d{4}-/);
  const loaded = await store.getMember(team.id, player.id);
  assert.equal(loaded.slot, 'bench');
  await store.deleteTeam(team.id);
});

test('saveMember can disable a player without deleting them', async () => {
  await store.ensureDirectories();
  const team = await store.saveTeam({ name: 'QA_Disable_Team', tag: 'QDT' });
  const player = await store.saveMember(team.id, { gamertag: 'QA_Disable_Player', role: 'Flex', slot: 'starter' });
  const parked = await store.saveMember(team.id, { ...player, disabled: true });
  assert.equal(parked.disabled, true);
  assert.equal(parked.handles._disabled, '1');
  const loaded = await store.getMember(team.id, player.id);
  assert.equal(loaded.disabled, true);
  const on = await store.saveMember(team.id, { ...loaded, disabled: false, handles: { activision: 'QA#1' } });
  assert.equal(on.disabled, false);
  assert.equal(on.handles._disabled, undefined);
  assert.equal(on.handles.activision, 'QA#1');
  await store.deleteTeam(team.id);
});

test('transfer finishes a half-done move when the player file is already on the destination', async () => {
  await store.ensureDirectories();
  const alpha = await store.saveTeam({ name: 'QA_Stuck_Alpha', tag: 'QSA' });
  const bravo = await store.saveTeam({ name: 'QA_Stuck_Bravo', tag: 'QSB' });
  const player = await store.saveMember(alpha.id, { gamertag: 'QA_Stuck_Player', name: 'Stuck', role: 'AR', slot: 'starter' });
  await store.saveMember(bravo.id, { id: player.id, gamertag: player.gamertag, name: player.name, role: 'AR', slot: 'bench' });

  const moved = await store.transferMember(alpha.id, bravo.id, player.id, { slot: 'starter' });
  assert.equal(moved.id, player.id);
  assert.equal(moved.team_id, bravo.id);
  assert.equal(moved.slot, 'starter');
  assert.equal((await store.getMembers(alpha.id)).length, 0);
  assert.equal((await store.getMembers(bravo.id)).length, 1);

  await store.deleteTeam(alpha.id);
  await store.deleteTeam(bravo.id);
});

test('transferMembers moves several players in one call', async () => {
  await store.ensureDirectories();
  const alpha = await store.saveTeam({ name: 'QA_Bulk_Alpha', tag: 'QBA' });
  const bravo = await store.saveTeam({ name: 'QA_Bulk_Bravo', tag: 'QBB' });
  const one = await store.saveMember(alpha.id, { gamertag: 'QA_Bulk_One', role: 'SMG', slot: 'starter' });
  const two = await store.saveMember(alpha.id, { gamertag: 'QA_Bulk_Two', role: 'AR', slot: 'bench' });

  const moved = await store.transferMembers(alpha.id, bravo.id, [one.id, two.id], { slot: 'starter' });
  assert.equal(moved.length, 2);
  assert.equal((await store.getMembers(alpha.id)).length, 0);
  assert.equal((await store.getMembers(bravo.id)).length, 2);
  assert.equal((await store.getMember(bravo.id, one.id)).slot, 'starter');

  await store.deleteTeam(alpha.id);
  await store.deleteTeam(bravo.id);
});

test('getOrg finds org-logo.png when the profile path was wiped', async () => {
  await store.ensureDirectories();
  await store.saveOrg({ name: 'VANTIX', logo: null });
  const dest = path.join(ROOT, 'org', 'logos', 'org-logo.png');
  fss.mkdirSync(path.dirname(dest), { recursive: true });
  fss.writeFileSync(dest, 'png');
  const org = await store.getOrg();
  assert.equal(org.logo, 'org/logos/org-logo.png');
  assert.equal(org.locked, true);
  assert.equal(org.provisioned, true);
});
