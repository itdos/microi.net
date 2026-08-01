import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { MicroiClient } from './microi-client.js';
import {
  buildLocalApplicationAssetManifest,
  isLegacyApplicationStreamJValueFailure,
  resolveLegacyApplicationStreamFallbackPolicy,
  tryLegacyMicroServiceStreamPublishFallback,
} from './server.js';

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
    const expectedManifestHash = crypto.createHash('sha256')
      .update(manifest.assets.map(asset => `${asset.relativePath}\t${asset.sha256}\t${asset.size}`).join('\n'))
      .digest('hex');
    assert.equal(manifest.manifestHash, expectedManifestHash);
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

test('legacy stream detector only matches the pre-write Newtonsoft JValue.Val defect', () => {
  assert.equal(isLegacyApplicationStreamJValueFailure({
    Code: 0,
    Data: null,
    Msg: "应用资产流式上传失败：'Newtonsoft.Json.Linq.JValue' does not contain a definition for 'Val'",
  }), true);
  assert.equal(isLegacyApplicationStreamJValueFailure({
    Code: 0,
    Data: null,
    Msg: 'HDFS 上传失败',
  }), false);
  assert.equal(isLegacyApplicationStreamJValueFailure({
    Code: 1,
    Data: null,
    Msg: "'Newtonsoft.Json.Linq.JValue' does not contain a definition for 'Val'",
  }), false);
});

test('legacy stream fallback policy is fail-closed when multipart streaming is required', () => {
  const defect = {
    Code: 0,
    Data: null,
    Msg: "应用资产流式上传失败：'Newtonsoft.Json.Linq.JValue' does not contain a definition for 'Val'",
  };
  assert.deepEqual(resolveLegacyApplicationStreamFallbackPolicy(defect, 0, false), {
    matched: true,
    attemptFallback: false,
    requireMultipartStream: true,
  });
  assert.deepEqual(resolveLegacyApplicationStreamFallbackPolicy(defect, 0, true), {
    matched: true,
    attemptFallback: true,
    requireMultipartStream: false,
  });
  assert.deepEqual(resolveLegacyApplicationStreamFallbackPolicy(defect, 1, false), {
    matched: false,
    attemptFallback: false,
    requireMultipartStream: false,
  });
  assert.deepEqual(resolveLegacyApplicationStreamFallbackPolicy({ ...defect, Msg: 'ordinary upload failure' }, 0, false), {
    matched: false,
    attemptFallback: false,
    requireMultipartStream: false,
  });
});

test('small existing MicroService can use bounded legacy CSharp publish compatibility', async () => {
  const root = createTempDirectory();
  let publishedPayload: Record<string, unknown> | undefined;
  try {
    fs.mkdirSync(path.join(root, 'assets'));
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><html><head></head><body>ok</body></html>');
    fs.writeFileSync(path.join(root, 'assets', 'app.js'), 'window.compat = true;');
    const manifest = await buildLocalApplicationAssetManifest(root);
    const fakeClient = {
      getApplicationContext: async () => ({
        Code: 1,
        Data: {
          Application: {
            Id: 'app-row-id',
            AppKey: 'microi-platform-service',
            AppName: '平台服务',
            ApplicationType: 'MicroService',
          },
        },
        Msg: '',
      }),
      publishMicroService: async (payload: Record<string, unknown>) => {
        publishedPayload = payload;
        return {
          Code: 1,
          Data: { MsKey: 'microi-platform-service', RuntimeManifestHash: manifest.manifestHash },
          Msg: '',
        };
      },
    } as unknown as MicroiClient;

    const fallback = await tryLegacyMicroServiceStreamPublishFallback(fakeClient, manifest, {
      appIdOrKey: 'app-row-id',
      versionNo: 'v1.2.0',
      routes: [{ PageKey: 'home', RoutePath: '/' }],
      deliveryBatchId: 'delivery-1',
      sourceManifestHash: 'a'.repeat(64),
    });

    assert.equal(fallback.attempted, true);
    assert.equal(fallback.response?.Code, 1);
    const microService = publishedPayload?.microService as Record<string, unknown>;
    assert.equal(microService.MsKey, 'microi-platform-service');
    assert.equal(microService.BuildVersion, 'v1.2.0');
    assert.equal(microService.StorageMode, 'file');
    const assets = publishedPayload?.assets as Array<Record<string, unknown>>;
    assert.equal(assets.length, 2);
    const entry = assets.find(asset => asset.Path === 'index.html');
    assert.equal(entry?.IsEntry, true);
    assert.match(Buffer.from(String(entry?.FileByteBase64), 'base64').toString('utf8'), /<!doctype html>/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('legacy compatibility fails closed for Web applications', async () => {
  const root = createTempDirectory();
  let publishCalls = 0;
  try {
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><html><head></head><body>web</body></html>');
    const manifest = await buildLocalApplicationAssetManifest(root);
    const fakeClient = {
      getApplicationContext: async () => ({
        Code: 1,
        Data: { Application: { AppKey: 'web-app', ApplicationType: 'Web' } },
        Msg: '',
      }),
      publishMicroService: async () => {
        publishCalls += 1;
        return { Code: 1, Data: {}, Msg: '' };
      },
    } as unknown as MicroiClient;
    const fallback = await tryLegacyMicroServiceStreamPublishFallback(fakeClient, manifest, {
      appIdOrKey: 'web-app',
      versionNo: 'v1.0.1',
      deliveryBatchId: 'delivery-web',
    });
    assert.equal(fallback.attempted, false);
    assert.match(fallback.reason, /只支持 MicroService/u);
    assert.equal(publishCalls, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
