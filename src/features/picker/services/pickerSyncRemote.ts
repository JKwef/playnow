import type { AppSupabaseClient } from '@/shared/services/supabase';
import type { Json } from '@/shared/types/database';
import { isRecord } from '@/shared/utils/validation';
import {
  EMPTY_PICKER_SNAPSHOT,
  parsePickerSnapshot,
  type PickerSyncRemote,
  type RemotePickerState,
} from '@/features/picker/services/pickerSyncModel';

export function parseRemotePickerState(value: unknown): RemotePickerState {
  if (
    !isRecord(value) ||
    typeof value.revision !== 'number' ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    (value.mutationId !== null && typeof value.mutationId !== 'string')
  )
    throw new Error('Invalid sync response');
  return {
    revision: value.revision,
    snapshot: parsePickerSnapshot(value.snapshot, 0),
    mutationId: value.mutationId,
  };
}
export function createPickerSyncRemote(getClient: () => AppSupabaseClient): PickerSyncRemote {
  const identity = async (account: string) => {
    const client = getClient();
    const { data, error } = await client.auth.getSession();
    if (error || !data.session || data.session.user.app_metadata.steam_id !== account)
      throw new Error('Account changed');
    return { client, userId: data.session.user.id };
  };
  return {
    read: async (account) => {
      const { client, userId } = await identity(account);
      const { data, error } = await client
        .from('picker_sync_state')
        .select('revision,snapshot,mutation_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data === null
        ? { revision: 0, snapshot: EMPTY_PICKER_SNAPSHOT, mutationId: null }
        : parseRemotePickerState({ ...data, mutationId: data.mutation_id });
    },
    write: async (account, revision, operationId, snapshot) => {
      const { client, userId } = await identity(account);
      const { data, error } = await client.rpc('write_picker_sync', {
        expected_user_id: userId,
        expected_revision: revision,
        operation_id: operationId,
        new_snapshot: snapshot as unknown as Json,
      });
      if (error) throw error;
      if (!isRecord(data) || typeof data.applied !== 'boolean')
        throw new Error('Invalid sync acknowledgement');
      return { ...parseRemotePickerState(data), applied: data.applied };
    },
  };
}
