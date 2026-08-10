import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildLocalMicroServiceSourceManifest } from './server.js';

function withTemporaryProject(run: (directory: string) => Promise<void> | void): Promise<void> {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'microi-source-directory-'));
  return Promise.resolve(run(directory)).finally(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });
}

test('local source directory keeps one large source file intact and excludes generated trees', async () => {
  await withTemporaryProject(async directory => {
    fs.mkdirSync(path.join(directory, 'src'), { recursive: true });
    fs.mkdirSync(path.join(directory, 'node_modules', 'demo'), { recursive: true });
    fs.mkdirSync(path.join(directory, 'dist', 'assets'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'src', 'ReportWorkPage.vue'), '界'.repeat(48 * 1024), 'utf8');
    fs.writeFileSync(path.join(directory, 'src', 'microi.v8.js'), 'x'.repeat(93 * 1024), 'utf8');
    fs.writeFileSync(path.join(directory, 'package.json'), '{"private":true}\n', 'utf8');
    fs.writeFileSync(path.join(directory, 'node_modules', 'demo', 'index.js'), 'dependency', 'utf8');
    fs.writeFileSync(path.join(directory, 'dist', 'assets', 'index.js'), 'build', 'utf8');

    const manifest = await buildLocalMicroServiceSourceManifest(directory);
    assert.deepEqual(
      manifest.files.map(file => file.relativePath),
      ['package.json', 'src/ReportWorkPage.vue', 'src/microi.v8.js'],
    );
    assert.equal(manifest.files.find(file => file.relativePath === 'src/microi.v8.js')?.size, 93 * 1024);
    assert.equal(manifest.files.some(file => file.relativePath.includes('.sync-seg-')), false);
    assert.deepEqual(manifest.skippedDirectories.sort(), ['dist', 'node_modules']);
    assert.match(manifest.manifestHash, /^[a-f0-9]{64}$/u);
  });
});

test('obsolete AI-created source chunks fail with the direct-directory recovery instruction', async () => {
  await withTemporaryProject(async directory => {
    fs.writeFileSync(path.join(directory, 'package.json'), '{}\n', 'utf8');
    fs.writeFileSync(path.join(directory, '.sync-seg-4.json'), '{}\n', 'utf8');
    await assert.rejects(
      () => buildLocalMicroServiceSourceManifest(directory),
      /删除 \.sync-seg-\* \/ sync-source-files\.json[\s\S]*直接把项目 directory 传给 microi_sync_microservice_source/u,
    );
  });
});

test('source directory rejects secrets before any remote write', async () => {
  await withTemporaryProject(async directory => {
    fs.writeFileSync(path.join(directory, 'package.json'), '{}\n', 'utf8');
    fs.writeFileSync(path.join(directory, '.env.production'), 'TOKEN=secret\n', 'utf8');
    await assert.rejects(
      () => buildLocalMicroServiceSourceManifest(directory),
      /环境密钥文件/u,
    );
  });
});
