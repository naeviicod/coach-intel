'use client';

import { useEffect, useState } from 'react';
import { filedPaths } from '../lib/series';
import { deleteScoreboard, listScoreboardInbox, uploadScoreboards } from '../lib/scoreboards';
import { EmptyState, PageHeader } from './page-header';
import { ScoreboardRead } from './scoreboard-read';
import { pickTeam, TeamPicker } from './workspace';

export function NeedsReviewView({ teams, teamId, members = [], matches = [], maps = [], modes = [], canEdit }) {
  const team = pickTeam(teams, teamId);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(null);

  useEffect(() => {
    if (!team) return;
    let cancelled = false;
    (async () => {
      const listed = await listScoreboardInbox(team.id);
      if (!cancelled) setItems(listed);
    })();
    return () => { cancelled = true; };
  }, [team]);

  const done = filedPaths(matches);
  const waiting = items.filter((item) => !done.has(item.path));

  async function onFiles(files) {
    if (!team || !canEdit || !files?.length) return;
    setBusy(true);
    setError('');
    try {
      const uploaded = await uploadScoreboards(team.id, files);
      setItems((cur) => [...uploaded, ...cur]);
      setReading(uploaded[0] || null);
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
        subtitle="Drop a post-game board. Coach Intel files it into that map of the BO5 and writes player stats."
        actions={<TeamPicker teams={teams} teamId={team.id} />}
      />
      {reading ? (
        <ScoreboardRead
          item={reading}
          team={team}
          members={members}
          matches={matches}
          maps={maps}
          modes={modes}
          onClose={() => setReading(null)}
          onRemoved={(item) => setItems((cur) => cur.filter((row) => row.path !== item.path))}
        />
      ) : null}
      <div className="card sb-drop-card">
        <div className="card-head">
          <h2>Scoreboard inbox</h2>
          <div className="card-meta">{team.name}</div>
        </div>
        {canEdit ? (
          <label className="sb-drop-zone">
            {busy ? 'Uploading…' : 'Drop or choose a post-game scoreboard — Hardpoint, Search, or Overload.'}
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
          <div className="card-meta">{waiting.length} file{waiting.length === 1 ? '' : 's'} · {team.name}</div>
        </div>
        {waiting.length === 0 ? (
          <div className="field-hint" style={{ padding: '8px 0 4px' }}>Nothing in this team’s inbox yet. Drop a board above and it opens the stats form.</div>
        ) : (
          waiting.map((item) => (
            <div key={item.path} className="crow">
              <div className="crow-main">
                <div className="crow-title">{item.name}</div>
                <div className="crow-sub">{item.date || 'Undated'}</div>
              </div>
              {canEdit ? (
                <div className="crow-actions">
                  <button type="button" className="btn primary sm" onClick={() => setReading(item)}>File stats</button>
                  <button
                    type="button"
                    className="btn subtle sm"
                    onClick={async () => {
                      try {
                        await deleteScoreboard(item.path);
                        setItems((cur) => cur.filter((row) => row.path !== item.path));
                        setReading((open) => (open?.path === item.path ? null : open));
                      } catch (err) {
                        setError(err.message || 'Could not remove that scoreboard.');
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </>
  );
}
