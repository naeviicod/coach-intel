'use client';

import { useMemo, useState } from 'react';
import { newId, saveDoc } from '../lib/docs';
import { emptyBo5, scorePlaceholder, seriesMatchRecords } from '../lib/series';
import { Err, Field, FormCard } from './workspace';

const MODE_SHORT = {
  Hardpoint: 'HP',
  'Search & Destroy': 'SnD',
  Overload: 'OL',
};

export function AddMatch({ teams, canEdit, maps = [], modes = [] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const slots = useMemo(() => emptyBo5(modes), [modes]);
  const [form, setForm] = useState({ team_id: teams[0]?.id || '', opponent: '', date: today });
  const [games, setGames] = useState(slots);
  if (!canEdit || !teams.length) return null;

  function patchGame(index, patch) {
    setGames((rows) => rows.map((row) => (row.index === index ? { ...row, ...patch } : row)));
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    const records = seriesMatchRecords({
      teamId: form.team_id,
      opponent: form.opponent,
      date: form.date,
      seriesId: newId('series'),
      maps: games,
    });
    if (!records.length) {
      setError('Fill at least one map — map, result, or score.');
      return;
    }
    try {
      for (const rec of records) {
        await saveDoc({ kind: 'match', teamId: rec.teamId, id: rec.id, payload: rec.payload });
      }
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Could not log series.');
    }
  }

  return (
    <>
      <div className="add-row">
        <button type="button" className="btn primary" onClick={() => { setGames(emptyBo5(modes)); setOpen(true); }}>
          + Log Match
        </button>
      </div>
      {open ? (
        <FormCard
          title="Log series · Best of 5"
          onClose={() => setOpen(false)}
          actions={
            <>
              <button type="button" className="btn subtle" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" form="add-match" className="btn primary">Save series</button>
            </>
          }
        >
          <form id="add-match" onSubmit={save}>
            <div className="inline-fields">
              <Field label="Team">
                <select value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })}>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
              <Field label="Opponent">
                <input value={form.opponent} onChange={(e) => setForm({ ...form, opponent: e.target.value })} required />
              </Field>
              <Field label="Date">
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </Field>
            </div>
            <div className="bo5-maps">
              {games.map((slot) => (
                <div key={slot.index} className="bo5-map">
                  <div className="bo5-map-label">
                    <span>G{slot.index + 1}</span>
                    <strong>{MODE_SHORT[slot.mode] || slot.mode}</strong>
                  </div>
                  <Field label="Map">
                    <select value={slot.map} onChange={(e) => patchGame(slot.index, { map: e.target.value })}>
                      <option value="">—</option>
                      {maps.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </Field>
                  <Field label="Result">
                    <select value={slot.result} onChange={(e) => patchGame(slot.index, { result: e.target.value })}>
                      <option value="">—</option>
                      <option>Win</option>
                      <option>Loss</option>
                    </select>
                  </Field>
                  <Field label="Points">
                    <input
                      value={slot.score}
                      onChange={(e) => patchGame(slot.index, { score: e.target.value })}
                      placeholder={scorePlaceholder(slot.mode)}
                    />
                  </Field>
                </div>
              ))}
            </div>
            <div className="field-hint" style={{ marginTop: 8 }}>
              HP → SnD → OL → HP → SnD. Drop scoreboards in Scoreboard Inbox to fill player stats.
            </div>
          </form>
          <Err error={error} />
        </FormCard>
      ) : null}
    </>
  );
}
