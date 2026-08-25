'use client';

import { useMemo, useState } from 'react';
import { deleteDoc, newId, saveDoc } from '../lib/docs';
import { fmtDate } from '../lib/marks';
import { mapNames, modeNames, resolveRuleset } from '../lib/ruleset';
import { parseVodUrl } from '../lib/vodLink';
import { EmptyState, PageHeader } from './page-header';
import { Err, Field, FormCard, pickTeam, TeamPicker } from './workspace';

export function VodLibraryView({ teams, vods, rulesetDocs, teamId, canEdit }) {
  const team = pickTeam(teams, teamId);
  const ruleset = resolveRuleset(rulesetDocs);
  const maps = mapNames(ruleset);
  const modes = modeNames(ruleset);
  const list = vods.filter((v) => v.team_id === team?.id);
  const [filter, setFilter] = useState({ mode: '', map: '', q: '' });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', url: '', date: new Date().toISOString().slice(0, 10), map: '', mode: '', opponent: '', notes: '' });

  const shown = useMemo(
    () =>
      list.filter(
        (v) =>
          (!filter.mode || v.mode === filter.mode) &&
          (!filter.map || v.map === filter.map) &&
          (!filter.q || `${v.title} ${v.opponent}`.toLowerCase().includes(filter.q))
      ),
    [list, filter]
  );

  if (!teams.length) {
    return (
      <>
        <PageHeader title="VOD Library" subtitle="Clip storage and timestamped review" />
        <EmptyState title="No teams yet" body="Create a team to start building a VOD library." />
      </>
    );
  }

  async function add(e) {
    e.preventDefault();
    setError('');
    try {
      const parsed = parseVodUrl(form.url);
      const id = newId('vod');
      await saveDoc({
        kind: 'vod',
        teamId: team.id,
        id,
        payload: {
          vod_id: id,
          team_id: team.id,
          title: form.title || 'Untitled VOD',
          url: form.url,
          source: parsed.label || 'Link',
          date: form.date,
          map: form.map,
          mode: form.mode,
          opponent: form.opponent,
          notes: form.notes,
          markers: [],
        },
      });
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Could not add VOD.');
    }
  }

  return (
    <>
      <PageHeader
        title="VOD Library"
        subtitle={`${team.name} — clips and timestamped review`}
        actions={(
          <div style={{ display: 'flex', gap: 8 }}>
            <TeamPicker teams={teams} teamId={team.id} />
            {canEdit ? <button type="button" className="btn primary" onClick={() => setOpen(true)}>Add VOD</button> : null}
          </div>
        )}
      />
      {open ? (
        <FormCard title="Add VOD" onClose={() => setOpen(false)} actions={<button type="submit" form="vod-form" className="btn primary">Save</button>}>
          <form id="vod-form" onSubmit={add}>
            <div className="inline-fields">
              <Field label="Title"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
              <Field label="URL"><input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://" required /></Field>
              <Field label="Date"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
              <Field label="Opponent"><input value={form.opponent} onChange={(e) => setForm({ ...form, opponent: e.target.value })} /></Field>
              <Field label="Map">
                <select value={form.map} onChange={(e) => setForm({ ...form, map: e.target.value })}>
                  <option value="">—</option>
                  {maps.map((m) => <option key={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Mode">
                <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                  <option value="">—</option>
                  {modes.map((m) => <option key={m}>{m}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Notes"><textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </form>
          <Err error={error} />
        </FormCard>
      ) : null}
      {list.length === 0 ? (
        <EmptyState title="No VODs yet" body="Add a YouTube or Twitch link and drop notes against the maps you review." />
      ) : (
        <>
          <div className="filter-bar">
            <select value={filter.mode} onChange={(e) => setFilter({ ...filter, mode: e.target.value })}>
              <option value="">All Modes</option>
              {[...new Set(list.map((v) => v.mode).filter(Boolean))].map((m) => <option key={m}>{m}</option>)}
            </select>
            <select value={filter.map} onChange={(e) => setFilter({ ...filter, map: e.target.value })}>
              <option value="">All Maps</option>
              {[...new Set(list.map((v) => v.map).filter(Boolean))].map((m) => <option key={m}>{m}</option>)}
            </select>
            <input type="search" placeholder="Search title / opponent…" onChange={(e) => setFilter({ ...filter, q: e.target.value.toLowerCase() })} />
          </div>
          <div className="grid cols-2">
            {shown.map((vod) => {
              const parsed = parseVodUrl(vod.url);
              return (
                <div key={vod.vod_id || vod.id} className="card">
                  <div className="card-head">
                    <h2>{vod.title}</h2>
                    <span className="pill">{parsed.label || vod.source || 'Link'}</span>
                  </div>
                  <div className="field-hint">{[vod.opponent, vod.map, vod.mode, vod.date ? fmtDate(String(vod.date).slice(0, 10)) : ''].filter(Boolean).join(' · ')}</div>
                  {vod.notes ? <p style={{ marginTop: 8 }}>{vod.notes}</p> : null}
                  <div className="team-card-actions">
                    {parsed.watchUrl ? <a className="btn sm" href={parsed.watchUrl} target="_blank" rel="noreferrer">Open</a> : null}
                    {canEdit ? (
                      <button
                        type="button"
                        className="btn sm"
                        onClick={async () => {
                          await deleteDoc({ kind: 'vod', teamId: team.id, id: vod.vod_id || vod.id });
                          window.location.reload();
                        }}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
