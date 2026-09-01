import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type {
  ApiResponse,
  MicroServiceSourceFinalizeRequest,
  MicroServiceSourceStageRequest,
} from './microi-client.js';
import {
  buildLocalMicroServiceSourceManifest,
  buildMicroServiceSourceDeliveryBatchId,
  runMicroServiceSourceSync,
  type LocalMicroServiceSourceManifest,
  type MicroServiceSourceSyncClient,
} from './server.js';

const OLD_SOURCE_HASH = 'a'.repeat(64);

function withProject(
  run: (directory: string, manifest: LocalMicroServiceSourceManifest) => Promise<void>,
): Promise<void> {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'microi-source-stream-'));
  fs.mkdirSync(path.join(directory, 'src'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'package.json'), '{"private":true}\n', 'utf8');
  fs.writeFileSync(path.join(directory, 'src', 'App.vue'), '<template>stream</template>\n', 'utf8');
  return buildLocalMicroServiceSourceManifest(directory)
    .then(manifest => run(directory, manifest))
    .finally(() => fs.rmSync(directory, { recursive: true, force: true }));
}

function contextResponse(input: {
  appVersion?: string | null;
  currentVersion?: number;
  sourceManifestHash?: string | null;
  files?: Array<Record<string, unknown>>;
  stream?: boolean;
} = {}): ApiResponse {
  return {
    Code: 1,
    Msg: '',
    Data: {
      Application: {
        Id: 'app-id',
        AppKey: 'demo-source',
        AppVersion: input.appVersion === undefined ? 'v1.0.0' : input.appVersion,
        CurrentVersion: input.currentVersion ?? 4,
      },
      SourceManifestHash: input.sourceManifestHash === undefined
        ? OLD_SOURCE_HASH
        : input.sourceManifestHash,
      Files: input.files || [],
      Capabilities: input.stream === false ? {} : {
        SourceStreamPublish: true,
        SourceStreamProtocolVersion: 1,
      },
    },
  };
}

function activeContext(manifest: LocalMicroServiceSourceManifest): ApiResponse {
  return contextResponse({
    sourceManifestHash: manifest.manifestHash,
    files: manifest.files.map(file => ({
      FilePath: file.relativePath,
      ContentHash: file.sha256,
      Size: file.size,
      StorageScope: 'Private',
    })),
  });
}

function successfulStage(data: MicroServiceSourceStageRequest): ApiResponse {
  return {
    Code: 1,
    Msg: '',
    Data: {
      AppId: 'app-id',
      AppKey: data.AppIdOrKey,
      DeliveryBatchId: data.DeliveryBatchId,
      RelativePath: data.RelativePath,
      Sha256: data.ExpectedSha256,
      Size: data.ExpectedSize,
      SourceReadbackVerified: true,
    },
  };
}

function resultJson(result: Awaited<ReturnType<typeof runMicroServiceSourceSync>>): Record<string, unknown> {
  const text = result.content.find(item => item.type === 'text');
  assert.ok(text && text.type === 'text');
  return JSON.parse(text.text) as Record<string, unknown>;
}

function resultText(result: Awaited<ReturnType<typeof runMicroServiceSourceSync>>): string {
  const text = result.content.find(item => item.type === 'text');
  assert.ok(text && text.type === 'text');
  return text.text;
}

test('source stream stages raw local paths under one batch and finalizes with all three CAS values', async () => {
  await withProject(async (directory, manifest) => {
    const stages: MicroServiceSourceStageRequest[] = [];
    let finalizeRequest: MicroServiceSourceFinalizeRequest | undefined;
    let finalized = false;
    const client: MicroServiceSourceSyncClient = {
      async getApplicationContext() {
        return finalized ? activeContext(manifest) : contextResponse();
      },
      async stageMicroServiceSourceFile(data) {
        stages.push(data);
        assert.equal(Object.prototype.hasOwnProperty.call(data, 'FileByteBase64'), false);
        assert.equal(fs.readFileSync(data.FilePath).byteLength, data.ExpectedSize);
        return successfulStage(data);
      },
      async finalizeMicroServiceSourceManifest(data) {
        finalizeRequest = data;
        finalized = true;
        return {
          Code: 1,
          Msg: '',
          Data: {
            AppId: 'app-id',
            AppKey: 'demo-source',
            DeliveryBatchId: data.DeliveryBatchId,
            FileCount: data.Manifest.length,
            TotalSize: data.Manifest.reduce((sum, file) => sum + file.Size, 0),
            SourceManifestHash: data.SourceManifestHash,
            SourceReadbackVerified: true,
          },
        };
      },
      async syncMicroServiceSource() {
        throw new Error('legacy path must not run');
      },
    };

    const result = await runMicroServiceSourceSync(client, {
      microService: { MsKey: 'demo-source', MsName: 'Demo' },
      directory,
      confirmExecution: 'SYNC',
    });
    assert.equal(result.isError, undefined);
    assert.equal(stages.length, manifest.files.length);
    assert.equal(new Set(stages.map(item => item.DeliveryBatchId)).size, 1);
    assert.equal(
      stages[0]?.DeliveryBatchId,
      buildMicroServiceSourceDeliveryBatchId('demo-source', manifest.manifestHash),
    );
    assert.equal(finalizeRequest?.ExpectedCurrentVersion, 4);
    assert.equal(finalizeRequest?.ExpectedAppVersion, 'v1.0.0');
    assert.equal(finalizeRequest?.ExpectedSourceManifestHash, OLD_SOURCE_HASH);
    assert.equal(finalizeRequest?.ReplacePrivateSourceOnly, true);
    assert.equal(finalizeRequest?.SourceManifestHash, manifest.manifestHash);
    assert.deepEqual(
      finalizeRequest?.Manifest.map(item => item.Path),
      manifest.files.map(item => item.relativePath),
    );
    const evidence = resultJson(result);
    assert.equal(evidence.protocol, 'private-source-stream-v1');
    assert.equal(evidence.SourceReadbackVerified, true);
  });
});

test('dropped stage response performs context readback then exactly replays the same idempotent unit', async () => {
  await withProject(async (directory, manifest) => {
    const stages: MicroServiceSourceStageRequest[] = [];
    let first = true;
    let finalized = false;
    let contextReads = 0;
    const client: MicroServiceSourceSyncClient = {
      async getApplicationContext() {
        contextReads += 1;
        return finalized ? activeContext(manifest) : contextResponse();
      },
      async stageMicroServiceSourceFile(data) {
        stages.push(data);
        if (first) {
          first = false;
          throw new Error('simulated EPIPE after server may have staged bytes');
        }
        return successfulStage(data);
      },
      async finalizeMicroServiceSourceManifest(data) {
        finalized = true;
        return {
          Code: 1,
          Msg: '',
          Data: {
            DeliveryBatchId: data.DeliveryBatchId,
            SourceManifestHash: data.SourceManifestHash,
            FileCount: data.Manifest.length,
            TotalSize: data.Manifest.reduce((sum, file) => sum + file.Size, 0),
            SourceReadbackVerified: true,
          },
        };
      },
      async syncMicroServiceSource() { throw new Error('legacy path must not run'); },
    };
    const result = await runMicroServiceSourceSync(client, {
      microService: { MsKey: 'demo-source' },
      directory,
      confirmExecution: 'SYNC',
    });
    assert.equal(result.isError, undefined);
    assert.ok(contextReads >= 4);
    assert.equal(stages[0]?.DeliveryBatchId, stages[1]?.DeliveryBatchId);
    assert.equal(stages[0]?.RelativePath, stages[1]?.RelativePath);
    assert.equal(stages[0]?.ExpectedSha256, stages[1]?.ExpectedSha256);
    assert.equal(resultJson(result).StageRetryCount, 1);
  });
});

test('dropped finalize response is recovered only from an exact active source readback', async () => {
  await withProject(async (directory, manifest) => {
    let finalized = false;
    let finalizeCalls = 0;
    const client: MicroServiceSourceSyncClient = {
      async getApplicationContext() {
        return finalized ? activeContext(manifest) : contextResponse();
      },
      async stageMicroServiceSourceFile(data) { return successfulStage(data); },
      async finalizeMicroServiceSourceManifest() {
        finalizeCalls += 1;
        finalized = true;
        throw new Error('simulated connection reset after commit');
      },
      async syncMicroServiceSource() { throw new Error('legacy path must not run'); },
    };
    const result = await runMicroServiceSourceSync(client, {
      microService: { MsKey: 'demo-source' },
      directory,
      confirmExecution: 'SYNC',
    });
    assert.equal(result.isError, undefined);
    assert.equal(finalizeCalls, 1, 'finalize must never be blindly replayed');
    assert.equal(resultJson(result).RecoveredAfterFinalizeTransportError, true);
  });
});

test('CAS baseline drift before finalize fails closed without calling finalize', async () => {
  await withProject(async (directory) => {
    let contextReads = 0;
    let finalizeCalls = 0;
    const client: MicroServiceSourceSyncClient = {
      async getApplicationContext() {
        contextReads += 1;
        return contextReads === 1
          ? contextResponse()
          : contextResponse({ currentVersion: 5, sourceManifestHash: 'b'.repeat(64) });
      },
      async stageMicroServiceSourceFile(data) { return successfulStage(data); },
      async finalizeMicroServiceSourceManifest() {
        finalizeCalls += 1;
        throw new Error('must not run');
      },
      async syncMicroServiceSource() { throw new Error('legacy path must not run'); },
    };
    const result = await runMicroServiceSourceSync(client, {
      microService: { MsKey: 'demo-source' },
      directory,
      confirmExecution: 'SYNC',
    });
    assert.equal(result.isError, true);
    assert.match(resultText(result), /基线漂移/u);
    assert.equal(finalizeCalls, 0);
  });
});

test('old server falls back only for a bounded source directory', async () => {
  await withProject(async (directory, manifest) => {
    let legacyPayload: Record<string, unknown> | undefined;
    const client: MicroServiceSourceSyncClient = {
      async getApplicationContext() { return contextResponse({ stream: false }); },
      async stageMicroServiceSourceFile() { throw new Error('stream path must not run'); },
      async finalizeMicroServiceSourceManifest() { throw new Error('stream path must not run'); },
      async syncMicroServiceSource(data) {
        legacyPayload = data;
        return {
          Code: 1,
          Msg: '',
          Data: {
            FileCount: manifest.files.length,
            TotalSize: manifest.totalSize,
            SourceManifestHash: manifest.manifestHash,
          },
        };
      },
    };
    const result = await runMicroServiceSourceSync(client, {
      microService: { MsKey: 'demo-source' },
      directory,
      confirmExecution: 'SYNC',
    });
    assert.equal(result.isError, undefined);
    assert.equal(resultJson(result).protocol, 'legacy-bounded-json');
    assert.equal(legacyPayload?.Replace, false);
    assert.equal(legacyPayload?.ReplacePrivateSourceOnly, true);
    const files = legacyPayload?.sourceFiles as Array<Record<string, unknown>>;
    assert.equal(files.length, manifest.files.length);
    assert.ok(files.every(file => typeof file.FileByteBase64 === 'string'));
  });
});

test('old Code=1 context without CurrentVersion remains eligible for bounded legacy fallback', async () => {
  await withProject(async (directory, manifest) => {
    let legacyCalls = 0;
    const client: MicroServiceSourceSyncClient = {
      async getApplicationContext() {
        return {
          Code: 1,
          Msg: '',
          Data: {
            Application: { Id: 'old-app', AppKey: 'demo-source', AppVersion: 'v0.9.0' },
            Files: [],
            SourceManifestHash: OLD_SOURCE_HASH,
          },
        };
      },
      async stageMicroServiceSourceFile() { throw new Error('stream path must not run'); },
      async finalizeMicroServiceSourceManifest() { throw new Error('stream path must not run'); },
      async syncMicroServiceSource() {
        legacyCalls += 1;
        return {
          Code: 1,
          Msg: '',
          Data: {
            FileCount: manifest.files.length,
            TotalSize: manifest.totalSize,
            SourceManifestHash: manifest.manifestHash,
          },
        };
      },
    };
    const result = await runMicroServiceSourceSync(client, {
      microService: { MsKey: 'demo-source' },
      directory,
      confirmExecution: 'SYNC',
    });
    assert.equal(result.isError, undefined);
    assert.equal(legacyCalls, 1);
    assert.equal(resultJson(result).protocol, 'legacy-bounded-json');
  });
});

test('context failure and missing application fail closed before any legacy write', async () => {
  await withProject(async (directory) => {
    for (const response of [
      { Code: 0, Msg: 'database unavailable', Data: null },
      { Code: 2, Msg: '在线应用不存在', Data: null },
    ] satisfies ApiResponse[]) {
      let legacyCalls = 0;
      const client: MicroServiceSourceSyncClient = {
        async getApplicationContext() { return response; },
        async stageMicroServiceSourceFile() { throw new Error('stream path must not run'); },
        async finalizeMicroServiceSourceManifest() { throw new Error('stream path must not run'); },
        async syncMicroServiceSource() {
          legacyCalls += 1;
          throw new Error('legacy write must not run');
        },
      };
      const result = await runMicroServiceSourceSync(client, {
        microService: { MsKey: 'demo-source' },
        directory,
        confirmExecution: 'SYNC',
      });
      assert.equal(result.isError, true);
      assert.equal(legacyCalls, 0);
      assert.match(resultText(result), response.Code === 2 ? /microi_create_microservice/u : /拒绝 legacy 写入/u);
    }
  });
});

test('legacy inline Base64 rejects invalid, non-canonical and oversized encodings before write', async () => {
  const maxEncodedCharacters = 4 * Math.ceil((8 * 1024 * 1024) / 3);
  const invalidValues = [
    '%%%%',
    'YR==',
    'A'.repeat(maxEncodedCharacters + 4),
  ];
  for (const value of invalidValues) {
    let legacyCalls = 0;
    const client: MicroServiceSourceSyncClient = {
      async getApplicationContext() { return contextResponse({ stream: false }); },
      async stageMicroServiceSourceFile() { throw new Error('stream path must not run'); },
      async finalizeMicroServiceSourceManifest() { throw new Error('stream path must not run'); },
      async syncMicroServiceSource() {
        legacyCalls += 1;
        throw new Error('legacy write must not run');
      },
    };
    const result = await runMicroServiceSourceSync(client, {
      microService: { MsKey: 'demo-source' },
      sourceFiles: [{ Path: 'src/App.vue', FileByteBase64: value }],
      confirmExecution: 'SYNC',
    });
    assert.equal(result.isError, true);
    assert.equal(legacyCalls, 0);
    assert.match(resultText(result), /Base64/u);
  }
});

test('dropped legacy response is recovered from an exact active source readback without replay', async () => {
  await withProject(async (directory, manifest) => {
    let legacyCalls = 0;
    let committed = false;
    const client: MicroServiceSourceSyncClient = {
      async getApplicationContext() {
        return committed ? activeContext(manifest) : contextResponse({ stream: false });
      },
      async stageMicroServiceSourceFile() { throw new Error('stream path must not run'); },
      async finalizeMicroServiceSourceManifest() { throw new Error('stream path must not run'); },
      async syncMicroServiceSource() {
        legacyCalls += 1;
        committed = true;
        throw new Error('simulated EPIPE after legacy commit');
      },
    };
    const result = await runMicroServiceSourceSync(client, {
      microService: { MsKey: 'demo-source' },
      directory,
      confirmExecution: 'SYNC',
    });
    assert.equal(result.isError, undefined);
    assert.equal(legacyCalls, 1, 'legacy whole-request sync must never be blindly replayed');
    assert.equal(resultJson(result).RecoveredAfterLegacyTransportError, true);
  });
});

test('dropped legacy response fails closed when active source readback is not exact', async () => {
  await withProject(async (directory) => {
    let legacyCalls = 0;
    const client: MicroServiceSourceSyncClient = {
      async getApplicationContext() { return contextResponse({ stream: false }); },
      async stageMicroServiceSourceFile() { throw new Error('stream path must not run'); },
      async finalizeMicroServiceSourceManifest() { throw new Error('stream path must not run'); },
      async syncMicroServiceSource() {
        legacyCalls += 1;
        throw new Error('simulated EPIPE before or after legacy commit');
      },
    };
    const result = await runMicroServiceSourceSync(client, {
      microService: { MsKey: 'demo-source' },
      directory,
      confirmExecution: 'SYNC',
    });
    assert.equal(result.isError, true);
    assert.equal(legacyCalls, 1, 'unknown legacy result must not be replayed');
    assert.match(resultText(result), /已停止且不会盲目重放/u);
  });
});

test('delivery batch id is deterministic, fixed length and source-manifest specific', () => {
  const first = buildMicroServiceSourceDeliveryBatchId('demo', 'a'.repeat(64));
  const replay = buildMicroServiceSourceDeliveryBatchId('demo', 'a'.repeat(64));
  const changed = buildMicroServiceSourceDeliveryBatchId('demo', 'b'.repeat(64));
  assert.equal(first, replay);
  assert.notEqual(first, changed);
  assert.equal(first.length, 50);
  assert.match(first, /^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$/u);
  assert.match(crypto.createHash('sha256').update(first).digest('hex'), /^[a-f0-9]{64}$/u);
});
