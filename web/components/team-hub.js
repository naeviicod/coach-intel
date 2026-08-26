'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { HUB_SECTIONS, hubPath } from '../lib/hub';
import { fmtDate, fmtStamp, TeamMark } from '../lib/marks';
import { statsByKey } from '../lib/stats';
import { Icon } from './icon';
import { HubOverview } from './hub-overview';
import { HubRoster } from './hub-roster';
import { HubNotes } from './hub-notes';
import { HubObjectives } from './hub-objectives';
import { HubVeto } from './hub-veto';
import { HubPlanner } from './hub-planner';
import { HubSettings } from './hub-settings';
import { CtxToggle, MiniEmpty } from './hub-parts';
import { ReportsView } from './reports-view';
import { StatisticsView } from './statistics-view';

export function TeamHub({
  team,
  teams,
  section,
  sub,
  members,
  matches,
  notes,
  strats,
  events,
  tasks,
  scrims,
  opponents,
  ruleset,
  canEdit,
  author,
  reviewCount,
}) {
  const router = useRouter();
  const [ctxOpen, setCtxOpen] = useState(false);
  const counts = { members: members.length, notes: notes.length };
  const ctxToggle = <CtxToggle open={ctxOpen} onToggle={() => setCtxOpen((v) => !v)} />;

  function go(next, ...rest) {
    router.push(hubPath(team.id, next, ...rest));
  }

  return (
    <div className={`hub${canEdit ? '' : ' team-readonly'}`}>
      <header className="hub-rail">
        <div className="team-select">
          {teams.length > 1 ? (
            <label className="team-select-static">
              <TeamMark team={team} className="sb-org-logo" />
              <select
                aria-label="Team"
                className="team-select-name"
                value={team.id}
                onChange={(e) => router.push(hubPath(e.target.value, section))}
                style={{ background: 'transparent', border: 0, color: 'inherit', font: 'inherit', fontWeight: 700 }}
              >
                {teams.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="team-select-static" aria-label={team.name}>
              <TeamMark team={team} className="sb-org-logo" />
              <span className="team-select-name">{team.name}</span>
            </div>
          )}
        </div>
        <nav className="hub-rail-nav" aria-label={`${team.name} sections`}>
          {HUB_SECTIONS.map((def) => {
            const count = def.count ? counts[def.count] : null;
            const on = def.key === section;
            return (
              <Link
                key={def.key}
                href={hubPath(team.id, def.key)}
                className={`rail-link${on ? ' active' : ''}`}
                aria-current={on ? 'page' : undefined}
              >
                <Icon name={def.icon} size={14} />
                <span>{def.label}</span>
                {count === null || count === undefined ? null : <span className="count">{count}</span>}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="hub-body">
        <div className="hub-workspace">
          {section === 'overview' ? (
            <HubOverview
              team={team}
              matches={matches}
              notes={notes}
              strats={strats}
              ruleset={ruleset}
              canEdit={canEdit}
              ctxToggle={ctxToggle}
              go={go}
              reviewCount={reviewCount}
            />
          ) : null}
          {section === 'roster' ? (
            <HubRoster team={team} members={members} matches={matches} ctxToggle={ctxToggle} />
          ) : null}
          {section === 'notes' ? (
            <HubNotes team={team} notes={notes} canEdit={canEdit} author={author} ctxToggle={ctxToggle} openId={sub[0]} />
          ) : null}
          {section === 'objectives' ? (
            <HubObjectives team={team} tasks={tasks} canEdit={canEdit} ctxToggle={ctxToggle} />
          ) : null}
          {section === 'veto' ? <HubVeto team={team} matches={matches} ctxToggle={ctxToggle} /> : null}
          {section === 'statistics' ? (
            <>
              <HubHeadWrap title="Statistics" sub={`Player performance across ${team.name}'s logged matches`} ctxToggle={ctxToggle} />
              <StatisticsView teams={[team]} members={members} matches={matches} embedded />
            </>
          ) : null}
          {section === 'reports' ? (
            <>
              <HubHeadWrap title="Reports" sub="Exportable performance and opponent scout reports for this team" ctxToggle={ctxToggle} />
              <ReportsView
                teams={[team]}
                members={members}
                matches={matches}
                scrims={scrims}
                opponents={opponents}
                embedded
                lockedTeamId={team.id}
              />
            </>
          ) : null}
          {section === 'practice' ? (
            <HubPlanner
              team={team}
              events={events}
              tasks={tasks}
              matches={matches}
              scrims={scrims}
              strats={strats}
              canEdit={canEdit}
              ctxToggle={ctxToggle}
            />
          ) : null}
          {section === 'settings' ? (
            <HubSettings
              team={team}
              members={members}
              strats={strats}
              matches={matches}
              notes={notes}
              tasks={tasks}
              canEdit={canEdit}
              ctxToggle={ctxToggle}
            />
          ) : null}
        </div>
        <aside className={`hub-context${ctxOpen ? ' open' : ''}`} aria-label="Context panel">
          <HubContext
            matches={matches}
            strats={strats}
            reviewCount={reviewCount}
            teamId={team.id}
          />
        </aside>
      </div>
    </div>
  );
}

function HubHeadWrap({ title, sub, ctxToggle }) {
  return (
    <div className="hub-head" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 className="hub-title">{title}</h1>
        {sub ? <div className="hub-sub">{sub}</div> : null}
      </div>
      {ctxToggle ? <div className="page-header-actions">{ctxToggle}</div> : null}
    </div>
  );
}

function HubContext({ matches, strats, reviewCount, teamId }) {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = matches
    .filter((m) => m.date > today && !m.result)
    .sort((a, b) => (a.date > b.date ? 1 : -1))[0];
  const byOpponent = statsByKey(matches, (m) => m.opponent || 'Unknown');
  const drafts = strats.filter((s) => String(s.status || '').toUpperCase() === 'DRAFT');
  const latest = strats[0];

  return (
    <>
      <div className="ctx-card">
        <div className="ctx-title"><span>Upcoming Match</span></div>
        {upcoming ? (
          <div className="ctx-match">
            <div className="ctx-opponent">{upcoming.opponent || 'Unknown opponent'}</div>
            <div className="ctx-when">{fmtDate(upcoming.date)}</div>
            {upcoming.map ? <div className="field-hint">{`${upcoming.map} · ${upcoming.mode || ''}`}</div> : null}
          </div>
        ) : (
          <MiniEmpty title="No match scheduled" body="Fixtures are not tracked yet, so nothing is shown here." />
        )}
      </div>
      <div className="ctx-card">
        <div className="ctx-title">
          <span>Opponent Intel</span>
          <Link href={`/scouting?team=${encodeURIComponent(teamId)}`} className="btn subtle sm">Scout</Link>
        </div>
        {byOpponent.length === 0 ? (
          <MiniEmpty title="No head-to-head data" body="Log matches and your record against each opponent appears here." />
        ) : (
          byOpponent.slice(0, 5).map((row) => (
            <div key={row.key} className="ctx-row">
              <div className="ctx-row-name">{row.key}</div>
              <div className={`ctx-row-val ${row.winRate >= 50 ? 'win' : 'loss'}`}>{`${row.wins}-${row.losses}`}</div>
            </div>
          ))
        )}
      </div>
      <div className="ctx-card">
        <div className="ctx-title"><span>Needs Attention</span></div>
        {reviewCount ? (
          <Link href={`/needs-review?team=${encodeURIComponent(teamId)}`} className="ctx-alert">
            <Icon name="review" size={13} />
            <span>{`${reviewCount} item${reviewCount === 1 ? '' : 's'} need review`}</span>
          </Link>
        ) : null}
        {drafts.slice(0, 4).map((strat) => (
          <Link
            key={strat.strategy_id || strat.id}
            href={`/playbooks?team=${encodeURIComponent(teamId)}`}
            className="ctx-row link"
          >
            <div className="ctx-row-name">{strat.strategy_name || strat.title}</div>
            <span className="spill draft">{strat.status || 'DRAFT'}</span>
          </Link>
        ))}
        {!reviewCount && !drafts.length ? <MiniEmpty title="All clear" body="No drafts or unreviewed data for this team." /> : null}
        {latest ? <div className="ctx-foot">Last strat update {fmtStamp(latest.updated_at)}</div> : null}
      </div>
    </>
  );
}
