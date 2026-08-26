'use client';

import { useMemo, useState } from 'react';
import { newId, saveDoc } from '../lib/docs';
import { mapCoverSrc } from '../lib/maps';
import { poolsByMode, resolveRuleset } from '../lib/ruleset';
import { availableMaps, buildVetoSequence, groupStepsByMode, isSequenceComplete, resultSeries, seriesModes, shortMode, VETO_FORMATS } from '../lib/veto';
import { collectVetoes, intelForOpponent, suggestForStep, summaryLines } from '../lib/vetoIntel';
import { EmptyState, PageHeader } from './page-header';
import { Err, pickTeam, TeamPicker } from './workspace';

export function VetoLabView({ teams, vetoes, opponents, matches, rulesetDocs, teamId, canEdit }) {
  const team = pickTeam(teams, teamId);
  const ruleset = resolveRuleset(rulesetDocs);
  const modes = ruleset.modes || ['Hardpoint', 'Search & Destroy', 'Overload'];
  const pools = poolsByMode(ruleset);
  const catalog = collectVetoes({ teamVetoes: vetoes, opponents });
  const [opponent, setOpponent] = useState('');
  const [format, setFormat] = useState('Bo5');
  const [first, setFirst] = useState('us');
  const [steps, setSteps] = useState(() => buildVetoSequence({ modes: seriesModes('Bo5', modes), poolsByMode: pools, first: 'us' }).steps);
  const [error, setError] = useState('');
  const intel = intelForOpponent(opponent, catalog);
  const seriesModesList = useMemo(() => seriesModes(format, modes), [format, modes]);

  function rebuild(nextFormat, nextFirst) {
    const seq = buildVetoSequence({ modes: seriesModes(nextFormat, modes), poolsByMode: pools, first: nextFirst });
    setSteps(seq.steps);
  }

  function assign(map) {
    const idx = steps.findIndex((s) => !s.map);
    if (idx === -1) return;
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, map } : s)));
  }

  function undoTo(index) {
    setSteps((prev) => prev.map((s, i) => (i >= index ? { ...s, map: null } : s)));
  }

  async function save() {
    if (!team || !canEdit) return;
    setError('');
    try {
      const id = newId('veto');
      await saveDoc({
        kind: 'veto',
        teamId: team.id,
        id,
        payload: { veto_id: id, team_id: team.id, opponent: opponent || 'Opponent', format, first, steps, notes: '' },
      });
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Could not save veto.');
    }
  }

  if (!teams.length) {
    return (
      <>
        <PageHeader title="Veto Lab" subtitle="Model veto trees against an opponent before the match" />
        <EmptyState title="No teams yet" body="Create a team to model vetoes against your opponents." />
      </>
    );
  }

  const groups = groupStepsByMode(steps);
  const series = resultSeries(seriesModesList, steps);
  const saved = vetoes.filter((v) => v.team_id === team.id);
  const cursor = steps.findIndex((s) => !s.map);
  const current = cursor === -1 ? null : steps[cursor];
  const pool = current ? availableMaps(current, steps, pools) : [];
  const hints = current ? suggestForStep(intel, current, pool) : [];
  const hintFor = Object.fromEntries(hints.map((h) => [h.map, h]));

  return (
    <>
      <PageHeader
        title="Veto Lab"
        subtitle={`${team.name}: model the map veto, then keep the book`}
        actions={<TeamPicker teams={teams} teamId={team.id} />}
      />
      <div className="veto-config">
        <input type="text" list="veto-opp-list" placeholder="Opponent" value={opponent} onChange={(e) => setOpponent(e.target.value)} />
        <datalist id="veto-opp-list">
          {opponents.map((o) => <option key={o.opponent_id || o.id} value={o.name} />)}
        </datalist>
        <select value={format} onChange={(e) => { setFormat(e.target.value); rebuild(e.target.value, first); }}>
          {VETO_FORMATS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <select value={first} onChange={(e) => { setFirst(e.target.value); rebuild(format, e.target.value); }}>
          <option value="us">We veto first</option>
          <option value="them">They veto first</option>
        </select>
        {canEdit ? <button type="button" className="btn primary" onClick={save} disabled={!isSequenceComplete(steps)}>Save plan</button> : null}
      </div>
      <Err error={error} />
      {summaryLines(intel).map((line) => <div key={line} className="field-hint" style={{ marginBottom: 6 }}>{line}</div>)}
      <div className="grid veto-modes">
        {groups.map((group) => (
          <div key={group.mode} className="veto-col">
            <div className="veto-col-mode">{group.mode}</div>
            {group.steps.map((step) => {
              const idx = steps.indexOf(step);
              const isCurrent = idx === cursor;
              return (
                <div key={`${group.mode}-${idx}`} className={`veto-step${isCurrent ? ' current' : ''}${step.map ? ' done' : ''}`}>
                  <span className={`veto-turn ${step.team}`}>{step.team === 'us' ? 'US' : 'THEM'}</span>
                  <span className={`veto-act ${step.action}`}>{step.action === 'pick' ? 'PICK' : 'BAN'}</span>
                  <span className="veto-map">{step.map || (isCurrent ? 'Choose' : 'open')}</span>
                  {step.map ? (
                    <button type="button" className="btn sm subtle" onClick={() => undoTo(idx)}>Undo</button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {current ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-head">
            <h2>{current.team === 'us' ? 'Your' : 'Their'} {current.action} · {current.mode}</h2>
            {hints.length ? <div className="card-meta">Highlighted from the book</div> : null}
          </div>
          {pool.length ? (
            <div className="grid veto-pool">
              {pool.map((map) => {
                const src = mapCoverSrc(map);
                const hint = hintFor[map];
                return (
                  <button key={map} type="button" className={`veto-tile ${current.action}${hint ? ' hint' : ''}`} onClick={() => assign(map)}>
                    {src ? (
                      <span className="veto-tile-art">
                        <img src={src} alt="" />
                      </span>
                    ) : null}
                    <span className="veto-tile-name">{map}</span>
                    {hint ? <span className="veto-tile-why">{hint.why}: {hint.map}</span> : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="field-hint">No maps left in this pool.</div>
          )}
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="field-hint" style={{ padding: 6 }}>Veto complete. Every map is locked.</div>
        </div>
      )}
      <div className="section-title">Series</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="veto-series">
          {series.map((g) => (
            <div key={g.game} className="veto-game">
              <div className="veto-game-n">Game {g.game}</div>
              <div className={`veto-game-map${g.map ? '' : ' pending'}`}>{g.map || 'Pending'}</div>
              <div className="veto-game-mode">{shortMode(g.mode)} · {g.mode}</div>
            </div>
          ))}
        </div>
      </div>
      {saved.length ? (
        <>
          <div className="section-title">Saved plans</div>
          <div className="card">
            {saved.map((v) => (
              <div key={v.veto_id || v.id} className="crow">
                <div className="crow-main">
                  <div className="crow-title">{v.opponent}</div>
                  <div className="crow-sub">{v.format} · {v.first === 'them' ? 'They first' : 'We first'}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
