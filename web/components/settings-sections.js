'use client';

import Link from 'next/link';
import { useState } from 'react';
import { roleLabel } from '../lib/access';
import { Field } from './workspace';

const RULESET = {
  game: 'Black Ops 7',
  season: '2026',
  version: '1',
  last_checked: '2026-08-16',
};

export function GameRulesCard() {
  return (
    <div className="card section">
      <div className="section-title">Ruleset</div>
      <div className="list-item-row">
        <div>
          <div className="settings-row-title">{RULESET.game}</div>
          <div className="field-hint">Season {RULESET.season} · v{RULESET.version} · checked {RULESET.last_checked}</div>
        </div>
        <Link href="/maps-modes" className="btn sm">Maps & Modes</Link>
      </div>
      <p className="field-hint" style={{ maxWidth: 620, lineHeight: 1.6, marginTop: 8 }}>
        Active maps drive Team Hub, the strat picker, and the veto board. Change the pool in Maps & Modes.
      </p>
    </div>
  );
}

export function IntegrationsCard() {
  return (
    <div className="card section">
      <div className="section-title">Connected services</div>
      <div className="list-item-row">
        <div>
          <div className="settings-row-title">Discord</div>
          <div className="field-hint">Channels, posting, and bot setup live on the Integrations page.</div>
        </div>
        <Link href="/integrations" className="btn sm">Open Integrations</Link>
      </div>
    </div>
  );
}

export function TeamAccessCard({ members = [], teams = [] }) {
  const byTeam = Object.fromEntries((teams || []).map((team) => [team.id, team.name]));
  return (
    <div className="card section">
      <div className="section-title">Who can sign in</div>
      <p className="field-hint" style={{ marginBottom: 10, maxWidth: 640, lineHeight: 1.5 }}>
        Everyone linked on the roster. Invite from Players. Org owner cannot remove Super Admin.
      </p>
      {members.length === 0 ? (
        <div className="field-hint">Nobody has signed in yet.</div>
      ) : (
        members.map((person) => (
          <div key={person.id || person.user_id || person.gamertag} className="list-item-row">
            <div>
              <div className="settings-row-title">{person.gamertag || person.name || person.display_name || 'Member'}</div>
              <div className="field-hint">
                {[byTeam[person.team_id], person.title, roleLabel(person.role)].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export function DataCard() {
  return (
    <div className="card section">
      <div className="section-title">Storage</div>
      <div className="list-item-row">
        <div>
          <div className="settings-row-title">Shared org cloud</div>
          <div className="field-hint" style={{ maxWidth: 560, lineHeight: 1.5 }}>
            Teams, roster, matches, and strats live in the org database. The desktop app also keeps an on-device copy.
          </div>
        </div>
        <span className="pill win">Cloud</span>
      </div>
    </div>
  );
}

export function FeedbackCard() {
  const [form, setForm] = useState({ category: 'bug', subject: '', body: '' });
  function send(e) {
    e.preventDefault();
    const subject = encodeURIComponent(`[Coach Intel] ${form.category}: ${form.subject || 'Feedback'}`);
    const body = encodeURIComponent(form.body || '');
    window.location.href = `mailto:hello@championshipseries.eu?subject=${subject}&body=${body}`;
  }
  return (
    <form className="card section" onSubmit={send}>
      <div className="section-title">Feedback</div>
      <p className="field-hint" style={{ marginBottom: 16, maxWidth: 640, lineHeight: 1.5 }}>
        Bugs, ideas, and anything that feels off. This opens your mail client to the Coach Intel team.
      </p>
      <div className="inline-fields">
        <Field label="Category">
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="bug">Bug</option>
            <option value="idea">Idea</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Subject">
          <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
        </Field>
      </div>
      <Field label="Details">
        <textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
      </Field>
      <div className="settings-actions">
        <button type="submit" className="btn primary">Send Feedback</button>
      </div>
    </form>
  );
}

export function AboutCard() {
  return (
    <div className="card section">
      <div className="section-title">Coach Intel</div>
      <div className="field-hint" style={{ marginBottom: 12 }}>Know More. Win More.</div>
      <div className="list-item-row about-row">
        <div className="settings-row-title">Version</div>
        <div className="about-value">v3.9.3</div>
      </div>
      <div className="list-item-row about-row">
        <div className="settings-row-title">Website</div>
        <a className="about-link" href="https://coach.championshipseries.eu/">coach.championshipseries.eu</a>
      </div>
      <div className="list-item-row about-row">
        <div className="settings-row-title">Mode</div>
        <div className="about-value">Cloud · Signed in</div>
      </div>
      <div className="list-item-row about-row">
        <div className="settings-row-title">Ruleset</div>
        <div className="about-value">{RULESET.game} · Season {RULESET.season} · v{RULESET.version}</div>
      </div>
    </div>
  );
}
