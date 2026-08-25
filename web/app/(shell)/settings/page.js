import { CopyJoinAlias } from '../../../components/copy-join-alias';
import { PageHeader } from '../../../components/page-header';

export const metadata = { title: 'Settings · Coach Intel' };

export default function Page() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Org access and invite links. Role edits stay in the desktop app." />
      <div className="card compact">
        <div className="card-head">
          <h2>Invites</h2>
        </div>
        <p className="field-hint">
          Org sign-in: coach.championshipseries.eu/join. <CopyJoinAlias />
        </p>
        <p className="field-hint">Per-player binds are copied from a team roster.</p>
        <form action="/auth/sign-out" method="post" style={{ marginTop: 16 }}>
          <button type="submit" className="btn sm">Sign out</button>
        </form>
      </div>
    </>
  );
}
