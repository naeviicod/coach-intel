import { IntegrationsView } from '../../../components/integrations-view';
import { listGuildLinks } from '../../../lib/data';
import { createServerSupabase } from '../../../lib/supabase/server';

export const metadata = { title: 'Integrations · Coach Intel' };

export default async function Page() {
  const supabase = await createServerSupabase();
  const links = await listGuildLinks(supabase);
  return <IntegrationsView links={links} />;
}
