import { HubHead, MiniEmpty } from './hub-parts';
import { statsByKey } from '../lib/stats';

export function HubVeto({ team, matches, ctxToggle }) {
  const byMap = statsByKey(matches, (m) => m.map || 'Unknown');
  return (
    <>
      <HubHead title="Veto History" sub="Map bans and picks are not tracked yet">
        {ctxToggle}
      </HubHead>
      <div className="card" style={{ marginBottom: 14 }}>
        <MiniEmpty
          title="Veto sequences are not recorded"
          body="Coach Intel does not capture bans and picks yet, so nothing is shown here. Logged matches below are the closest record of what actually got played."
        />
      </div>
      {matches.length === 0 ? (
        <div className="card">
          <MiniEmpty title="No matches logged" body="Log a match to start building map history." />
        </div>
      ) : (
        <div className="card compact">
          <div className="card-head">
            <div className="card-title">Maps played</div>
            <div className="card-meta">{`${matches.length} match${matches.length === 1 ? '' : 'es'}`}</div>
          </div>
          {byMap.map((row) => (
            <div key={row.key} className="crow">
              <div className="crow-main">
                <div className="crow-title">{row.key}</div>
                <div className="crow-sub"><span>{`${row.wins}W - ${row.losses}L`}</span></div>
              </div>
              <div className="crow-meta">{`${row.winRate}%`}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
