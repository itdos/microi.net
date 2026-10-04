import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {officialApplicationSource} from './official-application-source.mjs';

test('Official email package passes delta-write and synchronization cursor regressions', () => {
  const app = officialApplicationSource('mci-email');
  const env = {...process.env};
  delete env.NODE_TEST_CONTEXT;
  const files=fs.readdirSync(path.join(app,'tests')).filter(name=>/\.test\.(?:mjs|cjs|js)$/.test(name)).sort().map(name=>path.join('tests',name));
  assert.ok(files.length>0,'Official email source must include its actual synchronization regressions');
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-concurrency=1', ...files], {
    cwd: app, env, encoding: 'utf8', windowsHide: true, timeout: 30000
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /# tests 10\r?\n/);
  assert.match(result.stdout, /# pass 10\r?\n/);
  assert.match(result.stdout, /# skipped 0\r?\n/);
});
