import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { copyOnlineAiMcpRuntime } from '../../tools/online-ai-mcp-runtime.mjs';
import { artifactFiles } from '../../tools/release-artifact.mjs';

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'microi-mcp-runtime-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const staging = path.join(directory, 'staging');
  const destination = path.join(directory, 'api/publish/ai-mcp');
  await fs.mkdir(path.join(staging, 'node_modules/.bin'), { recursive: true });
  await fs.mkdir(path.join(staging, 'node_modules/tool'), { recursive: true });
  await fs.mkdir(path.join(staging, 'dist'), { recursive: true });
  await fs.writeFile(path.join(staging, 'package.json'), '{"name":"fixture-runtime"}');
  await fs.writeFile(path.join(staging, 'dist/index.js'), 'console.log("runtime")');
  await fs.writeFile(path.join(staging, 'node_modules/tool/cli.js'), '#!/usr/bin/env node\nconsole.log("production binary 吾码")\n', { mode: 0o755 });
  return { directory, staging, destination };
}

test('production bin survives removal of staging and passes the unchanged artifact gate', async t => {
  const { directory, staging, destination } = await fixture(t);
  const target = path.join(staging, 'node_modules/tool/cli.js');
  const bytes = await fs.readFile(target);
  const directoryLink = process.platform === 'win32';
  await fs.symlink(directoryLink ? path.dirname(target) : target,
    path.join(staging, 'node_modules/.bin/tool'), directoryLink ? 'junction' : 'file');
  copyOnlineAiMcpRuntime(staging, destination);
  await fs.rm(staging, { recursive: true });
  const binary = path.join(destination, 'node_modules/.bin/tool', directoryLink ? 'cli.js' : '');
  assert.equal((await fs.lstat(binary)).isSymbolicLink(), false);
  assert.deepEqual(await fs.readFile(binary), bytes);
  const result = spawnSync(process.execPath, [binary], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'production binary 吾码');
  await fs.writeFile(path.join(directory, 'api/Dockerfile'), 'FROM fixture');
  const files = await artifactFiles(path.join(directory, 'api'), 'api');
  assert.ok(files[`publish/ai-mcp/node_modules/.bin/tool${directoryLink ? '/cli.js' : ''}`]);
});

test('complete runtime replacement removes stale dependencies', async t => {
  const { staging, destination } = await fixture(t);
  await fs.mkdir(path.join(destination, 'node_modules/stale'), { recursive: true });
  await fs.writeFile(path.join(destination, 'node_modules/stale/index.js'), 'stale');
  copyOnlineAiMcpRuntime(staging, destination);
  await assert.rejects(fs.stat(path.join(destination, 'node_modules/stale')), { code: 'ENOENT' });
  assert.equal((await fs.readFile(path.join(destination, 'dist/index.js'))).toString(), 'console.log("runtime")');
});

test('broken or external links fail before replacing a prior runtime', async t => {
  const { directory, staging, destination } = await fixture(t);
  await fs.mkdir(destination, { recursive: true });
  await fs.writeFile(path.join(destination, 'prior.txt'), 'preserve');
  const link = path.join(staging, 'node_modules/.bin/tool');
  await fs.symlink(path.join(directory, 'missing'), link, process.platform === 'win32' ? 'junction' : 'file');
  assert.throws(() => copyOnlineAiMcpRuntime(staging, destination), /ENOENT/);
  await fs.unlink(link);
  const outside = path.join(directory, 'outside');
  await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, 'outside.js'), 'outside');
  await fs.symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => copyOnlineAiMcpRuntime(staging, destination), /escapes/);
  assert.equal((await fs.readFile(path.join(destination, 'prior.txt'))).toString(), 'preserve');
});

test('directory link cycles are rejected before replacing a prior runtime', async t => {
  const { staging, destination } = await fixture(t);
  await fs.mkdir(destination, { recursive: true });
  await fs.writeFile(path.join(destination, 'prior.txt'), 'preserve');
  await fs.symlink(path.join(staging, 'node_modules'), path.join(staging, 'node_modules/.bin/cycle'),
    process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => copyOnlineAiMcpRuntime(staging, destination), /Cyclic/);
  assert.equal((await fs.readFile(path.join(destination, 'prior.txt'))).toString(), 'preserve');
});
