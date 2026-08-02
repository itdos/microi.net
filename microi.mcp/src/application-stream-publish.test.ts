import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { MicroiClient } from './microi-client.js';
import {
  buildConservativeApplicationAssetStreamV3ImmutablePath,
  buildApplicationAssetStreamV3RouteSnapshot,
  buildApplicationAssetRequestId,
  buildApplicationFinalizeRequestId,
  buildLocalApplicationAssetManifest,
  encodeApplicationAssetStreamV3RelativePath,
  isLegacyApplicationStreamJValueFailure,
  resolveApplicationAssetStreamV3Contract,
  resolveLegacyApplicationStreamFallbackPolicy,
  runApplicationDirectoryStreamPublish,
  tryLegacyMicroServiceStreamPublishFallback,
  validateLocalApplicationAssetSize,
} from './server.js';

const EMPTY_ROUTE_SNAPSHOT_JSON = '[]';
const EMPTY_ROUTE_SNAPSHOT_HASH = crypto.createHash('sha256').update(EMPTY_ROUTE_SNAPSHOT_JSON, 'utf8').digest('hex');

test('MCP route canonical JSON 与 Node/Core 固定 UTF-8 hash 向量一致并拒绝非 safe integer', () => {
  const snapshot = buildApplicationAssetStreamV3RouteSnapshot([
    { title: '中文"引号', meta: { z: 9007199254740991, a: -9007199254740991 }, path: '/a' },
    { order: 0 },
  ]);
  assert.equal(snapshot.routeSnapshotHash, '39ac0b5c44884edcb6497dbf6a0fa8a2e95a1f2a968e8eaa10e7557e0443d47e');
  assert.throws(() => buildApplicationAssetStreamV3RouteSnapshot([{ order: 0.5 }]), /safe integer/u);
  assert.throws(() => buildApplicationAssetStreamV3RouteSnapshot([{ order: 9007199254740992 }]), /safe integer/u);
});

test('protocol v3 nullable baselines reject empty strings to preserve Oracle/MySQL/SQL Server CAS parity', () => {
  const base = {
    appIdOrKey: 'v3-nullable-baseline',
    versionNo: 'v1.0.0',
    directory: '.',
    publishMode: 'stage' as const,
    protocolVersion: 3 as const,
    expectedGateEpoch: '1',
    requestId: 'v3-nullable-baseline-request',
    requestFingerprint: 'a'.repeat(64),
    deliveryBatchId: 'v3-nullable-baseline-batch',
    sourceManifestHash: 'b'.repeat(64),
    runtimeManifestHash: 'c'.repeat(64),
    routes: [],
    routeSnapshotJson: EMPTY_ROUTE_SNAPSHOT_JSON,
    routeSnapshotHash: EMPTY_ROUTE_SNAPSHOT_HASH,
    expectedCurrentVersion: 0,
    expectedAppVersion: null,
    expectedPublishFence: '0',
    expectedPublishRowVersion: '0',
    expectedVersionRowVersion: null,
    expectedActivePublishVersionId: null,
    expectedCommittedPublishVersionId: null,
    allowLegacyFallback: false,
  };

  assert.ok(resolveApplicationAssetStreamV3Contract(base, base.runtimeManifestHash));
  assert.throws(
    () => resolveApplicationAssetStreamV3Contract({ ...base, expectedAppVersion: '' }, base.runtimeManifestHash),
    /非空字符串或 null/u,
  );
  assert.throws(
    () => resolveApplicationAssetStreamV3Contract({ ...base, expectedActivePublishVersionId: ' ' }, base.runtimeManifestHash),
    /非空字符串或 null/u,
  );
});

function createTempDirectory(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'microi-stream-publish-'));
}

function parseToolJson(result: Awaited<ReturnType<typeof runApplicationDirectoryStreamPublish>>): Record<string, unknown> {
  const textBlock = result.content.find(item => item.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('tool result has no text content');
  return JSON.parse(textBlock.text) as Record<string, unknown>;
}

test('buildLocalApplicationAssetManifest hashes ordinary files and skips source maps plus only root build evidence', async () => {
  const root = createTempDirectory();
  try {
    fs.mkdirSync(path.join(root, 'assets'));
    fs.mkdirSync(path.join(root, 'reports'));
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><script src="assets/app.js"></script>');
    fs.writeFileSync(path.join(root, 'assets', 'app.js'), 'window.microiStreamTest = true;');
    fs.writeFileSync(path.join(root, 'assets', 'app.js.map'), '{}');
    fs.writeFileSync(path.join(root, 'empty.txt'), '');
    fs.writeFileSync(path.join(root, '.microi-build-evidence.json'), '{"sourceRoot":"D:/private","builtAt":"2026-08-02T00:00:00Z"}');
    fs.writeFileSync(path.join(root, 'business.microi-build-evidence.json'), '{"business":true}');
    fs.writeFileSync(path.join(root, 'reports', '.microi-build-evidence.json'), '{"nestedBusiness":true}');

    const manifest = await buildLocalApplicationAssetManifest(root);
    assert.equal(manifest.assets.length, 5);
    assert.deepEqual(manifest.skippedSourceMaps, ['assets/app.js.map']);
    assert.deepEqual(manifest.skippedInternalEvidenceFiles, ['.microi-build-evidence.json']);
    assert.equal(manifest.assets.some(asset => asset.relativePath === '.microi-build-evidence.json'), false);
    assert.equal(manifest.assets.some(asset => asset.relativePath === 'business.microi-build-evidence.json'), true);
    assert.equal(manifest.assets.some(asset => asset.relativePath === 'reports/.microi-build-evidence.json'), true);
    assert.equal(manifest.assets.some(asset => fs.readFileSync(asset.absolutePath, 'utf8').includes('D:/private')), false);
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

test('buildLocalApplicationAssetManifest uses .NET ordinal path order for cross-runtime manifest hashes', async () => {
  const root = createTempDirectory();
  try {
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><html><head></head><body>ordinal</body></html>');
    fs.writeFileSync(path.join(root, 'app.js'), 'window.ordinal = true;');
    fs.writeFileSync(path.join(root, 'THIRD-PARTY-NOTICES.txt'), 'notices');

    const manifest = await buildLocalApplicationAssetManifest(root);
    assert.deepEqual(
      manifest.assets.map(asset => asset.relativePath),
      ['THIRD-PARTY-NOTICES.txt', 'app.js', 'index.html'],
    );
    const canonical = manifest.assets
      .map(asset => `${asset.relativePath}\t${asset.sha256}\t${asset.size}`)
      .join('\n');
    assert.equal(manifest.manifestHash, crypto.createHash('sha256').update(canonical).digest('hex'));
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

test('application stream limits reject files above 128 MiB and manifests above 1 GiB before upload', async () => {
  assert.throws(
    () => validateLocalApplicationAssetSize('assets/oversize.bin', 128 * 1024 * 1024 + 1, 128 * 1024 * 1024 + 1),
    /单文件超过硬上限 134217728 bytes.*上传前中止/u,
  );
  assert.throws(
    () => validateLocalApplicationAssetSize('assets/final.bin', 1, 1024 * 1024 * 1024 + 1),
    /发布总大小超过上限 1073741824 bytes.*上传前中止/u,
  );

  const root = createTempDirectory();
  let uploadCalls = 0;
  try {
    fs.writeFileSync(path.join(root, 'index.html'), 'larger-than-custom-preflight-cap');
    const fakeClient = {
      uploadApplicationAssetStream: async () => {
        uploadCalls += 1;
        return { Code: 1, Data: {}, Msg: '' };
      },
    } as unknown as MicroiClient;
    const result = await runApplicationDirectoryStreamPublish(fakeClient, {
      appIdOrKey: 'preflight-limit-app',
      versionNo: 'v1.0.0',
      directory: root,
      publishMode: 'stage',
      maxTotalMegabytes: 0.000001,
      confirmExecution: 'preflight-limit-app',
    });
    assert.equal(result.isError, true);
    assert.match(result.content[0].type === 'text' ? result.content[0].text : '', /上传前中止/u);
    assert.equal(uploadCalls, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
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
      RequestId: 'request-asset-stream-unit-test',
      FilePath: filePath,
    });
    assert.equal(result.Code, 1);
    assert.ok(captured.includes(raw));
    assert.equal(captured.includes(Buffer.from(raw.toString('base64'), 'utf8')), false);
    assert.match(captured.toString('utf8'), /name="RequestId"\r\n\r\nrequest-asset-stream-unit-test/u);
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('protocol v3 multipart forwards canonical bigint strings and explicit null baselines as PascalCase fields', async () => {
  const root = createTempDirectory();
  const filePath = path.join(root, 'index.html');
  fs.writeFileSync(filePath, '<!doctype html><body>v3 multipart</body>');
  const originalFetch = globalThis.fetch;
  let captured = '';
  try {
    globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
      const pieces: Buffer[] = [];
      for await (const chunk of init?.body as unknown as AsyncIterable<Uint8Array>) pieces.push(Buffer.from(chunk));
      captured = Buffer.concat(pieces).toString('utf8');
      return new Response(JSON.stringify({ Code: 1, Data: {}, Msg: '' }), {
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
    await client.uploadApplicationAssetStream({
      AppIdOrKey: 'v3-contract-app',
      VersionNo: 'v1.0.0',
      RelativePath: 'index.html',
      ExpectedSha256: 'a'.repeat(64),
      RequestId: 'catalog-v3-shared-request-id',
      FilePath: filePath,
      ProtocolVersion: 3,
      ExpectedGateEpoch: '9007199254740993',
      RequestFingerprint: 'b'.repeat(64),
      DeliveryBatchId: 'catalog-v3-delivery-contract',
      SourceManifestHash: 'c'.repeat(64),
      RuntimeManifestHash: 'd'.repeat(64),
      RouteSnapshotJson: EMPTY_ROUTE_SNAPSHOT_JSON,
      RouteSnapshotHash: EMPTY_ROUTE_SNAPSHOT_HASH,
      ExpectedCurrentVersion: 8,
      ExpectedAppVersion: null,
      ExpectedPublishFence: '9007199254740995',
      ExpectedPublishRowVersion: '9007199254740997',
      ExpectedVersionRowVersion: null,
      ExpectedActivePublishVersionId: null,
      ExpectedCommittedPublishVersionId: 'version-old',
    });
    const field = (name: string, value: string): RegExp => new RegExp(`name="${name}"\\r\\n\\r\\n${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\r\\n`, 'u');
    assert.match(captured, field('ProtocolVersion', '3'));
    assert.match(captured, field('PublishMode', 'stage'));
    assert.match(captured, field('ExpectedGateEpoch', '9007199254740993'));
    assert.match(captured, field('RequestId', 'catalog-v3-shared-request-id'));
    assert.match(captured, field('RequestFingerprint', 'b'.repeat(64)));
    assert.match(captured, field('RouteSnapshotJson', EMPTY_ROUTE_SNAPSHOT_JSON));
    assert.match(captured, field('RouteSnapshotHash', EMPTY_ROUTE_SNAPSHOT_HASH));
    assert.match(captured, field('ExpectedPublishFence', '9007199254740995'));
    assert.match(captured, field('ExpectedPublishRowVersion', '9007199254740997'));
    assert.match(captured, field('ExpectedVersionRowVersion', 'null'));
    assert.match(captured, field('ExpectedActivePublishVersionId', 'null'));
    assert.match(captured, field('ExpectedAppVersion', 'null'));
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('protocol v3 paths are NFC and segment-encoded, with unsafe or oversized immutable paths rejected', () => {
  assert.equal(
    encodeApplicationAssetStreamV3RelativePath('assets/中文 文件.js'),
    'assets/%E4%B8%AD%E6%96%87%20%E6%96%87%E4%BB%B6.js',
  );
  for (const invalid of [
    'assets/pre%20encoded.js',
    'assets/query?.js',
    'assets/hash#.js',
    'assets\\backslash.js',
    'assets//empty.js',
    'assets/root/app.js',
    'assets/LATEST/app.js',
    `assets/${'e\u0301'}.js`,
    'assets/control\u0001.js',
  ]) {
    assert.throws(() => encodeApplicationAssetStreamV3RelativePath(invalid), /v3|路径|NFC|控制/u);
  }
  const longButIndividuallyValid = [
    'a'.repeat(240),
    'b'.repeat(240),
    'c'.repeat(240),
  ].join('/');
  assert.throws(() => buildConservativeApplicationAssetStreamV3ImmutablePath({
    appIdOrKey: 'a'.repeat(128),
    versionNo: `v${'1'.repeat(62)}`,
    requestFingerprint: 'f'.repeat(64),
    relativePath: longButIndividuallyValid,
  }), /完整 immutable path.*1000/u);
});

test('protocol v3 manifest path preflight fails before the first upload', async () => {
  const root = createTempDirectory();
  try {
    fs.mkdirSync(path.join(root, 'assets'));
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><body>v3 path preflight</body>');
    fs.writeFileSync(path.join(root, 'assets', 'pre%20encoded.js'), 'window.invalidV3Path = true;');
    const manifest = await buildLocalApplicationAssetManifest(root);
    let uploads = 0;
    let finalizes = 0;
    const fakeClient = {
      uploadApplicationAssetStream: async () => {
        uploads += 1;
        return { Code: 0, Data: null, Msg: 'must not upload' };
      },
      finalizeApplicationStreamPublish: async () => {
        finalizes += 1;
        return { Code: 0, Data: null, Msg: 'must not finalize' };
      },
    } as unknown as MicroiClient;
    const result = await runApplicationDirectoryStreamPublish(fakeClient, {
      appIdOrKey: 'v3-path-preflight',
      versionNo: 'v1.0.0',
      directory: root,
      publishMode: 'stage',
      protocolVersion: 3,
      expectedGateEpoch: '9',
      requestId: 'catalog-v3-path-preflight-request',
      requestFingerprint: '9'.repeat(64),
      deliveryBatchId: 'catalog-v3-path-preflight-delivery',
      sourceManifestHash: '8'.repeat(64),
      runtimeManifestHash: manifest.manifestHash,
      routes: [],
      routeSnapshotJson: EMPTY_ROUTE_SNAPSHOT_JSON,
      routeSnapshotHash: EMPTY_ROUTE_SNAPSHOT_HASH,
      expectedCurrentVersion: 0,
      expectedAppVersion: null,
      expectedPublishFence: '0',
      expectedPublishRowVersion: '0',
      expectedVersionRowVersion: null,
      expectedActivePublishVersionId: null,
      expectedCommittedPublishVersionId: null,
      allowLegacyFallback: false,
      confirmExecution: 'v3-path-preflight',
    });
    assert.equal(result.isError, true);
    assert.equal(uploads, 0);
    assert.equal(finalizes, 0);
    const textBlock = result.content.find(item => item.type === 'text');
    assert.ok(textBlock && textBlock.type === 'text');
    assert.match(textBlock.text, /禁止预编码/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('protocol v3 stage uses one release RequestId for every asset then obtains server ReleaseVerified', async () => {
  const root = createTempDirectory();
  try {
    fs.mkdirSync(path.join(root, 'assets'));
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><body>v3 stage</body>');
    fs.writeFileSync(path.join(root, 'assets', '中文 文件.js'), 'window.v3Stage = true;');
    const manifest = await buildLocalApplicationAssetManifest(root);
    const requestId = 'catalog-v3-shared-stage-finalize-id';
    const fingerprint = 'e'.repeat(64);
    const sourceHash = 'f'.repeat(64);
    const releasePrefix = `microi/application-assets/v3/tenants/iTdos/kinds/Web/apps/v3-stage-app/releases/v1.0.0/requests/${fingerprint}`;
    const uploadCalls: Array<Parameters<MicroiClient['uploadApplicationAssetStream']>[0]> = [];
    const finalizeCalls: Array<Parameters<MicroiClient['finalizeApplicationStreamPublish']>[0]> = [];
    const fakeClient = {
      uploadApplicationAssetStream: async (input: Parameters<MicroiClient['uploadApplicationAssetStream']>[0]) => {
        uploadCalls.push(input);
        return {
          Code: 1,
          Data: {
            ProtocolVersion: 3,
            PublishMode: 'stage',
            GateEpoch: input.ExpectedGateEpoch,
            AppKey: 'v3-stage-app',
            VersionNo: 'v1.0.0',
            RequestId: input.RequestId,
            DeliveryBatchId: input.DeliveryBatchId,
            RequestFingerprint: input.RequestFingerprint,
            RouteSnapshotJson: input.RouteSnapshotJson,
            RouteSnapshotHash: input.RouteSnapshotHash,
            PublishState: 'Prepared',
            PointerState: 'Uncommitted',
            Pending: true,
            FencingToken: '9007199254741001',
            Path: input.RelativePath,
            Sha256: input.ExpectedSha256,
            Size: fs.statSync(input.FilePath).size,
            ReleaseFilePath: `${releasePrefix}/assets/${input.RelativePath.split('/').map(segment => encodeURIComponent(segment)).join('/')}`,
            Idempotent: false,
          },
          Msg: '',
        };
      },
      finalizeApplicationStreamPublish: async (input: Parameters<MicroiClient['finalizeApplicationStreamPublish']>[0]) => {
        finalizeCalls.push(input);
        return {
          Code: 1,
          Data: {
            ProtocolVersion: 3,
            PublishMode: 'stage',
            GateEpoch: input.ExpectedGateEpoch,
            V3Only: true,
            AllowedModes: ['stage', 'finalize'],
            AppKey: 'v3-stage-app',
            VersionId: 'version-v3-stage',
            VersionNo: 'v1.0.0',
            RequestId: input.RequestId,
            DeliveryBatchId: input.DeliveryBatchId,
            RequestFingerprint: input.RequestFingerprint,
            RouteSnapshotJson: input.RouteSnapshotJson,
            RouteSnapshotHash: input.RouteSnapshotHash,
            PublishFence: input.ExpectedPublishFence,
            PublishRowVersion: input.ExpectedPublishRowVersion,
            VersionRowVersion: '1',
            FencingToken: '9007199254741001',
            PublishState: 'ReleaseVerified',
            PhaseState: 'ReleaseVerified',
            PointerState: 'Uncommitted',
            Pending: false,
            ProjectionPending: false,
            RetryAfterMs: 0,
            ReleasePrefix: releasePrefix,
            ReleaseEntryPath: `${releasePrefix}/assets/index.html`,
            StableResolverPath: '/micro-app/v3/tenants/iTdos/kinds/Web/apps/v3-stage-app/assets/index.html',
            RuntimeManifestHash: input.RuntimeManifestHash,
            SourceManifestHash: input.SourceManifestHash,
          },
          Msg: '',
        };
      },
    } as unknown as MicroiClient;
    const result = await runApplicationDirectoryStreamPublish(fakeClient, {
      appIdOrKey: 'v3-stage-app',
      versionNo: 'v1.0.0',
      directory: root,
      publishMode: 'stage',
      protocolVersion: 3,
      expectedGateEpoch: '9007199254740993',
      requestId,
      requestFingerprint: fingerprint,
      deliveryBatchId: 'catalog-v3-stage-delivery-id',
      sourceManifestHash: sourceHash,
      runtimeManifestHash: manifest.manifestHash,
      routes: [],
      routeSnapshotJson: EMPTY_ROUTE_SNAPSHOT_JSON,
      routeSnapshotHash: EMPTY_ROUTE_SNAPSHOT_HASH,
      expectedCurrentVersion: 6,
      expectedAppVersion: 'v0.9.0',
      expectedPublishFence: '9007199254740995',
      expectedPublishRowVersion: '9007199254740997',
      expectedVersionRowVersion: null,
      expectedActivePublishVersionId: null,
      expectedCommittedPublishVersionId: 'version-old',
      allowLegacyFallback: false,
      confirmExecution: 'v3-stage-app',
    });
    assert.equal(result.isError, undefined);
    assert.equal(uploadCalls.length, 2);
    assert.equal(new Set(uploadCalls.map(call => call.RequestId)).size, 1);
    assert.equal(uploadCalls[0].RequestId, requestId);
    assert.equal(uploadCalls[0].ExpectedGateEpoch, '9007199254740993');
    assert.equal(uploadCalls[0].ExpectedVersionRowVersion, null);
    assert.ok(uploadCalls.some(call => call.RelativePath === 'assets/中文 文件.js'));
    assert.equal(finalizeCalls.length, 1);
    assert.equal(finalizeCalls[0].PublishMode, 'stage');
    assert.equal(finalizeCalls[0].RequestId, requestId);
    assert.equal(finalizeCalls[0].ExpectedVersionRowVersion, null);
    const payload = parseToolJson(result);
    assert.equal(payload.PublishState, 'ReleaseVerified');
    assert.equal(payload.Pending, false);
    assert.equal(payload.requestId, requestId);
    assert.equal(payload.transport, 'v3-multipart-immutable-release-stage');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('protocol v3 finalize returns Pending without probing and exact replay keeps one payload and RequestId', async () => {
  const root = createTempDirectory();
  try {
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><body>v3 finalize</body>');
    const manifest = await buildLocalApplicationAssetManifest(root);
    const requestId = 'catalog-v3-shared-pending-request-id';
    const fingerprint = '1'.repeat(64);
    const sourceHash = '2'.repeat(64);
    const releasePrefix = `microi/application-assets/v3/tenants/iTdos/kinds/Web/apps/v3-finalize-app/releases/v2.0.0/requests/${fingerprint}`;
    const finalizeCalls: Array<Parameters<MicroiClient['finalizeApplicationStreamPublish']>[0]> = [];
    let uploadCalls = 0;
    const fakeClient = {
      uploadApplicationAssetStream: async () => {
        uploadCalls += 1;
        return { Code: 0, Data: null, Msg: 'finalize must not upload' };
      },
      finalizeApplicationStreamPublish: async (input: Parameters<MicroiClient['finalizeApplicationStreamPublish']>[0]) => {
        finalizeCalls.push(structuredClone(input));
        const completed = finalizeCalls.length > 1;
        return {
          Code: 1,
          Data: {
            ProtocolVersion: 3,
            PublishMode: 'finalize',
            GateEpoch: input.ExpectedGateEpoch,
            V3Only: true,
            AllowedModes: ['stage', 'finalize'],
            AppKey: 'v3-finalize-app',
            VersionId: 'version-v3-final',
            VersionNo: 'v2.0.0',
            RequestId: input.RequestId,
            DeliveryBatchId: input.DeliveryBatchId,
            RequestFingerprint: input.RequestFingerprint,
            RouteSnapshotJson: input.RouteSnapshotJson,
            RouteSnapshotHash: input.RouteSnapshotHash,
            PublishFence: '9007199254741011',
            PublishRowVersion: '9007199254741008',
            VersionRowVersion: '4',
            CommittedPublishVersionId: 'version-v3-final',
            CommittedRuntimeManifestHash: input.RuntimeManifestHash,
            PublishState: completed ? 'Completed' : 'ProjectionPending',
            AppPublishState: completed ? 'Completed' : 'ProjectionPending',
            PointerState: 'Committed',
            Pending: !completed,
            Completed: completed,
            ProjectionPending: !completed,
            RetryAfterMs: 0,
            ReleasePrefix: releasePrefix,
            ReleaseEntryPath: `${releasePrefix}/assets/index.html`,
            StableResolverPath: '/micro-app/v3/tenants/iTdos/kinds/Web/apps/v3-finalize-app/assets/index.html',
            RuntimeManifestHash: input.RuntimeManifestHash,
            SourceManifestHash: input.SourceManifestHash,
          },
          Msg: '',
        };
      },
    } as unknown as MicroiClient;
    const input = {
      appIdOrKey: 'v3-finalize-app',
      versionNo: 'v2.0.0',
      directory: root,
      publishMode: 'finalize' as const,
      protocolVersion: 3 as const,
      expectedGateEpoch: '9007199254740993',
      requestId,
      requestFingerprint: fingerprint,
      deliveryBatchId: 'catalog-v3-finalize-delivery',
      sourceManifestHash: sourceHash,
      runtimeManifestHash: manifest.manifestHash,
      routes: [],
      routeSnapshotJson: EMPTY_ROUTE_SNAPSHOT_JSON,
      routeSnapshotHash: EMPTY_ROUTE_SNAPSHOT_HASH,
      expectedCurrentVersion: 10,
      expectedAppVersion: 'v1.9.0',
      expectedPublishFence: '9007199254741005',
      expectedPublishRowVersion: '9007199254741007',
      expectedVersionRowVersion: '3',
      expectedActivePublishVersionId: 'version-stage',
      expectedCommittedPublishVersionId: 'version-old',
      allowLegacyFallback: false,
      confirmExecution: 'v3-finalize-app',
    };
    const pending = parseToolJson(await runApplicationDirectoryStreamPublish(fakeClient, input));
    assert.equal(pending.PublishState, 'ProjectionPending');
    assert.equal(pending.Pending, true);
    const complete = parseToolJson(await runApplicationDirectoryStreamPublish(fakeClient, input));
    assert.equal(complete.PublishState, 'Completed');
    assert.equal(complete.Pending, false);
    assert.equal(uploadCalls, 0);
    assert.equal(finalizeCalls.length, 2);
    assert.deepEqual(finalizeCalls[0], finalizeCalls[1]);
    assert.equal(finalizeCalls[0].RequestId, requestId);
    assert.equal(finalizeCalls[0].PublishMode, 'finalize');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('stage mode uploads every asset without finalizing and reuses deterministic request ids on retry', async () => {
  const root = createTempDirectory();
  try {
    fs.mkdirSync(path.join(root, 'assets'));
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><html><head></head><body>stage</body></html>');
    fs.writeFileSync(path.join(root, 'assets', 'app.js'), 'window.stage = true;');
    const seen = new Set<string>();
    const uploadCalls: Array<Parameters<MicroiClient['uploadApplicationAssetStream']>[0]> = [];
    let finalizeCalls = 0;
    const fakeClient = {
      uploadApplicationAssetStream: async (input: Parameters<MicroiClient['uploadApplicationAssetStream']>[0]) => {
        uploadCalls.push(input);
        const idempotent = seen.has(input.RequestId);
        seen.add(input.RequestId);
        return {
          Code: 1,
          Data: {
            RequestId: input.RequestId,
            VersionNo: 'v3.2.1',
            Path: input.RelativePath,
            Sha256: input.ExpectedSha256,
            Size: fs.statSync(input.FilePath).size,
            Idempotent: idempotent,
            StablePromoted: false,
          },
          Msg: '',
        };
      },
      finalizeApplicationStreamPublish: async () => {
        finalizeCalls += 1;
        return { Code: 0, Data: null, Msg: 'must not finalize in stage mode' };
      },
    } as unknown as MicroiClient;
    const input = {
      appIdOrKey: 'two-phase-app',
      versionNo: 'v3.2.1',
      directory: root,
      publishMode: 'stage' as const,
      confirmExecution: 'two-phase-app',
    };

    const first = await runApplicationDirectoryStreamPublish(fakeClient, input);
    assert.equal(first.isError, undefined);
    const firstPayload = parseToolJson(first);
    assert.equal(firstPayload.publishMode, 'stage');
    assert.equal(firstPayload.assetCount, 2);
    assert.equal(firstPayload.stagedCount, 2);
    assert.equal(firstPayload.uploadedCount, 2);
    assert.equal(firstPayload.StablePromoted, false);
    assert.ok(String(firstPayload.deliveryBatchId).length <= 50, 'default batch id must fit LastBuildTaskId');
    assert.equal(finalizeCalls, 0);
    const firstRequestIds = uploadCalls.map(call => call.RequestId);
    assert.equal(new Set(firstRequestIds).size, 2);

    const second = await runApplicationDirectoryStreamPublish(fakeClient, input);
    assert.equal(second.isError, undefined);
    const secondPayload = parseToolJson(second);
    assert.equal(secondPayload.idempotentCount, 2);
    assert.deepEqual(uploadCalls.slice(2).map(call => call.RequestId), firstRequestIds);
    assert.equal(firstPayload.requestId, secondPayload.requestId);
    assert.equal(firstPayload.runtimeManifestHash, secondPayload.runtimeManifestHash);
    assert.equal(finalizeCalls, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('finalize mode performs no upload and retries with the same request id and manifest evidence', async () => {
  const root = createTempDirectory();
  try {
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><html><head></head><body>finalize</body></html>');
    const finalizeCalls: Array<Record<string, unknown>> = [];
    let uploadCalls = 0;
    const fakeClient = {
      uploadApplicationAssetStream: async () => {
        uploadCalls += 1;
        return { Code: 0, Data: null, Msg: 'must not upload in finalize mode' };
      },
      finalizeApplicationStreamPublish: async (input: Record<string, unknown>) => {
        finalizeCalls.push(input);
        const assets = input.Assets as Array<Record<string, unknown>>;
        return {
          Code: 1,
          Data: {
            AppKey: 'two-phase-app',
            RequestId: input.RequestId,
            VersionNo: 'v3.2.1',
            EntryPath: input.EntryPath,
            DeliveryBatchId: input.DeliveryBatchId,
            RuntimeManifestHash: input.RuntimeManifestHash,
            AssetCount: assets.length,
            TotalSize: assets.reduce((sum, asset) => sum + Number(asset.Size), 0),
            ExpectedCurrentVersion: input.ExpectedCurrentVersion,
            ExpectedAppVersion: input.ExpectedAppVersion,
            PublishStatus: 'Published',
            VerificationStatus: 'Verified',
            StablePromoted: true,
          },
          Msg: '',
        };
      },
      probeMicroAppEntry: async () => ({ ok: true, status: 200, url: 'https://example.test/index.html' }),
    } as unknown as MicroiClient;
    const input = {
      appIdOrKey: 'two-phase-app',
      versionNo: 'v3.2.1',
      directory: root,
      publishMode: 'finalize' as const,
      expectedCurrentVersion: 7,
      expectedAppVersion: '',
      confirmExecution: 'two-phase-app',
    };

    const first = await runApplicationDirectoryStreamPublish(fakeClient, input);
    const second = await runApplicationDirectoryStreamPublish(fakeClient, input);
    assert.equal(first.isError, undefined);
    assert.equal(second.isError, undefined);
    assert.equal(uploadCalls, 0);
    assert.equal(finalizeCalls.length, 2);
    assert.equal(finalizeCalls[0].RequestId, finalizeCalls[1].RequestId);
    assert.equal(finalizeCalls[0].DeliveryBatchId, finalizeCalls[1].DeliveryBatchId);
    assert.equal(finalizeCalls[0].ExpectedCurrentVersion, 7);
    assert.equal(finalizeCalls[0].ExpectedAppVersion, '');
    const payload = parseToolJson(second);
    assert.equal(payload.publishMode, 'finalize');
    assert.equal(payload.stagedCount, 0);
    assert.equal(payload.uploadedCount, 0);
    assert.equal(payload.StablePromoted, true);
    assert.equal(payload.transport, 'manifest-finalize-only');
    assert.equal(payload.requestId, finalizeCalls[1].RequestId);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('real finalize fails before upload when either application generation precondition is missing', async () => {
  const root = createTempDirectory();
  try {
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><body>missing baseline</body>');
    let uploads = 0;
    let finalizes = 0;
    const fakeClient = {
      uploadApplicationAssetStream: async () => {
        uploads += 1;
        return { Code: 1, Data: {}, Msg: '' };
      },
      finalizeApplicationStreamPublish: async () => {
        finalizes += 1;
        return { Code: 1, Data: {}, Msg: '' };
      },
    } as unknown as MicroiClient;

    for (const partial of [
      {},
      { expectedCurrentVersion: 3 },
      { expectedAppVersion: 'v2.0.0' },
    ]) {
      const result = await runApplicationDirectoryStreamPublish(fakeClient, {
        appIdOrKey: 'missing-baseline-app',
        versionNo: 'v2.1.0',
        directory: root,
        publishMode: 'stage-and-finalize',
        confirmExecution: 'missing-baseline-app',
        ...partial,
      });
      assert.equal(result.isError, true);
      const payload = parseToolJson(result);
      assert.equal(payload.expectedStateRequired, true);
      assert.equal(payload.stablePromoted, false);
      assert.equal(payload.retrySafe, true);
    }
    assert.equal(uploads, 0);
    assert.equal(finalizes, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('finalize version preconditions fail closed unless success evidence echoes both values exactly', async () => {
  const root = createTempDirectory();
  try {
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><body>precondition</body>');
    let finalizeInput: Record<string, unknown> | undefined;
    const fakeClient = {
      uploadApplicationAssetStream: async () => ({ Code: 0, Data: null, Msg: 'must not upload' }),
      finalizeApplicationStreamPublish: async (input: Record<string, unknown>) => {
        finalizeInput = input;
        const assets = input.Assets as Array<Record<string, unknown>>;
        return {
          Code: 1,
          Data: {
            AppKey: 'precondition-app',
            RequestId: input.RequestId,
            VersionNo: 'v4.0.0',
            EntryPath: input.EntryPath,
            DeliveryBatchId: input.DeliveryBatchId,
            RuntimeManifestHash: input.RuntimeManifestHash,
            AssetCount: assets.length,
            TotalSize: assets.reduce((sum, asset) => sum + Number(asset.Size), 0),
            ExpectedCurrentVersion: 12,
            ExpectedAppVersion: 'v3.9.9-wrong',
            PublishStatus: 'Published',
            VerificationStatus: 'Verified',
            StablePromoted: true,
          },
          Msg: '',
        };
      },
      probeMicroAppEntry: async () => ({ ok: true, status: 200, url: 'https://example.test/index.html' }),
    } as unknown as MicroiClient;

    const result = await runApplicationDirectoryStreamPublish(fakeClient, {
      appIdOrKey: 'precondition-app',
      versionNo: 'v4.0.0',
      directory: root,
      publishMode: 'finalize',
      expectedCurrentVersion: 12,
      expectedAppVersion: 'v3.9.9',
      confirmExecution: 'precondition-app',
    });
    assert.equal(finalizeInput?.ExpectedCurrentVersion, 12);
    assert.equal(finalizeInput?.ExpectedAppVersion, 'v3.9.9');
    assert.equal(result.isError, true);
    const payload = parseToolJson(result);
    assert.equal(payload.evidenceMismatch, true);
    assert.equal(payload.retrySafe, false);
    assert.match(String(payload.error), /ExpectedAppVersion 不一致/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('finalize Code=0 is retry-safe only when the server explicitly says so', async () => {
  const root = createTempDirectory();
  try {
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><body>retry contract</body>');
    let explicitRetrySafe = false;
    const fakeClient = {
      uploadApplicationAssetStream: async () => ({ Code: 0, Data: null, Msg: 'must not upload' }),
      finalizeApplicationStreamPublish: async () => ({
        Code: 0,
        Data: explicitRetrySafe ? { RetrySafe: true } : null,
        Msg: 'expected version mismatch',
      }),
      probeMicroAppEntry: async () => ({ ok: false, status: 503, url: 'https://example.test/index.html' }),
    } as unknown as MicroiClient;
    const input = {
      appIdOrKey: 'retry-contract-app',
      versionNo: 'v1.0.0',
      directory: root,
      publishMode: 'finalize' as const,
      expectedCurrentVersion: 4,
      expectedAppVersion: 'v0.9.0',
      confirmExecution: 'retry-contract-app',
    };

    const rejected = parseToolJson(await runApplicationDirectoryStreamPublish(fakeClient, input));
    assert.equal(rejected.retrySafe, false);
    explicitRetrySafe = true;
    const allowed = parseToolJson(await runApplicationDirectoryStreamPublish(fakeClient, input));
    assert.equal(allowed.retrySafe, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('default stage-and-finalize mode validates request evidence and exposes the unified response contract', async () => {
  const root = createTempDirectory();
  try {
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><html><head></head><body>combined</body></html>');
    const uploadRequestIds: string[] = [];
    let finalizeInput: Record<string, unknown> | undefined;
    const fakeClient = {
      uploadApplicationAssetStream: async (input: Parameters<MicroiClient['uploadApplicationAssetStream']>[0]) => {
        uploadRequestIds.push(input.RequestId);
        return {
          Code: 1,
          Data: {
            RequestId: input.RequestId,
            VersionNo: 'v1.0.0',
            Path: input.RelativePath,
            Sha256: input.ExpectedSha256,
            Size: fs.statSync(input.FilePath).size,
            Idempotent: false,
            StablePromoted: false,
          },
          Msg: '',
        };
      },
      finalizeApplicationStreamPublish: async (input: Record<string, unknown>) => {
        finalizeInput = input;
        const assets = input.Assets as Array<Record<string, unknown>>;
        return {
          Code: 1,
          Data: {
            AppKey: 'combined-app',
            RequestId: input.RequestId,
            VersionNo: 'v1.0.0',
            EntryPath: input.EntryPath,
            DeliveryBatchId: input.DeliveryBatchId,
            RuntimeManifestHash: input.RuntimeManifestHash,
            AssetCount: assets.length,
            TotalSize: assets.reduce((sum, asset) => sum + Number(asset.Size), 0),
            ExpectedCurrentVersion: input.ExpectedCurrentVersion,
            ExpectedAppVersion: input.ExpectedAppVersion,
            PublishStatus: 'Published',
            VerificationStatus: 'Verified',
            StablePromoted: true,
          },
          Msg: '',
        };
      },
      probeMicroAppEntry: async () => ({ ok: true, status: 200, url: 'https://example.test/index.html' }),
    } as unknown as MicroiClient;

    const result = await runApplicationDirectoryStreamPublish(fakeClient, {
      appIdOrKey: 'combined-app',
      versionNo: 'v1.0.0',
      directory: root,
      expectedCurrentVersion: 2,
      expectedAppVersion: 'v0.9.0',
      confirmExecution: 'combined-app',
    });
    assert.equal(result.isError, undefined);
    assert.equal(uploadRequestIds.length, 1);
    assert.ok(finalizeInput);
    const payload = parseToolJson(result);
    assert.equal(payload.publishMode, 'stage-and-finalize');
    assert.equal(payload.assetCount, 1);
    assert.equal(payload.stagedCount, 1);
    assert.equal(payload.uploadedCount, 1);
    assert.equal(payload.StablePromoted, true);
    assert.equal(payload.transport, 'multipart-stream-to-hdfs');
    assert.equal(payload.jintFileBytes, 0);
    assert.equal(payload.requestId, finalizeInput?.RequestId);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a failed stage can be retried with the exact same asset request id', async () => {
  const root = createTempDirectory();
  try {
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><html><head></head><body>retry</body></html>');
    const requestIds: string[] = [];
    let failOnce = true;
    const fakeClient = {
      uploadApplicationAssetStream: async (input: Parameters<MicroiClient['uploadApplicationAssetStream']>[0]) => {
        requestIds.push(input.RequestId);
        if (failOnce) {
          failOnce = false;
          throw new Error('simulated response loss');
        }
        return {
          Code: 1,
          Data: {
            RequestId: input.RequestId,
            VersionNo: 'v1.0.0',
            Path: input.RelativePath,
            Sha256: input.ExpectedSha256,
            Size: fs.statSync(input.FilePath).size,
            Idempotent: true,
            StablePromoted: false,
          },
          Msg: '',
        };
      },
    } as unknown as MicroiClient;
    const input = {
      appIdOrKey: 'retry-app',
      versionNo: 'v1.0.0',
      directory: root,
      publishMode: 'stage' as const,
      confirmExecution: 'retry-app',
    };
    const failed = await runApplicationDirectoryStreamPublish(fakeClient, input);
    assert.equal(failed.isError, true);
    assert.equal(parseToolJson(failed).retrySafe, true);
    const recovered = await runApplicationDirectoryStreamPublish(fakeClient, input);
    assert.equal(recovered.isError, undefined);
    assert.equal(requestIds.length, 2);
    assert.equal(requestIds[0], requestIds[1]);
    assert.equal(parseToolJson(recovered).idempotentCount, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('deterministic request ids bind batch, version, path/hash and manifest', () => {
  const assetBase = {
    deliveryBatchId: 'batch-1',
    appIdOrKey: 'request-app',
    versionNo: '1.2.3',
    relativePath: 'assets/app.js',
    sha256: 'a'.repeat(64),
  };
  const firstAssetId = buildApplicationAssetRequestId(assetBase);
  assert.equal(firstAssetId, buildApplicationAssetRequestId({ ...assetBase, versionNo: 'v1.2.3' }));
  assert.notEqual(firstAssetId, buildApplicationAssetRequestId({ ...assetBase, relativePath: 'assets/other.js' }));
  assert.notEqual(firstAssetId, buildApplicationAssetRequestId({ ...assetBase, sha256: 'b'.repeat(64) }));
  const firstFinalizeId = buildApplicationFinalizeRequestId({
    deliveryBatchId: 'batch-1',
    appIdOrKey: 'request-app',
    versionNo: 'v1.2.3',
    runtimeManifestHash: 'c'.repeat(64),
  });
  const legacyExpectedId = crypto.createHash('sha256').update([
    'microi-application-finalize-v1',
    'batch-1',
    'request-app',
    'v1.2.3',
    'c'.repeat(64),
  ].join('\n')).digest('hex');
  assert.equal(firstFinalizeId, legacyExpectedId, 'omitting both preconditions must preserve the v1 request id');
  assert.notEqual(firstFinalizeId, buildApplicationFinalizeRequestId({
    deliveryBatchId: 'batch-1',
    appIdOrKey: 'request-app',
    versionNo: 'v1.2.3',
    runtimeManifestHash: 'd'.repeat(64),
  }));

  const preconditionBase = {
    deliveryBatchId: 'batch-1',
    appIdOrKey: 'request-app',
    versionNo: 'v1.2.3',
    runtimeManifestHash: 'c'.repeat(64),
    expectedCurrentVersion: 9,
    expectedAppVersion: 'v1.2.2',
  };
  const preconditionId = buildApplicationFinalizeRequestId(preconditionBase);
  assert.equal(preconditionId, buildApplicationFinalizeRequestId(preconditionBase));
  assert.notEqual(preconditionId, firstFinalizeId);
  assert.notEqual(preconditionId, buildApplicationFinalizeRequestId({ ...preconditionBase, expectedCurrentVersion: 10 }));
  assert.notEqual(preconditionId, buildApplicationFinalizeRequestId({ ...preconditionBase, expectedAppVersion: 'v1.2.1' }));
  assert.notEqual(
    buildApplicationFinalizeRequestId({ ...preconditionBase, expectedAppVersion: undefined }),
    buildApplicationFinalizeRequestId({ ...preconditionBase, expectedAppVersion: '' }),
    'omitted and explicit-empty AppVersion preconditions must use different idempotency identities',
  );
});

test('evidence mismatch fails closed before finalize', async () => {
  const root = createTempDirectory();
  try {
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><html><head></head><body>evidence</body></html>');
    let finalizeCalls = 0;
    const fakeClient = {
      uploadApplicationAssetStream: async (input: Parameters<MicroiClient['uploadApplicationAssetStream']>[0]) => ({
        Code: 1,
        Data: {
          RequestId: `${input.RequestId}-wrong`,
          VersionNo: 'v1.0.0',
          Path: input.RelativePath,
          Sha256: input.ExpectedSha256,
          Size: fs.statSync(input.FilePath).size,
          StablePromoted: false,
        },
        Msg: '',
      }),
      finalizeApplicationStreamPublish: async () => {
        finalizeCalls += 1;
        return { Code: 1, Data: {}, Msg: '' };
      },
    } as unknown as MicroiClient;
    const result = await runApplicationDirectoryStreamPublish(fakeClient, {
      appIdOrKey: 'evidence-app',
      versionNo: 'v1.0.0',
      directory: root,
      expectedCurrentVersion: 1,
      expectedAppVersion: '',
      confirmExecution: 'evidence-app',
    });
    assert.equal(result.isError, true);
    assert.equal(parseToolJson(result).evidenceMismatch, true);
    assert.equal(finalizeCalls, 0);
  } finally {
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
