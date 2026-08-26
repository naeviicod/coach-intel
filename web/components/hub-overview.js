'use client';

import Link from 'next/link';
import { useState } from 'react';
import { fmtStamp } from '../lib/marks';
import { activeMaps, modeNames } from '../lib/ruleset';
import { advancedMetricsForMode, pctDelta, round, statsByKey, teamKD, teamWinRate } from '../lib/stats';
import { createBrowserSupabase } from '../lib/supabase/browser';
import { MetricRow, MiniEmpty } from './hub-parts';

const MODES = [
  { key: 'hardpoint', label: 'Hardpoint', mode: 'Hardpoint' },
  { key: 'search-destroy', label: 'Search & Destroy', mode: 'Search & Destroy' },
  { key: 'overload', label: 'Overload', mode: 'Overload' },
];

export function HubOverview({ team, matches, notes, strats, ruleset, canEdit, ctxToggle, go, reviewCount }) {
  const maps = activeMaps(ruleset);
  const liveStrats = strats.filter((s) => String(s.status).toUpperCase() !== 'ARCHIVED');

  return (
    <>
      {ctxToggle ? (
        <div className="hub-head" style={{ justifyContent: 'flex-end' }}>
          <div className="page-header-actions">{ctxToggle}</div>
        </div>
      ) : null}
      <div className="kpi-row">
        <Link href={`/playbooks?team=${encodeURIComponent(team.id)}`} className="kpi">
          <div className="kpi-label">Strats</div>
          <div className="kpi-value accent">{liveStrats.length}</div>
          <div className="kpi-meta">
            {strats.length === liveStrats.length ? 'Active playbook' : `${strats.length - liveStrats.length} archived`}
          </div>
        </Link>
        <Link href={`/maps-modes?team=${encodeURIComponent(team.id)}`} className={`kpi${canEdit ? '' : ' disabled'}`}>
          <div className="kpi-label">Maps</div>
          <div className="kpi-value">{maps.length}</div>
          <div className="kpi-meta">CDL pool</div>
        </Link>
        <Link href={`/matches?team=${encodeURIComponent(team.id)}`} className="kpi">
          <div className="kpi-label">Matches</div>
          <div className="kpi-value">{matches.length}</div>
          <div className="kpi-meta">{matches.length ? `Season · ${teamWinRate(matches)}% win rate` : 'None logged'}</div>
        </Link>
        <div className="kpi" style={{ cursor: 'default' }}>
          <div className="kpi-label">Next Match</div>
          <div className="kpi-value">—</div>
          <div className="kpi-meta">Not scheduled</div>
        </div>
      </div>
      <ScoreboardCard teamId={team.id} count={reviewCount} canEdit={canEdit} />
      <div className="grid cols-2" style={{ marginBottom: 14 }}>
        <SeasonSummary matches={matches} />
        <NotesCard notes={notes} canEdit={canEdit} onOpen={(id) => go('notes', id)} onAll={() => go('notes')} />
      </div>
      <MapPoolCard team={team} maps={maps} matches={matches} strats={strats} ruleset={ruleset} canEdit={canEdit} />
      <AdvancedStatsCard matches={matches} ruleset={ruleset} />
    </>
  );
}

function ScoreboardCard({ teamId, count, canEdit }) {
  const [error, setError] = useState('');
  async function onFiles(files) {
    if (!canEdit || !files?.length) return;
    const supabase = createBrowserSupabase();
    const date = new Date().toISOString().slice(0, 10);
    try {
      for (const file of files) {
        const path = `scoreboards/${teamId}/${date}/${file.name}`;
        const { error: err } = await supabase.storage.from('org-assets').upload(path, file, { upsert: true });
        if (err) throw err;
      }
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Could not upload.');
    }
  }
  return (
    <div className="card sb-drop-card" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <h2>Scoreboard inbox</h2>
        <Link href={`/needs-review?team=${encodeURIComponent(teamId)}`} className="btn subtle sm">
          {count ? `${count} waiting →` : 'Open inbox →'}
        </Link>
      </div>
      <div className="field-hint" style={{ padding: '8px 0' }}>
        Drop a post-game board. File it into the BO5 map and player stats land on Statistics.
      </div>
      {canEdit ? (
        <label className="btn sm" style={{ cursor: 'pointer', marginBottom: 8 }}>
          Choose files
          <input type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        </label>
      ) : null}
      {error ? <div className="field-hint" style={{ color: 'var(--loss)' }}>{error}</div> : null}
    </div>
  );
}

function SeasonSummary({ matches }) {
  if (!matches.length) {
    return (
      <div className="card compact">
        <div className="card-head"><h2>Season Summary</h2></div>
        <MiniEmpty title="No matches logged" body="Win rate, K/D and form appear once matches are recorded." />
      </div>
    );
  }
  const recent = matches.slice(0, 5);
  const wins = matches.filter((m) => String(m.result || '').toLowerCase() === 'win').length;
  const winRate = teamWinRate(matches);
  const kdAll = teamKD(matches);
  const form = matches.slice(0, 8);
  return (
    <div className="card compact">
      <div className="card-head"><h2>Season Summary</h2></div>
      <MetricRow name="Win Rate" value={`${winRate}%`} delta={pctDelta(teamWinRate(recent), winRate)} />
      <MetricRow name="Avg K/D" value={kdAll.toFixed(2)} delta={pctDelta(teamKD(recent), kdAll)} />
      <MetricRow name="Record" value={`${wins}W–${matches.length - wins}L`} delta={null} />
      <div className="field-hint" style={{ marginTop: 12 }}>Last {form.length} matches — newest first</div>
      <div className="form-strip">
        {form.map((m, i) => (
          <span
            key={m.match_id || m.id || i}
            className={`form-cell ${String(m.result || '').toLowerCase() === 'win' ? 'win' : 'loss'}`}
            title={`${m.map || ''} · ${m.mode || ''}`}
          >
            {String(m.result || '').toLowerCase() === 'win' ? 'W' : 'L'}
          </span>
        ))}
      </div>
    </div>
  );
}

function NotesCard({ notes, canEdit, onOpen, onAll }) {
  return (
    <div className="card compact">
      <div className="card-head">
        <h2>Team Notes</h2>
        {canEdit ? (
          <button type="button" className="btn subtle sm edit-only" onClick={() => onOpen('new')}>+ New note</button>
        ) : null}
      </div>
      {notes.length === 0 ? (
        <MiniEmpty title="No notes yet" body="Capture practice focus, scrim takeaways and map issues so they survive the week.">
          {canEdit ? <button type="button" className="btn primary sm edit-only" onClick={() => onOpen('new')}>Write first note</button> : null}
        </MiniEmpty>
      ) : (
        <>
          {notes.slice(0, 5).map((note) => (
            <button key={note.note_id || note.id} type="button" className="note-row" onClick={() => onOpen(note.note_id || note.id)}>
              <div className="note-title">{note.title}</div>
              <div className="note-meta">{`${note.author || 'Coach'} · ${fmtStamp(note.updated_at)}`}</div>
            </button>
          ))}
          {notes.length > 5 ? (
            <button type="button" className="btn subtle sm" style={{ marginTop: 10 }} onClick={onAll}>
              {`View all ${notes.length} notes →`}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

function MapPoolCard({ team, maps, matches, strats, ruleset, canEdit }) {
  const rulesetModes = modeNames(ruleset);
  const modes = MODES.filter((m) => rulesetModes.includes(m.mode));
  const [active, setActive] = useState(modes[0]?.mode || '');
  if (!maps.length) {
    return (
      <div className="card compact">
        <div className="card-head">
          <h2>Map Pool</h2>
          {canEdit ? <Link href={`/maps-modes?team=${encodeURIComponent(team.id)}`} className="btn subtle sm">Manage maps →</Link> : null}
        </div>
        <MiniEmpty title="No active maps" body="Add maps to the CDL pool from Maps & Modes." />
      </div>
    );
  }
  const modeMaps = maps.filter((m) => (m.modes || []).includes(active));
  const modeMatches = matches.filter((m) => m.mode === active);
  const byMap = Object.fromEntries(statsByKey(modeMatches, (m) => m.map).map((s) => [s.key, s]));
  return (
    <div className="card compact">
      <div className="card-head">
        <h2>Map Pool</h2>
        {canEdit ? <Link href={`/maps-modes?team=${encodeURIComponent(team.id)}`} className="btn subtle sm">Manage maps →</Link> : null}
      </div>
      <div className="filter-bar">
        {modes.map((m) => (
          <button
            key={m.mode}
            type="button"
            className={`mode-chip${m.mode === active ? ' active' : ''}`}
            aria-pressed={String(m.mode === active)}
            onClick={() => setActive(m.mode)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="pool-grid">
        {modeMaps.length === 0 ? (
          <div className="field-hint">{`No maps enabled for ${active}.`}</div>
        ) : (
          modeMaps.map((map) => {
            const stat = byMap[map.name];
            const stratCount = strats.filter((s) => s.map === map.name && s.mode === active).length;
            return (
              <Link key={map.name} href={`/playbooks?team=${encodeURIComponent(team.id)}`} className="pool-tile" title={`${map.name} — ${active}`}>
                <div className="pool-name">{map.name}</div>
                <div className="pool-stats">
                  {stat ? <span className="pool-wr">{`${stat.winRate}%`}</span> : <span className="pool-wr none">No data</span>}
                  <span className="pool-sub">{stat ? `${stat.total} played` : ''}</span>
                </div>
                <div className="pool-sub" style={{ marginTop: 2 }}>{`${stratCount} strat${stratCount === 1 ? '' : 's'}`}</div>
                <div className="pool-bar">
                  <span style={{ width: `${stat ? Math.max(3, round(stat.winRate, 0)) : 0}%` }} />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

function metricRowsFor(mode, m) {
  if (mode === 'Hardpoint') return [['Hold %', m.hold_pct], ['Break %', m.break_pct], ['Rotation %', m.rotation_pct]];
  if (mode === 'Search & Destroy') {
    return [
      ['Offense Win %', m.offense_win_pct],
      ['Defense Win %', m.defense_win_pct],
      ['First Blood Conv. %', m.first_blood_conversion_pct],
      ['First Death Rec. %', m.first_death_recovery_pct],
      ['Plant %', m.plant_pct],
      ['Post-Plant Win %', m.post_plant_win_pct],
      ['Retake %', m.retake_pct],
    ];
  }
  if (mode === 'Overload') return [['Scoring Efficiency %', m.scoring_efficiency_pct], ['Defensive Stop %', m.defensive_stop_pct]];
  return [];
}

function AdvancedStatsCard({ matches, ruleset }) {
  const rulesetModes = ruleset?.modes || ['Hardpoint', 'Search & Destroy', 'Overload'];
  const available = rulesetModes.filter((mode) => advancedMetricsForMode(matches, mode));
  const [active, setActive] = useState(available[0] || '');
  if (!available.length) {
    return (
      <div className="card compact" style={{ marginTop: 14 }}>
        <div className="card-head"><h2>Advanced Stats</h2></div>
        <MiniEmpty
          title="No advanced stats yet"
          body='Open a match and add hold/break/rotation, opening-duel, or scoring detail under "Advanced Stats" to see hold %, break %, retake %, and more here.'
        />
      </div>
    );
  }
  const m = advancedMetricsForMode(matches, active);
  const rows = metricRowsFor(active, m).filter(([, value]) => value !== undefined);
  return (
    <div className="card compact" style={{ marginTop: 14 }}>
      <div className="card-head"><h2>Advanced Stats</h2></div>
      <div className="filter-bar">
        {available.map((mode) => (
          <button key={mode} type="button" className={`mode-chip${mode === active ? ' active' : ''}`} onClick={() => setActive(mode)}>
            {mode}
          </button>
        ))}
      </div>
      <div className="grid cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="card stat-card" style={{ padding: '12px 14px' }}>
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ fontSize: 17 }}>{value === null ? '—' : `${value}%`}</div>
          </div>
        ))}
      </div>
      <div className="field-hint" style={{ marginTop: 8 }}>{`From ${m.sample} match${m.sample === 1 ? '' : 'es'} with advanced stats recorded.`}</div>
    </div>
  );
}
