import { redirect } from 'next/navigation';
import { SectionPage } from '../../../components/section-page';
import { listTeams } from '../../../lib/data';
import { createServerSupabase } from '../../../lib/supabase/server';

export const metadata = { title: 'Member Database · Coach Intel' };

export default async function Page() {
  const supabase = await createServerSupabase();
  const teams = await listTeams(supabase).catch(() => []);
  if (teams[0]) redirect('/players');
  return (
    <SectionPage
      title="Member Database"
      lede="Everyone on every roster"
      emptyTitle="No members yet"
    />
  );
}
