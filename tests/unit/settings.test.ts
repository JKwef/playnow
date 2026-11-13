import { assertEquals } from './helpers/assert';
import { isSafeHttpsUrl, readAppInfo } from '@/features/settings/utils/appInfo';

test('readAppInfo: version and https policy url', () => {
  assertEquals(
    readAppInfo({
      version: '1.0.0',
      extra: { privacyPolicyUrl: 'https://github.com/JKwef/playnow/blob/main/docs/PRIVACY.md' },
    }),
    {
      version: '1.0.0',
      privacyPolicyUrl: 'https://github.com/JKwef/playnow/blob/main/docs/PRIVACY.md',
    },
  );
});
test('readAppInfo: missing config', () => {
  assertEquals(readAppInfo(null), { version: 'неизвестна', privacyPolicyUrl: null });
  assertEquals(readAppInfo({ version: '  ', extra: {} }), {
    version: 'неизвестна',
    privacyPolicyUrl: null,
  });
});
test('isSafeHttpsUrl rejects unsafe', () => {
  for (const bad of [
    'http://example.com',
    'javascript:alert(1)',
    'https://user@evil.com/x',
    'https://a b.com',
    42,
    null,
    'https://' + 'a'.repeat(600),
  ]) {
    assertEquals(isSafeHttpsUrl(bad), false, String(bad));
  }
  assertEquals(isSafeHttpsUrl('https://example.com'), true);
  assertEquals(isSafeHttpsUrl('https://example.com/p?x=1#y'), true);
});
