import {
  createPickerSelectionStore,
  DEFAULT_PICKER_SELECTION,
} from '@/features/picker/services/pickerSelection';
import { clearAccountData } from '@/shared/services/accountData';

const memory = () => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: async (key: string) => {
      values.delete(key);
    },
    getAllKeys: async () => [...values.keys()],
    multiRemove: async (keys: string[]) => {
      keys.forEach((key) => values.delete(key));
    },
  };
};

test('installed-only filter is off for old caches and is restored independently for each account', async () => {
  const storage = memory();
  storage.values.set(
    'playnow:pickerSelection:v1:A',
    JSON.stringify({ mode: 'new', contextId: 'action' }),
  );
  const store = createPickerSelectionStore(storage);
  await store.getState().load('A');
  expect(store.getState().selection.installedOnly ?? false).toBe(false);
  await store.getState().change('A', { installedOnly: true });
  const restored = createPickerSelectionStore(storage);
  await restored.getState().load('A');
  expect(restored.getState().selection.installedOnly).toBe(true);
  await restored.getState().load('B');
  expect(restored.getState().selection.installedOnly ?? false).toBe(false);
});

test('first use selects New; mode and context survive a restart and are isolated by account', async () => {
  const storage = memory();
  const store = createPickerSelectionStore(storage);
  await store.getState().load('A');
  expect(store.getState().selection).toEqual(DEFAULT_PICKER_SELECTION);
  await store.getState().change('A', { mode: 'continue', contextId: 'story' });
  const restarted = createPickerSelectionStore(storage);
  await restarted.getState().load('A');
  expect(restarted.getState().selection).toEqual({ mode: 'continue', contextId: 'story' });
  await restarted.getState().load('B');
  expect(restarted.getState().selection).toEqual(DEFAULT_PICKER_SELECTION);
});

test('a late restore from A cannot replace the selection for B', async () => {
  let finish!: (value: string | null) => void;
  const storage = memory();
  const store = createPickerSelectionStore({
    ...storage,
    getItem: async (key) =>
      key.endsWith(':A')
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : null,
  });
  const a = store.getState().load('A');
  await store.getState().load('B');
  finish(JSON.stringify({ mode: 'continue', contextId: 'story' }));
  await a;
  expect(store.getState().account).toBe('B');
  expect(store.getState().selection).toEqual(DEFAULT_PICKER_SELECTION);
});

test('rapid changes persist only the latest selection', async () => {
  const storage = memory();
  const store = createPickerSelectionStore(storage);
  await store.getState().load('A');
  await Promise.all([
    store.getState().change('A', { mode: 'continue' }),
    store.getState().change('A', { contextId: 'action' }),
    store.getState().change('A', { mode: 'new' }),
  ]);
  expect(JSON.parse(storage.values.get('playnow:pickerSelection:v1:A')!)).toEqual({
    mode: 'new',
    contextId: 'action',
  });
});

test('deletion invalidates queued setting writes and preserves the device theme', async () => {
  const storage = memory();
  storage.values.set('quaeso:theme', 'light');
  const store = createPickerSelectionStore(storage);
  await store.getState().load('A');
  const writing = store.getState().change('A', { mode: 'continue' });
  store.getState().reset();
  await clearAccountData('A', storage);
  await writing;
  expect(storage.values.has('playnow:pickerSelection:v1:A')).toBe(false);
  expect(storage.values.get('quaeso:theme')).toBe('light');
});

test('corrupt selections recover to New, while a persistence error is visible', async () => {
  const storage = memory();
  storage.values.set('playnow:pickerSelection:v1:A', '{"mode":"invalid","contextId":"action"}');
  const store = createPickerSelectionStore({
    ...storage,
    setItem: async () => {
      throw new Error('disk full');
    },
  });
  await store.getState().load('A');
  expect(store.getState().selection.mode).toBe('new');
  expect(store.getState().error).not.toBeNull();
  await store.getState().change('A', { mode: 'continue' });
  expect(store.getState().selection.mode).toBe('continue');
  expect(store.getState().error).toContain('сохранить');
});
