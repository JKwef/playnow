import { deleteAccountOnServer } from '@/features/settings/services/deleteAccount';

const mockGetSession = jest.fn();
const mockInvoke = jest.fn();
jest.mock('@/shared/services/supabase', () => ({
  getSupabase: () => ({ auth: { getSession: mockGetSession }, functions: { invoke: mockInvoke } }),
}));

beforeEach(() => {
  jest.resetAllMocks();
});

test('pins the confirmed account token for the deletion request', async () => {
  mockGetSession.mockResolvedValue({
    data: {
      session: {
        access_token: 'token-A',
        user: { app_metadata: { steam_id: 'A' } },
      },
    },
    error: null,
  });
  mockInvoke.mockResolvedValue({ error: null });
  await deleteAccountOnServer('A');
  expect(mockInvoke).toHaveBeenCalledWith('delete-account', {
    headers: { Authorization: 'Bearer token-A' },
  });
});

test('does not invoke deletion with another account session or without a session', async () => {
  for (const session of [null, { user: { app_metadata: { steam_id: 'B' } } }]) {
    mockGetSession.mockResolvedValue({ data: { session }, error: null });
    await expect(deleteAccountOnServer('A')).rejects.toThrow('Account changed');
  }
  expect(mockInvoke).not.toHaveBeenCalled();
});
