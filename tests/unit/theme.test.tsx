import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { lightColors } from '@/shared/constants/colors';
import { ThemeProvider, THEME_STORAGE_KEY, type ThemeStorage } from '@/shared/theme/ThemeProvider';
import { useTheme } from '@/shared/theme/useTheme';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
}));

const setup = async (
  saved: string | null = null,
  write = jest.fn(async (_key: string, _value: string) => undefined),
) => {
  const storage: ThemeStorage = { getItem: jest.fn(async () => saved), setItem: write };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ThemeProvider storage={storage}>{children}</ThemeProvider>
  );
  const hook = await renderHook(() => useTheme(), { wrapper });
  await waitFor(() => expect(hook.result.current).not.toBeNull());
  return { ...hook, storage, write };
};

it('restores the saved light palette before rendering the app', async () => {
  const { result, storage } = await setup('light');
  expect(result.current.mode).toBe('light');
  expect(result.current.colors).toBe(lightColors);
  expect(storage.getItem).toHaveBeenCalledWith(THEME_STORAGE_KEY);
});

it('defaults to dark for an absent or invalid saved preference', async () => {
  const { result } = await setup('unsupported');
  expect(result.current.mode).toBe('dark');
});

it('updates the palette immediately and writes rapid changes in order', async () => {
  const { result, write } = await setup();
  await act(async () => {
    await Promise.all([result.current.setMode('light'), result.current.setMode('dark')]);
  });
  expect(result.current.mode).toBe('dark');
  expect(write.mock.calls).toEqual([
    [THEME_STORAGE_KEY, 'light'],
    [THEME_STORAGE_KEY, 'dark'],
  ]);
});

it('keeps the chosen palette and reports a persistence failure', async () => {
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    const write = jest.fn(async (_key: string, _value: string) => {
      throw new Error('disk full');
    });
    const { result } = await setup(null, write);
    await act(async () => {
      await result.current.setMode('light');
    });
    expect(result.current.mode).toBe('light');
    expect(result.current.persistenceError).toMatch(/сохранить выбор не удалось/);
  } finally {
    warning.mockRestore();
  }
});
