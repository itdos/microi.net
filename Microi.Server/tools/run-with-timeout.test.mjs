import test from 'node:test';
import assert from 'node:assert/strict';
import { runWithTimeout } from './run-with-timeout.mjs';

test('portable release probes preserve successful and failed exit codes', async () => {
  assert.equal(await runWithTimeout(process.execPath, ['-e', 'process.exit(0)'], 2000), 0);
  assert.equal(await runWithTimeout(process.execPath, ['-e', 'process.exit(7)'], 2000), 7);
  assert.equal(await runWithTimeout('microi-nonexistent-probe-command', [], 2000), 127);
});

test('a hung probe that ignores TERM is bounded and returns timeout status', async () => {
  const started = Date.now();
  const code = await runWithTimeout(process.execPath,
    ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], 150);
  assert.equal(code, 124);
  assert.ok(Date.now() - started < 3000);
});
