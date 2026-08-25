import { redirect } from 'next/navigation';

export default async function LegacyInvitePage({ params }) {
  const { token } = await params;
  redirect(`/join/${encodeURIComponent(token)}`);
}
