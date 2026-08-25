'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabase } from '../lib/supabase/browser';
import { EmptyState, PageHeader } from './page-header';
import { pickTeam, TeamPicker } from './workspace';

export function NeedsReviewView({ teams, teamId, canEdit }) {
  const team = pickTeam(teams, teamId);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!team) return;
    let cancelled = false;
    (async () => {
      const supabase = createBrowserSupabase();
      const { data, error: err } = await supabase.storage.from('org-assets').list(`scoreboards/${team.id}`, { limit: 100 });
      if (cancelled) return;
      if (err) setItems([]);
      else setItems((data || []).filter((f) => f.name && !f.name.startsWith('.')));
    })();
    return () => { cancelled = true; };
  }, [team]);

  async function onFiles(files) {
    if (!team || !canEdit) return;
    setBusy(true);
    setError('');
    const supabase = createBrowserSupabase();
    const date = new Date().toISOString().slice(0, 10);
    try {
      for (const file of files) {
        const path = `scoreboards/${team.id}/${date}/${file.name}`;
        const { error: err } = await supabase.storage.from('org-assets').upload(path, file, { upsert: true });
        if (err) throw err;
      }
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Could not upload.');
    } finally {
      setBusy(false);
    }
  }

  if (!teams.length) {
    return (
      <>
        <PageHeader title="Scoreboard Inbox" subtitle="Drop scoreboard screenshots here." />
        <EmptyState title="Create a team first" body="Scoreboards are stored per team so the roster and aliases line up." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Scoreboard Inbox"
        subtitle="Drop scoreboard screenshots here. Coach Intel files them by team and date."
        actions={<TeamPicker teams={teams} teamId={team.id} />}
      />
      <div className="card sb-drop-card">
        <div className="card-head">
          <h2>Scoreboard inbox</h2>
          <div className="card-meta">{team.name}</div>
        </div>
        {canEdit ? (
          <label className="field-hint" style={{ display: 'block', padding: '18px', border: '1px dashed var(--border)', borderRadius: 12, textAlign: 'center', cursor: 'pointer' }}>
            {busy ? 'Uploading…' : 'Drop or choose a post-game scoreboard — Hardpoint, Search, or Control.'}
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => onFiles([...e.target.files])}
            />
          </label>
        ) : (
          <div className="field-hint">View only — staff upload screenshots.</div>
        )}
        {error ? <div className="field-hint" style={{ color: 'var(--loss)' }}>{error}</div> : null}
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-head">
          <h2>Waiting to be read</h2>
          <div className="card-meta">{items.length} file{items.length === 1 ? '' : 's'} · {team.name}</div>
        </div>
        {items.length === 0 ? (
          <div className="field-hint" style={{ padding: '8px 0 4px' }}>Nothing in this team’s inbox yet.</div>
        ) : (
          items.map((item) => (
            <div key={item.name} className="crow">
              <div className="crow-main">
                <div className="crow-title">{item.name}</div>
                <div className="crow-sub">{item.updated_at ? String(item.updated_at).slice(0, 10) : 'Undated'}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
