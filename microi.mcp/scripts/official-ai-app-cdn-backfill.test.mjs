import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('./official-ai-app-cdn-backfill.v8.js', import.meta.url), 'utf8');
const run = new Function('V8', 'System', source);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const appId = 'APP123';
const appKey = 'sample-app';
const index = Buffer.from('<!doctype html><title>sample</title>');
const version = {
  Id: 'VER123', AppId: appId, VersionNo: 'v1.0.0', PublishProtocolVersion: 3,
  PublishState: 'Completed', ReleasePrefix: 'old/release', SourceManifestHash: '',
  AssetManifestJson: JSON.stringify([{ Path: 'index.html', Sha256: hash(index), Size: index.length }])
};
const app = {
  Id: appId, AppKey: appKey, CommittedPublishVersionId: version.Id,
  PublishProtocolVersion: 3, PublishState: 'Completed', CurrentVersion: 1,
  PreviewUrl: '/old/preview/index.html'
};

function verify(stableBytes) {
  const cache = new Map();
  const v8 = {
    Param: { AppId: appId, Action: 'Verify', ConfirmAppId: appId,
      AssetStart: 0, AssetCount: 1, OnlyAssets: 'true' },
    CurrentUser: { Level: 9999 }, OsClient: 'iTdos',
    SysConfig: { FileServer: 'https://static.itdos.com' },
    FormEngine: {
      GetFormData(table) { assert.equal(table, 'sys_microistore'); return { Code: 1, Data: app }; },
      GetTableData(table) {
        if (table === 'mci_ai_app_version') return { Code: 1, Data: [version] };
        if (table === 'mci_ai_app_file') return { Code: 1, Data: [] };
        throw new Error(table);
      }
    },
    Http: { GetResponse({ Url }) {
      const path = new URL(Url).pathname;
      if (path === '/itdos/micro-app/sample-app/v1.0.0/index.html')
        return { StatusCode: 200, RawBytes: index };
      if (path === '/itdos/micro-app/sample-app/index.html')
        return { StatusCode: 200, RawBytes: stableBytes };
      throw new Error(path);
    } },
    Method: {
      CreateZip({ Entries }) { return { Code: 1, Data: { FileByteBase64: Entries[0].FileByteBase64 } }; },
      ExtractZip({ FileByteBase64 }) {
        return { Code: 1, Data: { Entries: [{ Sha256: hash(Buffer.from(FileByteBase64, 'base64')) }] } };
      }
    },
    Cache: { Get(key) { return cache.get(key); }, Set(key, value) { cache.set(key, value); } },
    EncryptHelper: { SHA256(value) { return hash(Buffer.from(value)); } }
  };
  const system = { Convert: { ToBase64String(bytes) { return Buffer.from(bytes).toString('base64'); } } };
  return run(v8, system);
}

test('v3 version and fixed CDN bytes pass exact manifest verification', () => {
  const result = verify(index);
  assert.equal(result.Code, 1);
  assert.equal(result.Data.VerifiedPublicObjects, 2);
});

test('v3 fixed CDN bytes fail when they differ from the manifest', () => {
  const result = verify(Buffer.from('stale CDN response'));
  assert.equal(result.Code, 0);
  assert.match(result.Msg, /发布资产长度或哈希不符/);
});

test('legacy JavaScript URL dependencies are included in the historical plan', () => {
  const oldRoot = 'itdos/ai-app-publish/sample-app/versions/v1.0.0/';
  const oldIndex = Buffer.from('<script src="./assets/main.js"></script><script>new URL("./app.html",location.href)</script>');
  const oldApp = Buffer.from('<!doctype html><title>app</title>');
  const legacyVersion = {
    Id: 'VER123', AppId: appId, VersionNo: 'v1.0.0', PublishProtocolVersion: 2,
    PublishState: 'LegacyUnverified', PublishPath: oldRoot + 'index.html',
    BuildLog: JSON.stringify({
      Assets: [{ Path: 'index.html', VersionUrl:
        'https://static.itdos.com/' + oldRoot + 'index.html' }],
      AliasManifest: [{ RelativePath: 'assets/main.js', VersionPath: oldRoot + 'assets/main.js',
        LatestPath: 'itdos/ai-app-publish/sample-app/latest/assets/main.js',
        Sha256: hash(Buffer.from('main')), Size: 4 }]
    })
  };
  const legacyApp = { ...app, PublishProtocolVersion: 2,
    PublishState: 'LegacyUnverified', CommittedPublishVersionId: '',
    PreviewUrl: 'https://static.itdos.com/' + oldRoot + 'index.html' };
  const v8 = {
    Param: { AppId: appId, Action: 'Plan' }, CurrentUser: { Level: 9999 },
    OsClient: 'iTdos', SysConfig: { FileServer: 'https://static.itdos.com' },
    FormEngine: {
      GetFormData() { return { Code: 1, Data: legacyApp }; },
      GetTableData(table) {
        return { Code: 1, Data: table === 'mci_ai_app_version' ? [legacyVersion] : [] };
      }
    },
    Http: { GetResponse({ Url }) {
      const path = new URL(Url).pathname;
      if (path.endsWith('/index.html')) return { StatusCode: 200, RawBytes: oldIndex };
      if (path.endsWith('/app.html')) return { StatusCode: 200, RawBytes: oldApp };
      if (path.endsWith('/assets/main.js')) return { StatusCode: 200, RawBytes: Buffer.from('main') };
      return { StatusCode: 404 };
    } },
    Method: {
      CreateZip({ Entries }) { return { Code: 1, Data: { FileByteBase64: Entries[0].FileByteBase64 } }; },
      ExtractZip({ FileByteBase64 }) {
        return { Code: 1, Data: { Entries: [{ Sha256: hash(Buffer.from(FileByteBase64, 'base64')) }] } };
      }
    },
    EncryptHelper: { SHA256(value) { return hash(Buffer.from(value)); } }
  };
  const system = { Convert: { ToBase64String(bytes) { return Buffer.from(bytes).toString('base64'); } },
    Text: { Encoding: { UTF8: { GetString(bytes) { return Buffer.from(bytes).toString('utf8'); } } } } };
  const result = run(v8, system);
  assert.equal(result.Code, 1);
  assert.equal(result.Data.MigratableAssetCount, 3);
  legacyVersion.BuildLog = '{}';
  const indexOnlyResult = run(v8, system);
  assert.equal(indexOnlyResult.Code, 1);
  assert.equal(indexOnlyResult.Data.MigratableAssetCount, 3);
});
