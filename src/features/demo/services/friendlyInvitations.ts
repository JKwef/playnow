import { getSupabase } from '@/shared/services/supabase';
import type { Database } from '@/shared/types/database';

export type InvitationEntry = { id: string; name: string };

export async function friendlyInvitation<T>(
  args: Database['public']['Functions']['friendly_invitation']['Args'],
): Promise<T[]> {
  const { data, error } = await getSupabase().rpc('friendly_invitation', args);
  if (error) throw error;
  return Array.isArray(data) ? (data as unknown as T[]) : [];
}
