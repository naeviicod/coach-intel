'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createBrowserSupabase } from '../lib/supabase/browser';

function hexAccent(value) {
  const m = String(value || '').trim().match(/^#?([0-9a-fA-F]{6})$/);
  return m ? `#${m[1].toLowerCase()}` : null;
}

export function OrgDashboard({ org: initialOrg, teams: initialTeams, members: initialMembers }) {
  const [org, setOrg] = useState(initialOrg);
  const [teams, setTeams] = useState(initialTeams || []);
  const [members, setMembers] = useState(initialMembers || []);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    async function refresh() {
      const [{ data: teamRows }, { data: memberRows }, { data: orgRow }] = await Promise.all([
        supabase.from('teams').select('id, name, tag, logo, accent').order('created_at', { ascending: true }),
        supabase.from('members').select('id, team_id, gamertag, name, role, slot, title, user_id'),
        supabase.from('shared_docs').select('payload').eq('kind', 'org').eq('id', 'profile').is('deleted_at', null).maybeSingle(),
      ]);
      if (teamRows) setTeams(teamRows);
      if (memberRows) setMembers(memberRows);
      if (orgRow?.payload) setOrg(orgRow.payload);
    }
    const channel = supabase
      .channel('ci-org-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_docs' }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const accent = hexAccent(org?.accent) || hexAccent(teams.find((t) => t.accent)?.accent);
  useEffect(() => {
    if (!accent) return undefined;
    const root = document.documentElement;
    const prev = root.style.getPropertyValue('--accent');
    root.style.setProperty('--accent', accent);
    return () => root.style.setProperty('--accent', prev);
  }, [accent]);

  const byTeam = useMemo(() => {
    const map = new Map(teams.map((team) => [team.id, []]));
    for (const member of members) {
      if (!map.has(member.team_id)) continue;
      map.get(member.team_id).push(member);
    }
    return map;
  }, [teams, members]);

  const linked = members.filter((m) => m.user_id).length;

  return (
    <>
      <header className="page-head dash-head">
        <p className="eyebrow">{org?.tag || 'Organization'}</p>
        <h1>{org?.name || 'Your organization'}</h1>
        <p className="page-kicker">Dashboard</p>
        <p className="lede">What needs attention today</p>
      </header>
      <div className="kpi-row">
        <div className="kpi">
          <p>Teams</p>
          <strong>{teams.length}</strong>
          <span>In organization</span>
        </div>
        <div className="kpi">
          <p>Roster</p>
          <strong>{members.length}</strong>
          <span>{linked} linked to Discord</span>
        </div>
        <div className="kpi">
          <p>Open tasks</p>
          <strong>0</strong>
          <span>Nothing overdue</span>
        </div>
        <div className="kpi">
          <p>Matches</p>
          <strong>0</strong>
          <span>None yet</span>
        </div>
      </div>
      <div className="dash-grid">
        <section className="dash-card">
          <div className="dash-card-head">
            <h2>Needs Attention</h2>
          </div>
          <p className="dash-empty-title">Nothing pending</p>
          <p className="dash-empty">No open tasks and no screenshots waiting for review.</p>
        </section>
        <section className="dash-card">
          <div className="dash-card-head">
            <h2>Recent Intel</h2>
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
