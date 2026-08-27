'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { newId, saveMember, uploadMemberPhoto } from '../lib/docs';
import { markSrc } from '../lib/marks';
import { Err, Modal } from './workspace';

export const ROLES = ['IGL', 'AR', 'SMG', 'Sniper', 'Flex', 'Main Sub', 'Main AR'];

const SLOTS = [
  ['starter', 'Starter'],
  ['bench', 'Backup / Bench'],
  ['fa', 'Free Agent'],
  ['staff', 'Staff / Org'],
];

const ADD_HEADING = { bench: 'Add Bench Player', fa: 'Add Free Agent', staff: 'Add Org Member' };

// Same set the desktop app writes into `member.handles` (jsonb) — keep both
// in sync since they read each other's data through the same Supabase table.
const HANDLE_FIELDS = [
  { key: 'activision', label: 'Activision ID', placeholder: 'Name#1234567' },
  { key: 'checkmate', label: 'Checkmate Gaming', placeholder: 'checkmategaming.com/player/…' },
  { key: 'discord', label: 'Discord', placeholder: 'username' },
  { key: 'twitch', label: 'Twitch', placeholder: 'twitch.tv/…' },
  { key: 'twitter', label: 'X / Twitter', placeholder: '@handle' },
  { key: 'youtube', label: 'YouTube', placeholder: '@channel' },
  { key: 'instagram', label: 'Instagram', placeholder: '@handle' },
  { key: 'other', label: 'Other', placeholder: 'Platform + handle' },
];

const TITLE_SUGGESTIONS = [
  'Player', 'Org Owner', 'Admin', 'General Manager', 'Team Manager', 'Head Coach',
  'Coach', 'Team Leader', 'Analyst', 'Artist', 'Graphic Designer', 'Content Creator',
  'Social Media', 'Video Editor', 'Super Admin', 'Developer',
];

function isMemberDisabled(member) {
  if (!member) return false;
  if (member.disabled === true) return true;
  return String(member.handles?._disabled || '') === '1';
}

function normalizeHandles(raw, disabled) {
  const out = {};
  for (const { key } of HANDLE_FIELDS) {
    const value = String(raw[key] || '').trim();
    if (value) out[key] = value.slice(0, 120);
  }
  if (disabled) out._disabled = '1';
  return out;
}

function slotStatus(slot) {
  return { bench: 'Bench', fa: 'Free agent', staff: 'Staff' }[slot] || 'Starter';
}

function Face({ src, name }) {
  const letter = String(name || '?').trim().slice(0, 1).toUpperCase() || '?';
  return (
    <div className="avatar member-edit-avatar">
      {src ? <img src={src} alt="" /> : letter}
    </div>
  );
}

export function MemberPhotoButton({ member, canEdit }) {
  const router = useRouter();
  const fileRef = useRef(null);
  const [src, setSrc] = useState(markSrc(member?.photo) || member?.avatar_url || '');
  const [busy, setBusy] = useState(false);
  if (!canEdit) {
    return (
      <div className="avatar">
        {src ? <img src={src} alt="" /> : String(member?.gamertag || member?.name || '?').slice(0, 1).toUpperCase()}
      </div>
    );
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !member?.id) return;
    const preview = URL.createObjectURL(file);
    const previous = src;
    setSrc(preview);
    setBusy(true);
    try {
      const key = await uploadMemberPhoto(member.team_id, member.id, file);
      await saveMember({ ...member, photo: key });
      router.refresh();
    } catch {
      setSrc(previous);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="avatar-action"
      title={busy ? 'Saving photo' : `Change ${member.gamertag || 'player'} photo`}
      onClick={() => fileRef.current?.click()}
    >
      <span className="avatar">
        {src ? <img src={src} alt="" /> : String(member?.gamertag || member?.name || '?').slice(0, 1).toUpperCase()}
      </span>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onFile} />
    </button>
  );
}

// The one form behind both "+ Add Member" and "Edit" — same fields, same
// layout, same modal, so the two flows can't drift apart the way they had
// before (the add flow was a bare 3-field strip with no photo picker).
function MemberModal({ member, teamId, teams, slot, onClose }) {
  const router = useRouter();
  const fileRef = useRef(null);
  const isEdit = Boolean(member?.id);
  const idRef = useRef(member?.id || newId('mem'));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoSrc, setPhotoSrc] = useState(markSrc(member?.photo) || member?.avatar_url || '');
  const [photoFile, setPhotoFile] = useState(null);
  const handles = member?.handles || {};
  const [form, setForm] = useState({
    team_id: teamId || teams?.[0]?.id || '',
    gamertag: member?.gamertag || '',
    name: member?.name || '',
    title: member?.title || '',
    role: member?.role || 'Flex',
    slot: member?.slot || slot || 'starter',
    aliases: (member?.aliases || []).join(', '),
    enabled: !isMemberDisabled(member),
    ...Object.fromEntries(HANDLE_FIELDS.map(({ key }) => [key, handles[key] || ''])),
  });

  function pickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoFile(file);
    setPhotoSrc(URL.createObjectURL(file));
  }

  async function save(e) {
    e.preventDefault();
    const gamertag = form.gamertag.trim();
    if (!gamertag) {
      setError('A gamertag is required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const saveTeamId = form.team_id;
      let photo = member?.photo || null;
      if (photoFile) photo = await uploadMemberPhoto(saveTeamId, idRef.current, photoFile);
      await saveMember({
        id: idRef.current,
        team_id: saveTeamId,
        gamertag,
        name: form.name.trim() || gamertag,
        title: form.title.trim(),
        role: form.role,
        slot: form.slot,
        aliases: form.aliases.split(',').map((a) => a.trim()).filter(Boolean),
        photo,
        disabled: !form.enabled,
        handles: normalizeHandles(form, !form.enabled),
      });
      onClose();
      router.refresh();
    } catch (err) {
      setSaving(false);
      setError(err.message || `Could not ${isEdit ? 'save' : 'add'} the player.`);
    }
  }

  const teamChoices = !isEdit && Array.isArray(teams) && teams.length > 1 ? teams : null;
  const formId = `member-form-${idRef.current}`;

  return (
    <Modal onClose={onClose} width="540px">
      {isEdit ? (
        <div className="member-edit-id">
          <button type="button" className="avatar-action" title="Change photo" onClick={() => fileRef.current?.click()}>
            <Face src={photoSrc} name={form.gamertag || form.name} />
          </button>
          <div className="member-edit-copy">
            <div className="gamertag">{form.gamertag || 'Player'}</div>
            <span className="board-roster-on">{form.enabled ? slotStatus(form.slot) : 'Disabled'}</span>
            <button type="button" className="btn subtle sm" onClick={() => fileRef.current?.click()}>
              {photoSrc ? 'Change photo' : 'Add photo'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <h3>{ADD_HEADING[form.slot] || 'Add Member'}</h3>
          <div className="profile-photo-row">
            <button type="button" className="avatar-action" title="Change photo" onClick={() => fileRef.current?.click()}>
              <Face src={photoSrc} name={form.gamertag || form.name} />
            </button>
            <div style={{ flex: 1 }}>
              <div className="settings-row-title">Player photo</div>
              <div className="field-hint">Optional. Shown on the roster and player profile.</div>
            </div>
            <button type="button" className="btn subtle sm" onClick={() => fileRef.current?.click()}>
              {photoSrc ? 'Change photo' : 'Add photo'}
            </button>
          </div>
        </>
      )}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pickPhoto} />

      <form id={formId} onSubmit={save}>
        {teamChoices ? (
          <label className="field">
            <span>Team</span>
            <select value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })}>
              {teamChoices.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        ) : null}
        <div className="inline-fields">
          <label className="field">
            <span>Gamertag</span>
            <input value={form.gamertag} onChange={(e) => setForm({ ...form, gamertag: e.target.value })} required autoFocus />
          </label>
          <label className="field">
            <span>Display Name</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
        </div>
        <div className="inline-fields">
          <label className="field">
            <span>Org Role</span>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Player, Developer…"
              list="member-title-suggestions"
            />
            <div className="field-hint">Their job in the org. You can list more than one, comma-separated — Player, Developer.</div>
          </label>
          <label className="field">
            <span>In-Game Role</span>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <div className="field-hint">For players on the roster. Staff can leave this as Flex.</div>
          </label>
        </div>
        <label className="field">
          <span>Lineup</span>
          <select value={form.slot} onChange={(e) => setForm({ ...form, slot: e.target.value })}>
            {SLOTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <div className="field-hint">Where they sit on this roster. Org roles are separate — a starter can also be a developer or coach.</div>
        </label>
        <label className="field">
          <span>OCR Aliases (comma-separated)</span>
          <input value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} />
          <div className="field-hint">Common OCR misreads of this gamertag, so stats still attribute correctly.</div>
        </label>

        <label className="check-row" style={{ marginTop: 14 }}>
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          />
          <span>Member is enabled</span>
        </label>
        <div className="field-hint">Turn this off to hide them from the roster without deleting. You can enable them again later.</div>

        <div className="modal-section-title">Socials &amp; Gaming IDs</div>
        <div className="handle-grid">
          {HANDLE_FIELDS.map(({ key, label, placeholder }) => (
            <label className="field" key={key}>
              <span>{label}</span>
              <input
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={placeholder}
              />
            </label>
          ))}
        </div>
        <Err error={error} />
      </form>
      <datalist id="member-title-suggestions">
        {TITLE_SUGGESTIONS.map((t) => <option key={t} value={t} />)}
      </datalist>

      <div className="modal-actions">
        <button type="button" className="btn subtle" onClick={onClose}>Cancel</button>
        <button type="submit" form={formId} className="btn primary" disabled={saving}>Save</button>
      </div>
    </Modal>
  );
}

export function AddMember({ teams, canEdit, teamId, slot }) {
  const [open, setOpen] = useState(false);
  if (!canEdit || !teams?.length) return null;
  return (
    <>
      <button type="button" className="btn primary" onClick={() => setOpen(true)}>+ Add Member</button>
      {open ? <MemberModal teamId={teamId} teams={teams} slot={slot} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function EditMember({ member, canEdit }) {
  const [open, setOpen] = useState(false);
  if (!canEdit || !member?.id) return null;
  return (
    <>
      <button type="button" className="btn sm" onClick={() => setOpen(true)}>Edit</button>
      {open ? <MemberModal member={member} teamId={member.team_id} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
