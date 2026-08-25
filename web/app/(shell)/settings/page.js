import { CopyJoinAlias } from '../../../components/copy-join-alias';

export const metadata = { title: 'Settings · Coach Intel' };

export default function Page() {
  return (
    <>
      <header className="page-head">
        <h1>Settings</h1>
        <p className="lede">Org access and invite links. Role edits stay in the desktop app.</p>
      </header>
      <section className="dash-card">
        <div className="dash-card-head">
          <h2>Invites</h2>
        </div>
        <p className="dash-empty">
          Org sign-in: coach.championshipseries.eu/join.{' '}
          <CopyJoinAlias />
        </p>
        <p className="dash-empty">Per-player binds are copied from a team roster.</p>
      </section>
    </>
  );
}
