'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ACCENT_PRESETS, applyAccent, DEFAULT_ACCENT, normalizeHex } from '../lib/accent';
import { applyBackground, BACKGROUND_OPTIONS, backgroundUrl, DEFAULT_BACKGROUND, nextBackground } from '../lib/background';
import { saveDoc, updateMyProfile, uploadMyPhoto } from '../lib/docs';
import { titleChoices } from '../lib/identity';
import { initials, markSrc } from '../lib/marks';
import { CopyJoinAlias } from './copy-join-alias';
import { Err, Field } from './workspace';

function Face({ photo, name, size = 52 }) {
  const src = markSrc(photo);
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {src ? <img src={src} alt="" /> : initials(name)}
    </div>
  );
}

export function ProfileCard({ identity, profile }) {
  const router = useRouter();
  const [name, setName] = useState(identity?.name || '');
  const [title, setTitle] = useState(identity?.title || '');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState('');
  const photo = preview || identity?.photo || identity?.avatarUrl;
  const discord = profile?.discord_username || 'Discord';

  async function save(e) {
    e.preventDefault();
    setError('');
    setSaved(false);
    try {
      await updateMyProfile({ displayName: name, title });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err.message || 'Could not save profile.');
    }
  }

  async function onPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setSaved(false);
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    try {
      await uploadMyPhoto(file);
      setSaved(true);
      router.refresh();
    } catch (err) {
      setPreview('');
      setError(err.message || 'Could not save photo.');
    }
  }

  return (
    <form onSubmit={save} className="card section">
      <div className="section-title">Your Profile</div>
      <p className="field-hint" style={{ marginBottom: 14, maxWidth: 620, lineHeight: 1.5 }}>
        Your name, title, and photo. Teammates see this on Players, Team Hub, and the calendar — same as plans and meetings.
      </p>
      <div className="profile-photo-row">
        <Face photo={photo} name={name} />
        <div style={{ flex: 1 }}>
          <div className="settings-row-title">Profile photo</div>
          <div className="field-hint">Square PNG or JPG. The whole org sees it. Linked as {discord}.</div>
        </div>
        <label className="btn">
          {identity?.photo ? 'Change Photo' : 'Upload Photo'}
          <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onPhoto} />
        </label>
      </div>
      <div className="inline-fields">
        <Field label="Your Name">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
        </Field>
        <Field label="Title">
          <select
            id="web-profile-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Title"
          >
            <option value="">Select title</option>
            {titleChoices(title).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="settings-actions">
        <button type="submit" className="btn primary">Save Profile</button>
      </div>
      {saved ? <div className="field-hint" style={{ color: 'var(--win)' }}>Saved.</div> : null}
      <Err error={error} />
    </form>
  );
}

export function OrganizationCard({ org, isOrgAdmin }) {
  const [name, setName] = useState(org?.name || '');
  const [tag, setTag] = useState(org?.tag || '');
  const [accent, setAccent] = useState(normalizeHex(org?.accent) || DEFAULT_ACCENT);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    applyAccent(accent);
  }, [accent]);

  async function save(e) {
    e.preventDefault();
    setError('');
    setSaved(false);
    try {
      const color = applyAccent(accent);
      await saveDoc({
        kind: 'org',
        teamId: '',
        id: 'profile',
        payload: { ...org, id: 'profile', name: name.trim() || 'My Organization', tag: tag.trim() || null, accent: color },
      });
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Could not save.');
    }
  }

  return (
    <>
      {isOrgAdmin ? (
      <form onSubmit={save} className="card section">
          <div className="section-title">Identity</div>
          <div className="inline-fields">
            <Field label="Org Name"><input type="text" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Tag / Abbreviation"><input type="text" value={tag} onChange={(e) => setTag(e.target.value)} /></Field>
          </div>
          <div className="section-title" style={{ marginTop: 16 }}>Highlight Color</div>
          <p className="field-hint" style={{ marginBottom: 12, maxWidth: 620, lineHeight: 1.5 }}>
            First launch is Intel Lime. Invited teammates pick up this color the next time they open Coach Intel.
          </p>
          <div className="accent-swatches">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.hex}
                type="button"
                className={`accent-swatch${accent === preset.hex ? ' active' : ''}`}
                title={preset.name}
                style={{ background: preset.hex }}
    onClick={() => { setAccent(preset.hex); applyAccent(preset.hex); }}
              />
            ))}
            <input
              type="color"
              className="accent-picker"
              value={accent}
              onChange={(e) => { setAccent(e.target.value); applyAccent(e.target.value); }}
              aria-label="Custom accent"
            />
          </div>
          <div className="settings-actions">
            <button type="submit" className="btn primary">Save Changes</button>
          </div>
          {saved ? <div className="field-hint" style={{ color: 'var(--win)' }}>Saved.</div> : null}
          <Err error={error} />
        </form>
      ) : null}
      {isOrgAdmin ? (
        <div className="card section">
          <div className="section-title">Invites</div>
          <div className="list-item-row">
            <div>
              <div className="settings-row-title">Org sign-in</div>
              <div className="field-hint">coach.championshipseries.eu/join</div>
            </div>
            <CopyJoinAlias />
          </div>
          <p className="field-hint">Per-player binds are copied from a team roster. Discord on that link becomes their profile.</p>
        </div>
      ) : null}
    </>
  );
}

export function AccountCard() {
  return (
    <div className="card section">
      <div className="section-title">Account</div>
      <div className="list-item-row">
        <div>
          <div className="settings-row-title">Signed in with Discord</div>
          <div className="field-hint">Sign out of Coach Intel on this browser. This is the only place to sign out.</div>
        </div>
        <form action="/auth/sign-out" method="post">
          <button type="submit" className="btn subtle danger">Sign out</button>
        </form>
      </div>
    </div>
  );
}

export function BackgroundCard() {
  const [current, setCurrent] = useState(DEFAULT_BACKGROUND);

  useEffect(() => {
    try {
      setCurrent(window.localStorage.getItem('ci-background') || DEFAULT_BACKGROUND);
    } catch {
      /* ignore */
    }
  }, []);

  function pick(id) {
    const resolved = applyBackground(id);
    try {
      window.localStorage.setItem('ci-background', resolved);
    } catch {
      /* ignore */
    }
    setCurrent(resolved);
  }

  return (
    <div className="card section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 2 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>Background</div>
        <button type="button" className="btn subtle sm" onClick={() => pick(nextBackground(current))}>
          Next background
        </button>
      </div>
      <p className="field-hint" style={{ marginBottom: 12, maxWidth: 620, lineHeight: 1.5 }}>
        Stays in this browser. Highlight color retints the art as you change it.
      </p>
      <div className="bg-picker" role="group" aria-label="Background">
        {BACKGROUND_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`bg-option${opt.id === current ? ' active' : ''}`}
            data-id={opt.id}
            aria-pressed={opt.id === current ? 'true' : 'false'}
            onClick={() => pick(opt.id)}
          >
            <span className="bg-option-frame">
              {opt.src ? (
                <span className="bg-option-art" style={{ backgroundImage: `url("${backgroundUrl(opt.src)}")` }} />
              ) : (
                <span className="bg-option-art bg-option-pit" />
              )}
            </span>
            <span className="bg-option-meta">
              <div className="bg-option-name">{opt.name}</div>
              <div className="bg-option-hint">{opt.hint}</div>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
