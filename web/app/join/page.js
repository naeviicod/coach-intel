import { InviteGate } from '../../components/invite-gate';

export const metadata = { title: 'Join · Coach Intel' };

export default function JoinPage() {
  return <InviteGate nextPath="/dashboard" />;
}
