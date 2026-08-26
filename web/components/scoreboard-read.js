'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { deleteScoreboard, readScoreboardText, scoreboardAssetUrl } from '../lib/scoreboards';
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

function clockValue(seconds) {
  const n = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(n / 60);
  const s = String(n % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function parseClockInput(value) {
  const clock = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
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
  onRemoved,
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
  const [reading, setReading] = useState(true);
  const [form, setForm] = useState({
    opponent: existing?.opponent || seriesHead?.opponent || '',
    date,
    game: gameStart,
    map: existing?.map || guessedMap,
    result: existing?.result || 'Win',
    score: existing?.score || '',
  });
  const [players, setPlayers] = useState(() => roster.map(emptyPlayerLine));
  const [paste, setPaste] = useState('');
  const mode = bo5[Number(form.game) - 1] || bo5[0] || 'Hardpoint';
  const hp = mode === 'Hardpoint';
  const rounds = mode === 'Search & Destroy' || mode === 'Overload';

  function applyBoard(text) {
    const next = applyScoreboardToRoster(text, roster, { matchedOnly: true });
    setPlayers(next.length ? next : roster.map(emptyPlayerLine));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setReading(true);
      const text = await readScoreboardText(scoreboardAssetUrl(item.path));
      if (cancelled) return;
      if (text) {
        setPaste(text);
        applyBoard(text);
      }
      setReading(false);
    })();
    return () => { cancelled = true; };
  }, [item.path, roster]);

  function patchPlayer(memberId, patch) {
    setPlayers((rows) => rows.map((row) => (row.member_id === memberId ? { ...row, ...patch } : row)));
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
        hill_time: num(p.hill_time),
        rounds_won: num(p.rounds_won),
        rounds_lost: num(p.rounds_lost),
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

  async function removeBoard() {
    setError('');
    setBusy(true);
    try {
      await deleteScoreboard(item.path);
      onRemoved?.(item);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not remove that scoreboard.');
      setBusy(false);
    }
  }

  return (
    <FormCard
      title={`File scoreboard · ${MODE_SHORT[mode] || mode}`}
      actions={
        <>
          <button type="button" className="btn subtle" onClick={removeBoard} disabled={busy}>Remove scoreboard</button>
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
              <input value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} placeholder={hp ? '250-180' : '6-4'} />
            </Field>
          </div>
          <div className="field-hint" style={{ margin: '8px 0' }}>
            {reading
              ? 'Reading names from this board and matching them to the roster…'
              : hp
                ? 'Roster names are matched to this board. Hill time is the extra HP stat.'
                : 'Roster names are matched to this board. Rounds won/lost are the extra SnD and Overload stat.'}
          </div>
          {roster.length ? (
            <table className="sb-stat-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>K</th>
                  <th>D</th>
                  {hp ? <th>Time</th> : null}
                  {rounds ? <th>Rnd W</th> : null}
                  {rounds ? <th>Rnd L</th> : null}
                </tr>
              </thead>
              <tbody>
                {players.map((row) => (
                  <tr key={row.member_id}>
                    <td>{row.gamertag}</td>
                    <td><input type="number" min="0" value={row.kills} onChange={(e) => patchPlayer(row.member_id, { kills: e.target.value })} /></td>
                    <td><input type="number" min="0" value={row.deaths} onChange={(e) => patchPlayer(row.member_id, { deaths: e.target.value })} /></td>
                    {hp ? (
                      <td>
                        <input
                          value={clockValue(row.hill_time)}
                          onChange={(e) => patchPlayer(row.member_id, { hill_time: parseClockInput(e.target.value) })}
                        />
                      </td>
                    ) : null}
                    {rounds ? (
                      <td><input type="number" min="0" value={row.rounds_won} onChange={(e) => patchPlayer(row.member_id, { rounds_won: e.target.value })} /></td>
                    ) : null}
                    {rounds ? (
                      <td><input type="number" min="0" value={row.rounds_lost} onChange={(e) => patchPlayer(row.member_id, { rounds_lost: e.target.value })} /></td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="field-hint">Add players on the roster first so this board can attach to them.</div>
          )}
          <Field label="Board lines (filled from the file; paste to correct)">
            <textarea
              rows={4}
              value={paste}
              onChange={(e) => {
                setPaste(e.target.value);
                applyBoard(e.target.value);
              }}
              placeholder={hp ? 'NaeviiSZN 27/23 1:49' : 'NaeviiSZN 8/6 3-2'}
            />
          </Field>
          <Err error={error} />
        </form>
      </div>
    </FormCard>
  );
}
