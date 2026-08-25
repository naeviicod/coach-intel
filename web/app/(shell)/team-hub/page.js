import { redirect } from 'next/navigation';
import { listTeams } from '../../../lib/data';
import { createServerSupabase } from '../../../lib/supabase/server';
import { hubPath } from '../../../lib/hub';

export default async function Page() {
  const supabase = await createServerSupabase();
  const teams = await listTeams(supabase).catch(() => []);
  if (teams[0]) redirect(hubPath(teams[0].id));
  redirect('/teams');
}
