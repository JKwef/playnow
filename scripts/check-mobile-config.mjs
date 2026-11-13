import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Validate the resolved public config, not just app.json. Never print key values.
const config = JSON.parse(
  execFileSync(
    process.execPath,
    [resolve('node_modules/expo/bin/cli'), 'config', '--type', 'public', '--json'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ),
);
const eas = JSON.parse(readFileSync('eas.json', 'utf8'));
assert.equal(config.scheme, 'playnow', 'Steam callback scheme must remain playnow');
assert.equal(config.android?.package, 'com.jkwef.playnow', 'Unexpected Android application id');
assert.equal(config.ios?.bundleIdentifier, 'com.jkwef.playnow', 'Unexpected iOS application id');
assert.equal(
  config.android?.softwareKeyboardLayoutMode ?? 'resize',
  'resize',
  'Android must resize for the keyboard',
);
assert.equal(new URL(config.extra?.supabaseUrl).protocol, 'https:', 'Supabase URL must use HTTPS');
assert.equal(
  new URL(config.extra?.privacyPolicyUrl).protocol,
  'https:',
  'Privacy policy must use HTTPS',
);
assert.ok(
  Object.keys(config.extra ?? {}).every((key) =>
    ['supabaseUrl', 'supabaseAnonKey', 'privacyPolicyUrl', 'eas'].includes(key),
  ),
  'Unexpected extra field: review for server secrets before bundling',
);
const key = config.extra?.supabaseAnonKey;
let anonymousJwt = false;
try {
  anonymousJwt =
    typeof key === 'string' &&
    JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon';
} catch {
  anonymousJwt = false;
}
assert.ok(
  typeof key === 'string' && (key.startsWith('sb_publishable_') || anonymousJwt),
  'Client key must be publishable or an anon JWT; secret/service_role keys are forbidden',
);
assert.equal(
  eas.build?.preview?.distribution,
  'internal',
  'Preview must use internal distribution',
);
assert.equal(
  eas.build?.preview?.android?.buildType,
  'apk',
  'Android preview must be installable APK',
);
assert.notEqual(
  eas.build?.preview?.ios?.simulator,
  true,
  'Preview must target physical iOS devices',
);
assert.equal(
  eas.build?.production?.android?.buildType,
  'app-bundle',
  'Production Android must use app-bundle',
);
const projectId = config.extra?.eas?.projectId;
if (process.argv.includes('--require-eas-project')) {
  assert.ok(
    typeof projectId === 'string' && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(projectId),
    'Link the real EAS project before a cloud build',
  );
}
process.stdout.write(
  `Mobile public config and preview profiles passed. EAS project linked: ${projectId ? 'yes' : 'no'}\n`,
);
