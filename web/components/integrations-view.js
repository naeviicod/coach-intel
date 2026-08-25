'use client';

import { PageHeader } from './page-header';

export function IntegrationsView({ links = [] }) {
  return (
    <>
      <PageHeader title="Integrations" subtitle="Discord bot and channel routing" />
      <div className="card compact">
        <div className="card-head">
          <h2>Discord</h2>
          <span className={`pill ${links.length ? 'win' : ''}`}>{links.length ? 'Connected' : 'Not connected'}</span>
        </div>
        {links.length === 0 ? (
          <p className="field-hint">
            No guild is linked yet. Paste the bot token and pick a server from Settings → Integrations on any signed-in staff machine — desktop or here once a guild row exists. Channel routing stays on the org so every teammate sees the same destinations.
          </p>
        ) : (
          links.map((row) => (
            <div key={row.id || row.guild_id} className="crow">
              <div className="crow-main">
                <div className="crow-title">{row.guild_id}</div>
                <div className="crow-sub">{row.team_id || 'Org'}{row.enabled === false ? ' · disabled' : ''}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
