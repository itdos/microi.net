import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./ai-app-download-build-zip.js', import.meta.url), 'utf8');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

test('Web ZIP includes only the current v3 release and reads verified stable assets', () => {
  const files = [
    { FilePath: 'dist/index.html', FileName: 'index.html', StorageScope: 'PublicBuildStream', PublishHdfsPath: '/micro-app/v3/tenants/itdos/kinds/runtime/apps/demo/assets/index.html', HdfsPath: 'immutable/index.html', ContentHash: sha(Buffer.from('new')), Size: 3 },
    { FilePath: 'dist/index.html', FileName: 'index.html', StorageScope: 'PublicBuildStreamArchived', PublishHdfsPath: '/micro-app/v3/tenants/itdos/kinds/runtime/apps/demo/assets/index.html', HdfsPath: 'old/index.html', ContentHash: sha(Buffer.from('old')), Size: 3 },
    { FilePath: 'dist/assets/app-preview.png', FileName: 'app-preview.png', StorageScope: 'PublicBuildStream', PublishHdfsPath: '/micro-app/v3/tenants/itdos/kinds/runtime/apps/demo/assets/assets/app-preview.png', HdfsPath: 'immutable/app-preview.png', ContentHash: sha(Buffer.from('img')), Size: 3 },
    { FilePath: 'dist/assets/app-preview.png', FileName: 'app-preview.png', StorageScope: 'PublicBuildStreamArchived', PublishHdfsPath: '/micro-app/v3/tenants/itdos/kinds/runtime/apps/demo/assets/assets/app-preview.png', HdfsPath: 'old/app-preview.png', ContentHash: sha(Buffer.from('old')), Size: 3 },
  ];
  const urls = [];
  let entries = [];
  const v8 = {
    EncryptHelper: { Sha256Hex: value => sha(value) }, Param: { AppId: 'app-1' }, SysConfig: { ApiBase: 'https://api.itdos.com' }, OsClient: 'iTdos',
    FormEngine: {
      GetFormData: () => ({ Code: 1, Data: { Id: 'app-1', AppKey: 'demo', Name: 'Demo', AppType: 'Web' } }),
      GetTableData: table => ({ Code: 1, Data: table === 'mci_ai_app_version' ? [{ VersionNo: 'v1.0.5' }] : files }),
    },
    Http: { GetResponse({ Url }) {
      urls.push(Url);
      return { StatusCode: 200, RawBytes: Buffer.from(Url.endsWith('index.html') ? 'new' : 'img') };
    } },
    Method: {
      GetPrivateFileUrl: () => { throw Error('unexpected HDFS fallback'); },
      CreateZip({ Entries }) { entries = Entries; return { Code: 1, Data: { FileByteBase64: 'emlw', Size: 3, Sha256: sha(Buffer.from('zip')) } }; },
    },
  };
  const system = {
    Security: { Cryptography: { SHA256: { Create: () => ({ ComputeHash: bytes => createHash('sha256').update(bytes).digest() }) } } },
    BitConverter: { ToString: bytes => [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('-') },
    Convert: { ToBase64String: bytes => Buffer.from(bytes).toString('base64'), FromBase64String: value => Buffer.from(value, 'base64') },
  };
  const result = new Function('V8', 'System', 'DateNow', source)(v8, system, () => '2026-09-27 16:00:00');
  assert.equal(result.Code, 1);
  assert.deepEqual(entries.map(entry => entry.Path), ['index.html', 'assets/app-preview.png', 'microi-app-version.json']);
  assert.equal(urls.length, 2);
  assert.ok(urls.every(url => url.startsWith('https://api.itdos.com/micro-app/v3/')));
});
