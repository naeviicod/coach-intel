'use client';

import { useMemo, useState } from 'react';
import { newId, saveMember } from '../lib/docs';
import { aggregate, statsForMember } from '../lib/stats';
import { memberStaffTitle, memberDiscordVerified, showsCompetitiveStats, VerifiedMark } from '../lib/marks';
import { EmptyState, PageHeader } from './page-header';
import { Err, Field, FormCard } from './workspace';

export function DatabaseView({ teams, members, matches, canEdit }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ gamertag: '', team_id: teams[0]?.id || '', title: '', slot: 'staff' });

  const rows = useMemo(
    () =>
      members.map((member) => {
        const team = teams.find((t) => t.id === member.team_id);
        const totals = aggregate(statsForMember(matches.filter((m) => m.team_id === member.team_id), member.id));
        const orgRole = memberStaffTitle(member) || (member.slot === 'staff' ? 'Staff' : 'Player');
        return { team, member, totals, orgRole, competitive: showsCompetitiveStats(member) };
      }),
    [teams, members, matches]
  );
  const filtered = q
    ? rows.filter((r) => [r.member.gamertag, r.member.name, r.team?.name, r.orgRole, r.member.role, r.member.title].join(' ').toLowerCase().includes(q.toLowerCase()))
    : rows;

  async function addStaff(e) {
    e.preventDefault();
    setError('');
    try {
      await saveMember({ ...form, id: newId('mem'), slot: 'staff' });
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Could not add staff.');
    }
  }

  return (
    <>
      <PageHeader
        title="Member Database"
        subtitle="Everyone in the organization — players, staff, and creatives — and their org role"
        actions={canEdit && teams.length ? (
          <div className="add-row" style={{ marginBottom: 0 }}>
            <button type="button" className="btn primary" onClick={() => setOpen(true)}>+ Add Staff</button>
          </div>
        ) : null}
      />
      {open ? (
        <FormCard
          title="Add staff"
          onClose={() => setOpen(false)}
          actions={
            <>
              <button type="button" className="btn subtle" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" form="add-staff" className="btn primary">Save</button>
            </>
          }
        >
          <form id="add-staff" onSubmit={addStaff} className="inline-fields">
            <Field label="Gamertag"><input value={form.gamertag} onChange={(e) => setForm({ ...form, gamertag: e.target.value })} required /></Field>
            <Field label="Team">
              <select value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })}>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Title"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Coach" /></Field>
          </form>
          <Err error={error} />
        </FormCard>
      ) : null}
      {!teams.length ? (
        <EmptyState title="No members yet" body="Create a team, then add players and staff." />
      ) : (
        <>
          <div className="filter-bar">
            <input type="search" placeholder="Search name, team, org role…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 280 }} />
          </div>
          <div className="card">
            {filtered.length === 0 ? (
              <div className="empty-state"><div className="title">No matches</div></div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Team</th>
                    <th>Org Role</th>
                    <th>In-game</th>
                    <th>Matches</th>
                    <th>K/D</th>
                    <th>Win Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.member.id}>
                      <td>
                        <div className="gamertag">
                          {r.member.gamertag}
                          {memberDiscordVerified(r.member) ? <VerifiedMark /> : null}
                        </div>
                      </td>
                      <td>{r.team?.name || '—'}</td>
                      <td>{r.orgRole}</td>
                      <td>{r.member.role || '—'}</td>
                      <td>{r.competitive ? r.totals.matches : '—'}</td>
                      <td>{r.competitive ? r.totals.kd : '—'}</td>
                      <td>{r.competitive ? `${r.totals.winRate}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}
