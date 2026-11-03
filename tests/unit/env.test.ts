import Constants from 'expo-constants';

import { EnvError, getEnv } from '@/shared/config/env';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));

const setExtra = (extra: Record<string, unknown> | undefined): void => {
  (Constants as unknown as { expoConfig: { extra?: Record<string, unknown> } }).expoConfig = {
    extra,
  };
};

describe('getEnv (TR4)', () => {
  test('читает и обрезает значения из extra', () => {
    setExtra({ supabaseUrl: ' https://x.supabase.co ', supabaseAnonKey: 'sb_publishable_x' });
    expect(getEnv()).toEqual({
      supabaseUrl: 'https://x.supabase.co',
      supabaseAnonKey: 'sb_publishable_x',
    });
  });

  test('пустые и нестроковые значения — понятная ошибка со списком', () => {
    setExtra({ supabaseUrl: '', supabaseAnonKey: 42 });
    expect(() => getEnv()).toThrow(EnvError);
    expect(() => getEnv()).toThrow('supabaseUrl, supabaseAnonKey');
  });

  test('нет extra вовсе', () => {
    setExtra(undefined);
    expect(() => getEnv()).toThrow(EnvError);
  });
});
