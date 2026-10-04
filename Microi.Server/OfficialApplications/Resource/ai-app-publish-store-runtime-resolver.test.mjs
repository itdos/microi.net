import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('./ai-app-publish-store.js', import.meta.url), 'utf8');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
// Exact projection shape observed for the formally committed CRM v1.10.1 release.
// Test bytes are small; tenant, release, request fingerprint and compatibility
// StableFilePathName retain the production shape that previously failed.
const fingerprint = '665c16c064a146b6ec346d7f93de654421cc662f8a76fed6b5ea88d4c9b8f19a';
const prefix = `microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/mci-crm/releases/v1.10.1/requests/${fingerprint}/assets/`;

function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) return '';
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index++) {
    if (source[index] === '{') depth++;
    else if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

function harness() {
  const bodies = new Map([
    ['assets/index-BoqBRocP.css', Buffer.from('body{color:#123456}')],
    ['assets/index-_Klrsky_.js', Buffer.from('window.crm="verified";')],
    ['index.html', Buffer.from('<!doctype html><html><body>CRM</body></html>')],
  ]);
  const assets = [...bodies].map(([Path, bytes]) => ({
    Path, FilePathName: prefix + Path,
    StableFilePathName: `/itdos/micro-app/mci-crm/${Path}`,
    Size: bytes.length, Sha256: sha(bytes), IsEntry: Path === 'index.html',
  }));
  const app = { Id: 'crm-app', AppKey: 'mci-crm', PublishState: 'Completed',
    CommittedPublishVersionId: 'mciav-4c69925c21b0de7f9ab2cd1c6548c6',
    CommittedRuntimeManifestHash: 'a'.repeat(64) };
  const version = { Id: app.CommittedPublishVersionId, AppId: app.Id, VersionNo: 'v1.10.1',
    PublishState: 'Completed', RequestFingerprint: fingerprint,
    RuntimeManifestHash: app.CommittedRuntimeManifestHash, ReleasePrefix: prefix.slice(0, -8) };
  const manifest = { SchemaVersion: 3, Assets: structuredClone(assets),
    CommittedPublishVersionId: version.Id, RuntimeManifestHash: version.RuntimeManifestHash,
    RequestFingerprint: fingerprint };
  const runtime = { Service: { MsKey: 'mci-crm', BuildVersion: 'v1.10.1', EntryPath: 'index.html',
    AssetsJson: '', AssetManifestJson: '' } };
  const reads = [];
  const queries = [];
  let responseOverride;
  let versionRows = [version];
  const context = {
    V8: {
      OsClient: 'iTdos', SysConfig: { ApiBase: 'https://api.example.test/api/' },
      Param: { AppKey: 'untrusted-app', OsClient: 'other', ApiBase: 'https://evil.test' },
      Base64: { StringToBase64: value => Buffer.from(String(value)).toString('base64') },
      Http: { GetResponse(params) {
        reads.push(structuredClone(params));
        if (responseOverride) return responseOverride(params);
        const path = decodeURIComponent(params.Url.split('/assets/').slice(1).join('/assets/'));
        const bytes = bodies.get(path);
        assert.ok(bytes, `unexpected resolver path ${path}`);
        return { StatusCode: 200, Content: bytes.toString(), RawBytes: bytes,
          Headers: [{ Name: 'ETag', Value: `"${sha(bytes)}"` }] };
      } },
      FormEngine: { GetTableData(table, query) {
        queries.push({ table, query: structuredClone(query) });
        assert.equal(table, 'mci_ai_app_version');
        return { Code: 1, Data: versionRows };
      } },
    },
    System: { Convert: { FromBase64String: value => Buffer.from(value, 'base64'),
      ToBase64String: bytes => Buffer.from(bytes).toString('base64') } },
    readFileBase64() { throw new Error('tenant HDFS correctly refuses global v3 namespace'); },
    Buffer, String, Number, JSON, Object, isFinite, encodeURIComponent,
  };
  const names = ['text', 'isBlank', 'toArray', 'parseObject', 'normalizePath', 'normalizeExactVersion',
    'isTextFile', 'sha256RuntimeAssetBytes', 'runtimeAssetBase64MatchesManifest', 'stableApiOrigin',
    'getCommittedVersion', 'committedRuntimeAssetContext', 'committedRuntimeAssetResolverPath',
    'committedRuntimeResponseIsValid', 'readRuntimeAssetBase64', 'runtimeAssetContentType', 'getBuildAssets'];
  vm.createContext(context);
  vm.runInContext(names.map(extract).join('\n'), context);
  function run() {
    runtime.Service.AssetsJson = JSON.stringify(assets);
    runtime.Service.AssetManifestJson = JSON.stringify(manifest);
    // A later staging version must never select the immutable physical path.
    return context.getBuildAssets(app, { Id: 'new-staging', VersionNo: 'v9.0.0', PublishState: 'Staging' }, runtime);
  }
  return { app, version, manifest, runtime, assets, bodies, reads, queries, context, run,
    response(value) { responseOverride = value; }, versions(value) { versionRows = value; } };
}

test('committed CRM compatibility CDN projection resolves verified bytes through current API origin', () => {
  const h = harness();
  const result = h.run();
  assert.equal(result.length, 3);
  for (const item of result) assert.deepEqual(Buffer.from(item.FileByteBase64, 'base64'), h.bodies.get(item.Path));
  assert.equal(h.queries.length, 1);
  assert.deepEqual(h.queries[0].query._Where,
    [['Id', '=', h.app.CommittedPublishVersionId], ['AND', 'AppId', '=', h.app.Id]]);
  assert.equal(h.queries[0].query._PageSize, 2);
  assert.equal(h.reads[0].Url, 'https://api.example.test/micro-app/v3/tenants/itdos/kinds/runtime/apps/mci-crm/assets/assets/index-BoqBRocP.css');
  assert.equal(h.reads[0].RequireSsrfProtection, true);
});

test('committed global v3 text uses verified decoded gzip content and binary uses verified raw bytes', () => {
  const h = harness();
  h.response(params => {
    const path = params.Url.split('/assets/').slice(1).join('/assets/');
    const bytes = h.bodies.get(path);
    return { StatusCode: 200, Content: bytes.toString(), RawBytes: Buffer.from('gzip transport frame'),
      Headers: [{ Name: 'ETag', Value: `"${sha(bytes)}"` }] };
  });
  assert.equal(h.run().length, 3);
  const binary = Buffer.from([0, 255, 24, 132]);
  h.bodies.clear(); h.bodies.set('assets/logo.png', binary);
  h.assets.splice(0, 3, { Path: 'assets/logo.png', FilePathName: prefix + 'assets/logo.png',
    Size: binary.length, Sha256: sha(binary) });
  h.manifest.Assets = structuredClone(h.assets);
  h.response(() => ({ StatusCode: 200, Content: '', RawBytes: binary }));
  assert.deepEqual(Buffer.from(h.run()[0].FileByteBase64, 'base64'), binary);
});

test('global v3 requires exact current committed ownership, release and manifest identity', () => {
  const mutations = [
    h => { h.app.CommittedPublishVersionId = ''; },
    h => { h.app.CommittedRuntimeManifestHash = 'b'.repeat(64); },
    h => { h.app.PublishState = 'ProjectionPending'; },
    h => { h.version.PublishState = 'Staging'; },
    h => { h.version.VersionNo = 'v1.10.2'; },
    h => { h.version.AppId = 'other-app'; },
    h => { h.version.RequestFingerprint = 'b'.repeat(64); },
    h => { h.version.ReleasePrefix += '/'; },
    h => { h.manifest.CommittedPublishVersionId = 'other-version'; },
    h => { h.manifest.RuntimeManifestHash = 'b'.repeat(64); },
    h => { h.manifest.RequestFingerprint = 'b'.repeat(64); },
    h => { h.manifest.Assets[0].Sha256 = 'b'.repeat(64); },
    h => { h.runtime.Service.MsKey = 'other-app'; },
    h => { h.runtime.Service.BuildVersion = 'v9.0.0'; },
    h => h.versions([]), h => h.versions([h.version, h.version]),
  ];
  for (const mutate of mutations) {
    const h = harness(); mutate(h);
    assert.throws(() => h.run());
    assert.equal(h.reads.length, 0, mutate.toString());
  }
});

test('global v3 cannot escape current tenant/app/release/fingerprint/path or omit strong byte facts', () => {
  const mutations = [
    h => { h.assets[0].FilePathName = h.assets[0].FilePathName.replace('/itdos/', '/other/'); },
    h => { h.assets[0].FilePathName = h.assets[0].FilePathName.replace('/mci-crm/', '/other-app/'); },
    h => { h.assets[0].FilePathName = h.assets[0].FilePathName.replace('/v1.10.1/', '/v1.10.2/'); },
    h => { h.assets[0].FilePathName = h.assets[0].FilePathName.replace(fingerprint, 'b'.repeat(64)); },
    h => { h.assets[0].FilePathName += '?redirect=https://evil.test'; },
    h => { h.assets[0].Path = '../index.html'; },
    h => { h.assets[0].Path = 'assets/%2e%2e/index.html'; },
    h => { h.assets[0].Path = 'assets\\index.html'; },
    h => { h.assets[0].Path = '/index.html'; },
    h => { h.assets[0].Sha256 = ''; },
    h => { h.assets[0].Size = 0; },
  ];
  for (const mutate of mutations) {
    const h = harness(); mutate(h);
    assert.throws(() => h.run());
    assert.equal(h.reads.length, 0, mutate.toString());
  }
  const h = harness();
  h.assets[0].StableFilePathName = 'https://evil.test/other-tenant/other-app';
  assert.equal(h.run().length, 3);
  assert.ok(h.reads.every(item => item.Url.startsWith('https://api.example.test/micro-app/v3/tenants/itdos/kinds/runtime/apps/mci-crm/assets/')));
});

test('global v3 rejects non-200, redirects, false ETags, JSON errors and same-size altered bytes', () => {
  const responses = [
    bytes => ({ StatusCode: 302, Content: bytes.toString(), RawBytes: bytes }),
    bytes => ({ StatusCode: 404, Content: bytes.toString(), RawBytes: bytes }),
    bytes => ({ StatusCode: 200, Content: bytes.toString(), RawBytes: bytes,
      Headers: [{ Name: 'Location', Value: 'https://evil.test' }] }),
    bytes => ({ StatusCode: 200, Content: bytes.toString(), RawBytes: bytes,
      Headers: [{ Name: 'ETag', Value: `"${'b'.repeat(64)}"` }] }),
    bytes => ({ StatusCode: 200, Content: bytes.toString(), RawBytes: bytes,
      Headers: { Count: 1, 0: { Name: 'ETag', Value: `"${'b'.repeat(64)}"` } } }),
    () => ({ StatusCode: 200, Content: '{"Code":0,"Msg":"not found"}', RawBytes: Buffer.from('error') }),
    bytes => ({ StatusCode: 200, Content: 'x'.repeat(bytes.length), RawBytes: Buffer.alloc(bytes.length, 120) }),
  ];
  for (const response of responses) {
    const h = harness(); h.response(() => response(h.bodies.values().next().value));
    assert.throws(() => h.run());
  }
});

test('global v3 rejects stale inline bytes and duplicate committed leaf metadata', () => {
  const inline = harness();
  inline.assets[0].ContentBase64 = Buffer.from('tampered').toString('base64');
  assert.throws(() => inline.run());
  assert.equal(inline.reads.length, 0);
  const duplicate = harness();
  duplicate.manifest.Assets.push(structuredClone(duplicate.manifest.Assets[0]));
  assert.throws(() => duplicate.run());
  assert.equal(duplicate.reads.length, 0);
});

test('legacy MicroService without v3 committed fields retains its immutable tenant HDFS path', () => {
  const h = harness();
  h.app.CommittedPublishVersionId = ''; h.app.CommittedRuntimeManifestHash = '';
  h.assets.forEach(asset => { asset.FilePathName = `/itdos/micro-app/legacy/${asset.Path}`; });
  h.context.readFileBase64 = path => h.bodies.get(path.replace('/itdos/micro-app/legacy/', '')).toString('base64');
  assert.equal(h.run().length, 3);
  assert.equal(h.queries.length, 0); assert.equal(h.reads.length, 0);
});
