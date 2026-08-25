'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createBrowserSupabase } from '../lib/supabase/browser';
import { fmtDue, OrgMark, TeamMark, teamWinRate } from '../lib/marks';

function MiniEmpty({ title, body }) {
  return (
    <div className="mini-empty">
      <div className="title">{title}</div>
      <div>{body}</div>
    </div>
  );
}

function Kpi({ href, label, value, meta, accent }) {
  return (
    <Link href={href} className="kpi">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value${accent ? ' accent' : ''}`}>{value}</div>
      <div className="kpi-meta">{meta}</div>
    </Link>
  );
}

function teamsDensity(count) {
  if (count <= 2) return 'roomy';
  return count <= 8 ? 'compact' : 'dense';
}

export function OrgDashboard({
  org: initialOrg,
  teams: initialTeams,
  members: initialMembers,
  tasks: initialTasks = [],
  matches: initialMatches = [],
  notes: initialNotes = [],
}) {
  const [org, setOrg] = useState(initialOrg);
  const [teams, setTeams] = useState(initialTeams || []);
  const [members, setMembers] = useState(initialMembers || []);
  const [tasks, setTasks] = useState(initialTasks || []);
  const [matches, setMatches] = useState(initialMatches || []);
  const [notes, setNotes] = useState(initialNotes || []);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    async function refresh() {
      const [{ data: teamRows }, { data: memberRows }, { data: orgRow }, { data: docs }] = await Promise.all([
        supabase.from('teams').select('id, name, tag, logo').order('created_at', { ascending: true }),
        supabase.from('members').select('id, team_id, gamertag, name, role, slot, title, user_id, photo'),
        supabase.from('shared_docs').select('payload').eq('kind', 'org').eq('id', 'profile').is('deleted_at', null).maybeSingle(),
        supabase.from('shared_docs').select('kind, team_id, payload').is('deleted_at', null).in('kind', ['task', 'match', 'note']),
      ]);
      if (teamRows) setTeams(teamRows);
      if (memberRows) setMembers(memberRows);
      if (orgRow?.payload) setOrg(orgRow.payload);
      if (docs) {
        const unpack = (kind) =>
          docs.filter((d) => d.kind === kind).map((d) => ({ ...d.payload, team_id: d.team_id, id: d.payload?.id || d.id }));
        setTasks(unpack('task'));
        setMatches(unpack('match'));
        setNotes(unpack('note'));
      }
    }
    const channel = supabase
      .channel('ci-org-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_docs' }, refresh)
      .subscribe();
    refresh();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  const byTeam = useMemo(() => {
    const map = new Map(teams.map((team) => [team.id, { members: [], matches: [], tasks: [], notes: [] }]));
    for (const member of members) {
      if (!map.has(member.team_id)) continue;
      map.get(member.team_id).members.push(member);
    }
    for (const match of matches) {
      if (!map.has(match.team_id)) continue;
      map.get(match.team_id).matches.push(match);
    }
    for (const task of tasks) {
      if (!map.has(task.team_id)) continue;
      map.get(task.team_id).tasks.push(task);
    }
    for (const note of notes) {
      if (!map.has(note.team_id)) continue;
      map.get(note.team_id).notes.push(note);
    }
    return map;
  }, [teams, members, matches, tasks, notes]);

  const perTeam = teams.map((team) => ({ team, ...byTeam.get(team.id) }));
  const allMatches = matches;
  const openTasks = tasks.filter((task) => !task.done).map((task) => ({
    ...task,
    team: teams.find((t) => t.id === task.team_id),
  }));
  const overdue = openTasks.filter((t) => fmtDue(t.due).overdue);
  const soon = openTasks.filter((t) => !fmtDue(t.due).overdue).slice(0, 5 - Math.min(overdue.length, 5));
  const shown = [...overdue.slice(0, 5), ...soon];
  const density = teamsDensity(perTeam.length);
  const orgName = org?.name || 'Your organization';

  return (
    <>
      <div className="page-header">
        <div className="page-identity">
          <OrgMark org={org} className="sb-org-logo page-org-logo" />
          <div style={{ minWidth: 0 }}>
            <div className="page-org-name">{orgName}</div>
            <div className="page-title">Dashboard</div>
            <div className="page-subtitle">What needs attention today</div>
          </div>
        </div>
      </div>
      {teams.length === 0 ? (
        <div className="card empty-state">
          <div className="title">No teams yet</div>
        </div>
      ) : (
        <>
          <div className="kpi-row">
            <Kpi href="/teams" label="Teams" value={teams.length} meta="In organization" />
            <Kpi
              href="/tasks"
              label="Open Tasks"
              value={openTasks.length}
              meta={overdue.length ? `${overdue.length} overdue` : 'Nothing overdue'}
              accent={openTasks.length > 0}
            />
            <Kpi href="/needs-review" label="Scoreboard Inbox" value={0} meta="Queue clear" />
            <Kpi
              href="/matches"
              label="Matches"
              value={allMatches.length}
              meta={allMatches.length ? `${teamWinRate(allMatches)}% win rate` : 'None yet'}
            />
          </div>
          <div className="grid cols-2" style={{ marginBottom: 14 }}>
            <div className="card compact">
              <div className="card-head">
                <h2>Needs Attention</h2>
                <Link href="/tasks" className="btn subtle sm">All tasks →</Link>
              </div>
              {shown.length === 0 ? (
                <MiniEmpty title="Nothing pending" body="No open tasks and no screenshots waiting for review." />
              ) : (
                shown.map((task) => {
                  const due = fmtDue(task.due);
                  return (
                    <div key={task.id || task.task_id} className="crow">
                      <div className="crow-main">
                        <div className="crow-title">{task.title || 'Task'}</div>
                        <div className="crow-sub">{task.team?.name || 'Team'}</div>
                      </div>
                      <div className={`crow-meta${due.overdue ? ' overdue' : ''}`}>{due.label}</div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="card compact">
              <div className="card-head">
                <h2>Recent Intel</h2>
                <Link href="/intel-feed" className="btn subtle sm">Intel Feed →</Link>
              </div>
              <MiniEmpty title="No signals yet" body="Signals surface once teams have enough matches and scrims on the books." />
            </div>
          </div>
          <div className="card compact">
            <div className="card-head">
              <h2>Teams</h2>
              {density === 'roomy' ? null : <div className="card-meta">{perTeam.length} teams</div>}
            </div>
            <div className="team-grid" data-density={density}>
              {perTeam.map(({ team, members: roster, matches: teamMatches, notes: teamNotes }) => {
                const lastNote = teamNotes[0];
                if (density === 'roomy') {
                  return (
                    <Link key={team.id} href={`/teams/${encodeURIComponent(team.id)}`} className="crow">
                      <TeamMark team={team} />
                      <div className="crow-main">
                        <div className="crow-title">{team.name}</div>
                        <div className="crow-sub">
                          {roster.length} player{roster.length === 1 ? '' : 's'}
                          <span> · </span>
                          {teamMatches.length ? `${teamMatches.length} matches · ${teamWinRate(teamMatches)}%` : 'No matches'}
                        </div>
                      </div>
                      <div className="crow-meta">{lastNote ? 'Note on file' : 'No notes'}</div>
                    </Link>
                  );
                }
                return (
                  <Link key={team.id} href={`/teams/${encodeURIComponent(team.id)}`} className="team-tile">
                    <TeamMark team={team} />
                    <div className="crow-title">{team.name}</div>
                    <div className="crow-sub">
                      {roster.length} · {teamMatches.length ? `${teamWinRate(teamMatches)}%` : '—'}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
