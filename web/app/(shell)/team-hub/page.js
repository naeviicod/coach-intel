import { redirect } from 'next/navigation';
import { hubPath } from '../../../lib/hub';
import { loadWorkspace } from '../../../lib/workspace';

export default async function Page() {
  const data = await loadWorkspace({ rosterOnly: true });
  if (data.teams[0]) redirect(hubPath(data.teams[0].id));
  redirect('/teams');
}
