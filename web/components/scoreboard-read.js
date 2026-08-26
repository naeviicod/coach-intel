'use client';

import { useMemo, useState } from 'react';
import { saveDoc } from '../lib/docs';
import {
  applyScoreboardToRoster,
  bo5Modes,
  emptyPlayerLine,
  findSeriesMatch,
  guessMapFromName,
  nextUnfiledGame,
  playingRoster,
} from '../lib/series';
import { scoreboardAssetUrl } from '../lib/scoreboards';
import { Err, Field, FormCard } from './workspace';

const MODE_SHORT = {
  Hardpoint: 'HP',
  'Search & Destroy': 'SnD',
  Overload: 'OL',
};

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function ScoreboardRead({
  item,
  team,
  members,
  matches,
  maps = [],
  modes = [],
  onClose,
}) {
  const roster = useMemo(() => playingRoster(members.filter((m) => m.team_id === team.id)), [members, team.id]);
  const bo5 = useMemo(() => bo5Modes(modes), [modes]);
  const date = item.date || new Date().toISOString().slice(0, 10);
  const guessedMap = guessMapFromName(item.name, maps);
  const sameDay = (matches || []).filter((m) => m.team_id === team.id && String(m.date || '').slice(0, 10) === date);
  const gameStart = nextUnfiledGame(matches, { teamId: team.id, date });
  const existing = findSeriesMatch(matches, { teamId: team.id, date, game: gameStart });
  const seriesHead = sameDay[0] || null;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    opponent: existing?.opponent || seriesHead?.opponent || '',
    date,
    game: gameStart,
    map: existing?.map || guessedMap,
    result: existing?.result || 'Win',
    score: existing?.score || '',
  });
  const [players, setPlayers] = useState(() => {
    if (existing?.players?.length) {
      const byId = new Map(existing.players.map((p) => [p.member_id, p]));
      return roster.map((m) => ({ ...emptyPlayerLine(m), ...(byId.get(m.id) || {}) }));
    }
    return roster.map(emptyPlayerLine);
  });
  const [paste, setPaste] = useState('');
  const mode = bo5[Number(form.game) - 1] || bo5[0] || 'Hardpoint';

  function patchPlayer(memberId, patch) {
    setPlayers((rows) => rows.map((row) => (row.member_id === memberId ? { ...row, ...patch } : row)));
  }

  function applyPaste() {
    const next = applyScoreboardToRoster(paste, roster);
    setPlayers(next);
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const game = Number(form.game) || 1;
      const hit = findSeriesMatch(matches, { teamId: team.id, date: form.date, game, mode, map: form.map });
      const id = hit?.match_id || hit?.id || `series-${form.date}-${team.id}-g${game}`;
      const playerRows = players.map((p) => ({
        ...p,
        kills: num(p.kills),
        deaths: num(p.deaths),
        assists: num(p.assists),
        damage: num(p.damage),
      }));
      await saveDoc({
        kind: 'match',
        teamId: team.id,
        id,
        payload: {
          ...(hit || {}),
          match_id: id,
          series_id: hit?.series_id || `series-${form.date}-${team.id}`,
          game,
          format: 'Bo5',
          team_id: team.id,
          opponent: form.opponent,
          date: form.date,
          map: form.map,
          mode,
          result: form.result,
          score: form.score,
          players: playerRows,
          scoreboard_path: item.path,
        },
      });
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Could not file this board.');
      setBusy(false);
    }
  }

  return (
    <FormCard
      title={`File scoreboard · ${MODE_SHORT[mode] || mode}`}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn subtle" onClick={onClose}>Cancel</button>
          <button type="submit" form="file-scoreboard" className="btn primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save into stats'}
          </button>
        </>
      }
    >
      <div className="sb-read">
        <div className="sb-read-preview">
          <img src={scoreboardAssetUrl(item.path)} alt={item.name} />
          <div className="field-hint">{item.name}</div>
        </div>
        <form id="file-scoreboard" onSubmit={save}>
          <div className="inline-fields">
            <Field label="Opponent">
              <input value={form.opponent} onChange={(e) => setForm({ ...form, opponent: e.target.value })} required />
            </Field>
            <Field label="Date">
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Game">
              <select value={form.game} onChange={(e) => setForm({ ...form, game: Number(e.target.value) })}>
                {bo5.map((m, i) => (
                  <option key={m + i} value={i + 1}>G{i + 1} · {MODE_SHORT[m] || m}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="inline-fields">
            <Field label="Map">
              <select value={form.map} onChange={(e) => setForm({ ...form, map: e.target.value })}>
                <option value="">—</option>
                {maps.map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Result">
              <select value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })}>
                <option>Win</option>
                <option>Loss</option>
              </select>
            </Field>
            <Field label="Points">
              <input value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} placeholder="250-180" />
            </Field>
          </div>
          <div className="field-hint" style={{ margin: '8px 0' }}>
            Mode is locked to the BO5 order: HP → SnD → OL → HP → SnD. Enter the four lines from this board.
          </div>
          {roster.length ? (
            <table className="sb-stat-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>K</th>
                  <th>D</th>
                  <th>A</th>
                  <th>DMG</th>
                </tr>
              </thead>
              <tbody>
                {players.map((row) => (
                  <tr key={row.member_id}>
                    <td>{row.gamertag}</td>
                    <td><input type="number" min="0" value={row.kills} onChange={(e) => patchPlayer(row.member_id, { kills: e.target.value })} /></td>
                    <td><input type="number" min="0" value={row.deaths} onChange={(e) => patchPlayer(row.member_id, { deaths: e.target.value })} /></td>
                    <td><input type="number" min="0" value={row.assists} onChange={(e) => patchPlayer(row.member_id, { assists: e.target.value })} /></td>
                    <td><input type="number" min="0" value={row.damage} onChange={(e) => patchPlayer(row.member_id, { damage: e.target.value })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="field-hint">Add players on the roster first so this board can attach to them.</div>
          )}
          <Field label="Or paste the scoreboard lines (Name K D A DMG)">
            <textarea rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="NaeviiSZN 24 8 6 2840" />
          </Field>
          {paste ? (
            <button type="button" className="btn sm" onClick={applyPaste}>Read pasted lines</button>
          ) : null}
          <Err error={error} />
        </form>
      </div>
    </FormCard>
  );
}
