'use client';

import { useMemo, useState } from 'react';
import { newId, saveDoc } from '../lib/docs';
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

  function setMap(index, map) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, map } : s)));
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

  return (
    <>
      <PageHeader
        title="Veto Lab"
        subtitle={`${team.name}: model the map veto, then keep the book`}
        actions={<TeamPicker teams={teams} teamId={team.id} />}
      />
      <div className="veto-config">
        <input list="veto-opp-list" placeholder="Opponent" value={opponent} onChange={(e) => setOpponent(e.target.value)} />
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
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        {groups.map((group) => (
          <div key={group.mode} className="card">
            <div className="card-head"><h2>{shortMode(group.mode)}</h2></div>
            {group.steps.map((step) => {
              const idx = steps.indexOf(step);
              const pool = availableMaps(step, steps, pools);
              const hints = suggestForStep(intel, step, pool);
              return (
                <div key={`${group.mode}-${idx}`} className="crow">
                  <div className="crow-main">
                    <div className="crow-title">{step.action} · {step.team === 'us' ? 'Us' : 'Them'}</div>
                    {hints[0] ? <div className="crow-sub">{hints[0].why}: {hints[0].map}</div> : null}
                  </div>
                  <select value={step.map || ''} onChange={(e) => setMap(idx, e.target.value || null)}>
                    <option value="">—</option>
                    {(step.map && !pool.includes(step.map) ? [step.map, ...pool] : pool).map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="section-title">Series</div>
      <div className="card">
        {series.map((g) => (
          <div key={g.game} className="crow">
            <div className="crow-main">
              <div className="crow-title">Game {g.game}</div>
              <div className="crow-sub">{g.mode}</div>
            </div>
            <div className="crow-meta">{g.map || '—'}</div>
          </div>
        ))}
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
