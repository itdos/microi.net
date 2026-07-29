import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { MicroiClient } from './microi-client.js';
import { buildLocalApplicationAssetManifest } from './server.js';

function createTempDirectory(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'microi-stream-publish-'));
}

test('buildLocalApplicationAssetManifest hashes ordinary files and skips source maps', async () => {
  const root = createTempDirectory();
  try {
    fs.mkdirSync(path.join(root, 'assets'));
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><script src="assets/app.js"></script>');
    fs.writeFileSync(path.join(root, 'assets', 'app.js'), 'window.microiStreamTest = true;');
    fs.writeFileSync(path.join(root, 'assets', 'app.js.map'), '{}');
    fs.writeFileSync(path.join(root, 'empty.txt'), '');

    const manifest = await buildLocalApplicationAssetManifest(root);
    assert.equal(manifest.assets.length, 3);
    assert.deepEqual(manifest.skippedSourceMaps, ['assets/app.js.map']);
    assert.equal(manifest.assets.filter(asset => asset.isEntry).length, 1);
    const js = manifest.assets.find(asset => asset.relativePath === 'assets/app.js');
    assert.equal(js?.sha256, crypto.createHash('sha256').update('window.microiStreamTest = true;').digest('hex'));
    assert.equal(manifest.assets.find(asset => asset.relativePath === 'empty.txt')?.size, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('buildLocalApplicationAssetManifest rejects secrets and runaway project directories before upload', async () => {
  const secretRoot = createTempDirectory();
  const projectRoot = createTempDirectory();
  try {
    fs.writeFileSync(path.join(secretRoot, 'index.html'), 'ok');
    fs.writeFileSync(path.join(secretRoot, '.env.production'), 'SECRET=1');
    await assert.rejects(() => buildLocalApplicationAssetManifest(secretRoot), /密钥或环境配置/u);

    fs.writeFileSync(path.join(projectRoot, 'index.html'), 'ok');
    fs.mkdirSync(path.join(projectRoot, 'node_modules'));
    await assert.rejects(() => buildLocalApplicationAssetManifest(projectRoot), /真实编译输出目录/u);
  } finally {
    fs.rmSync(secretRoot, { recursive: true, force: true });
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('uploadApplicationAssetStream sends raw multipart bytes without Base64 materialization', async () => {
  const root = createTempDirectory();
  const filePath = path.join(root, 'asset.bin');
  const raw = Buffer.from('microi-raw-stream-body-2026', 'utf8');
  fs.writeFileSync(filePath, raw);
  const originalFetch = globalThis.fetch;
  let captured = Buffer.alloc(0);
  try {
    globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
      const pieces: Buffer[] = [];
      const body = init?.body as unknown as AsyncIterable<Uint8Array>;
      for await (const chunk of body) pieces.push(Buffer.from(chunk));
      captured = Buffer.concat(pieces);
      assert.equal(init?.headers && (init.headers as Record<string, string>)['Content-Length'], String(captured.length));
      return new Response(JSON.stringify({ Code: 1, Data: { Streamed: true }, Msg: '' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const client = new MicroiClient({
      apiBaseUrl: 'https://api.example.test',
      username: '',
      password: '',
      osClient: 'iTdos',
      token: 'unit-test-token',
    });
    const result = await client.uploadApplicationAssetStream({
      AppIdOrKey: 'stream-app',
      VersionNo: 'v1.0.0',
      RelativePath: 'assets/asset.bin',
      ExpectedSha256: crypto.createHash('sha256').update(raw).digest('hex'),
      FilePath: filePath,
    });
    assert.equal(result.Code, 1);
    assert.ok(captured.includes(raw));
    assert.equal(captured.includes(Buffer.from(raw.toString('base64'), 'utf8')), false);
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
