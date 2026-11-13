import { getStateFromPath } from '@react-navigation/native';
import { linking } from '@/navigation/linking';
jest.mock('expo-linking', () => ({ createURL: () => 'playnow://' }));

test.each([
  ['true', true],
  ['false', false],
])('result URL restores installedOnly=%s as a boolean', (value, expected) => {
  const state = getStateFromPath(`result/action?installedOnly=${value}`, linking.config);
  expect(state?.routes.find((route) => route.name === 'Result')?.params).toMatchObject({
    contextId: 'action',
    installedOnly: expected,
  });
});

test('unknown installation filter URL values remain invalid instead of silently widening the picker', () => {
  const state = getStateFromPath('result/action?installedOnly=unknown', linking.config);
  expect(state?.routes.find((route) => route.name === 'Result')?.params).toMatchObject({
    installedOnly: 'unknown',
  });
});
