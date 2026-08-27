'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { saveMember, uploadMemberPhoto } from '../lib/docs';
import { markSrc } from '../lib/marks';
import { Err } from './workspace';

const SLOTS = [
  ['starter', 'Starter'],
  ['bench', 'Bench'],
  ['fa', 'F/A'],
  ['staff', 'Staff'],
];

function slotLabel(slot) {
  if (slot === 'bench') return 'Bench';
  if (slot === 'fa') return 'Free agent';
  if (slot === 'staff') return 'Staff';
  return 'Starter';
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

export function EditMember({ member, canEdit }) {
  const router = useRouter();
  const btnRef = useRef(null);
  const fileRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoSrc, setPhotoSrc] = useState(markSrc(member?.photo) || member?.avatar_url || '');
  const [photoFile, setPhotoFile] = useState(null);
  const [form, setForm] = useState({
    gamertag: member.gamertag || '',
    name: member.name || '',
    role: member.role || 'Flex',
    slot: member.slot || 'starter',
    title: member.title || '',
  });
  if (!canEdit || !member?.id) return null;

  function pickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoFile(file);
    setPhotoSrc(URL.createObjectURL(file));
  }

  function openEditor() {
    setHost(btnRef.current?.closest('.roster-block') || null);
    setError('');
    setOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    setOpen(false);
    try {
      let photo = member.photo;
      if (photoFile) photo = await uploadMemberPhoto(member.team_id, member.id, photoFile);
      await saveMember({ ...member, ...form, photo });
      router.refresh();
    } catch (err) {
      setOpen(true);
      setSaving(false);
      setError(err.message || 'Could not save member.');
    }
  }

  const panel = (
    <div className="member-edit-wrap">
      <form id={`edit-member-${member.id}`} className="member-edit" onSubmit={save}>
        <div className="member-edit-id">
          <button type="button" className="avatar-action" title="Change photo" onClick={() => fileRef.current?.click()}>
            <Face src={photoSrc} name={form.gamertag || form.name} />
          </button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pickPhoto} />
          <div className="member-edit-copy">
            <div className="gamertag">{form.gamertag || 'Player'}</div>
            <span className="board-roster-on">{slotLabel(form.slot)}</span>
            <button type="button" className="btn subtle sm" onClick={() => fileRef.current?.click()}>
              {photoSrc ? 'Change photo' : 'Add photo'}
            </button>
          </div>
          <button type="button" className="btn subtle sm" onClick={() => setOpen(false)}>Cancel</button>
        </div>
        <div className="member-edit-grid">
          <label className="field">
            <span>Gamertag</span>
            <input value={form.gamertag} onChange={(e) => setForm({ ...form, gamertag: e.target.value })} required />
          </label>
          <label className="field">
            <span>Name</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="field">
            <span>Role</span>
            <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          </label>
          <label className="field">
            <span>Title</span>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Team Leader, Coach" />
          </label>
        </div>
        <div className="field">
          <span>Lineup</span>
          <div className="lineup-seg" role="group" aria-label="Lineup">
            {SLOTS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`lineup-seg-btn${form.slot === value ? ' is-on' : ''}`}
                onClick={() => setForm({ ...form, slot: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="member-edit-actions">
          <button type="submit" className="btn primary" disabled={saving}>Save</button>
        </div>
        <Err error={error} />
      </form>
    </div>
  );

  return (
    <>
      <button ref={btnRef} type="button" className="btn sm" onClick={openEditor}>Edit</button>
      {open ? (host ? createPortal(panel, host) : panel) : null}
    </>
  );
}
