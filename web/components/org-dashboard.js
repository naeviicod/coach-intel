'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createBrowserSupabase } from '../lib/supabase/browser';

export function OrgDashboard({
  org: initialOrg,
  teams: initialTeams,
  members: initialMembers,
  tasks: initialTasks = [],
  matches: initialMatches = [],
}) {
  const [org, setOrg] = useState(initialOrg);
  const [teams, setTeams] = useState(initialTeams || []);
  const [members, setMembers] = useState(initialMembers || []);
  const [tasks, setTasks] = useState(initialTasks || []);
  const [matches, setMatches] = useState(initialMatches || []);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    async function refresh() {
      const [{ data: teamRows }, { data: memberRows }, { data: orgRow }, { data: docs }] = await Promise.all([
        supabase.from('teams').select('id, name, tag, logo').order('created_at', { ascending: true }),
        supabase.from('members').select('id, team_id, gamertag, name, role, slot, title, user_id'),
        supabase.from('shared_docs').select('payload').eq('kind', 'org').eq('id', 'profile').is('deleted_at', null).maybeSingle(),
        supabase.from('shared_docs').select('kind, team_id, payload').is('deleted_at', null).in('kind', ['task', 'match']),
      ]);
      if (teamRows) setTeams(teamRows);
      if (memberRows) setMembers(memberRows);
      if (orgRow?.payload) setOrg(orgRow.payload);
      if (docs) {
        setTasks(docs.filter((d) => d.kind === 'task').map((d) => ({ ...d.payload, team_id: d.team_id })));
        setMatches(docs.filter((d) => d.kind === 'match').map((d) => ({ ...d.payload, team_id: d.team_id })));
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
    const map = new Map(teams.map((team) => [team.id, []]));
    for (const member of members) {
      if (!map.has(member.team_id)) continue;
      map.get(member.team_id).push(member);
    }
    return map;
  }, [teams, members]);

  const openTasks = tasks.filter((t) => !t.done);
  const orgName = org?.name || 'Your organization';

  return (
    <>
      <header className="page-head dash-head">
        <div className="dash-identity">
          <span className="org-mark">{(org?.tag || orgName).slice(0, 3)}</span>
          <div>
            <p className="eyebrow">{orgName}</p>
            <h1>Dashboard</h1>
            <p className="lede">What needs attention today</p>
          </div>
        </div>
      </header>
      <div className="kpi-row">
        <Link href="/teams" className="kpi">
          <p>Teams</p>
          <strong>{teams.length}</strong>
          <span>In organization</span>
        </Link>
        <Link href="/tasks" className="kpi">
          <p>Open Tasks</p>
          <strong>{openTasks.length}</strong>
          <span>Nothing overdue</span>
        </Link>
        <Link href="/needs-review" className="kpi">
          <p>Scoreboard Inbox</p>
          <strong>0</strong>
          <span>Queue clear</span>
        </Link>
        <Link href="/matches" className="kpi">
          <p>Matches</p>
          <strong>{matches.length}</strong>
          <span>{matches.length ? 'On the book' : 'None yet'}</span>
        </Link>
      </div>
      <div className="dash-grid">
        <section className="dash-card">
          <div className="dash-card-head">
            <h2>Needs Attention</h2>
            <Link href="/tasks" className="text-link">All tasks →</Link>
          </div>
          <p className="dash-empty-title">Nothing pending</p>
          <p className="dash-empty">No open tasks and no screenshots waiting for review.</p>
        </section>
        <section className="dash-card">
          <div className="dash-card-head">
            <h2>Recent Intel</h2>
            <Link href="/intel-feed" className="text-link">Intel Feed →</Link>
          </div>
          <p className="dash-empty-title">No signals yet</p>
          <p className="dash-empty">Signals surface once teams have enough matches and scrims on the books.</p>
        </section>
      </div>
      <section className="dash-card">
        <div className="dash-card-head">
          <h2>Teams</h2>
        </div>
        {teams.length === 0 ? (
          <p className="dash-empty">No teams yet.</p>
        ) : (
          <ul className="dash-teams">
            {teams.map((team) => {
              const roster = byTeam.get(team.id) || [];
              return (
                <li key={team.id}>
                  <Link href={`/teams/${encodeURIComponent(team.id)}`}>
                    <span className="team-name">{team.name}</span>
                    <span className="team-meta">
                      {roster.length} player{roster.length === 1 ? '' : 's'} · No matches
                    </span>
                    {team.tag ? <span className="team-tag">{team.tag}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
