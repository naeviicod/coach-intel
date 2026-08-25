import { canEdit } from './access';
import { getProfile, loadAppData } from './data';
import { createServerSupabase, getSessionUser } from './supabase/server';

export async function loadWorkspace() {
  const supabase = await createServerSupabase();
  const user = await getSessionUser();
  const [data, profile] = await Promise.all([
    loadAppData(supabase),
    user ? getProfile(supabase, user.id) : null,
  ]);
  return { ...data, canEdit: canEdit(profile?.role), role: profile?.role };
}
