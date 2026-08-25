import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const zh = await readFile(new URL('../docs/doc/v8-engine/v8-server.md', import.meta.url), 'utf8');
const en = await readFile(new URL('../docs/en/doc/v8-engine/v8-server.md', import.meta.url), 'utf8');

test('V8 server docs do not teach the legacy current-user Controller route', () => {
  const directLegacyExample = /Url\s*:\s*['"][^'"]*\/api\/SysUser\/getCurrentUser/i;
  assert.doesNotMatch(zh, directLegacyExample);
  assert.doesNotMatch(en, directLegacyExample);
  assert.match(zh, /platform-current-user/);
  assert.match(en, /platform-current-user/);
});
