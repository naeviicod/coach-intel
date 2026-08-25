import { redirect } from 'next/navigation';
import { PublicGateway } from '../components/public-gateway';
import { getSessionUser } from '../lib/supabase/server';

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) redirect('/dashboard');
  return <PublicGateway />;
}
