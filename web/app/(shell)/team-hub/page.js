import { redirect } from 'next/navigation';
import { listTeams } from '../../../lib/data';
import { createServerSupabase } from '../../../lib/supabase/server';

export default async function Page() {
  const supabase = await createServerSupabase();
  const teams = await listTeams(supabase).catch(() => []);
  if (teams[0]) redirect(`/teams/${encodeURIComponent(teams[0].id)}`);
  redirect('/teams');
}
