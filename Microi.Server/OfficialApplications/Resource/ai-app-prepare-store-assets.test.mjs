import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('.', import.meta.url);
const source = await readFile(new URL('ai-app-prepare-store-assets.js', root), 'utf8');
const publisher = await readFile(new URL('ai-app-publish-store.js', root), 'utf8');
const replicaSync = await readFile(new URL('application-store-replica-sync.mjs', root), 'utf8');
const packageModel = JSON.parse(await readFile(new URL('app.microi.store.json', root), 'utf8'));
const embedded = packageModel.SysApiEngines.find(item => item.ApiEngineKey === 'ai_app_prepare_store_assets');

test('prepared asset manifests bind the exact application package version', () => {
  assert.match(source, /Version: v1\.2\.0/u);
  assert.match(source, /function normalizeExactVersion\(value\)/u);
  assert.match(source, /PackageVersion: packageVersion/u);
  assert.match(source, /packageVersionOf\(option\.PackageVersion \|\| V8\.Param\.PackageVersion, app\.AppVersion\)/u);
  assert.match(source, /PackageVersion 必须是 v1\.2\.3 形式的精确语义版本/u);
});

test('publisher forwards its requested exact version to the ZIP preparer', () => {
  assert.match(
    publisher,
    /V8\.ApiEngine\.Run\('ai_app_prepare_store_assets',[\s\S]*?PackageVersion: text\(V8\.Param\.AppVersion\),[\s\S]*?PackageVersion: text\(V8\.Param\.AppVersion\)/u,
  );
});

test('standalone preparer is synchronized into the embedded marketplace package', () => {
  assert.match(replicaSync, /resourceName: 'ai-app-prepare-store-assets\.js',[\s\S]*?apiEngineKey: 'ai_app_prepare_store_assets'/u);
  assert.ok(embedded, 'embedded marketplace package lacks ai_app_prepare_store_assets');
  assert.equal(embedded.Version, 'v1.2.0');
  assert.equal(String(embedded.ApiV8Code || '').replace(/\r\n/g, '\n').trim(), source.replace(/\r\n/g, '\n').trim());
});

function executeUploadPrepared(isPublic) {
  const uploads = [];
  const execute = new Function('V8', 'System', 'DateNow', source);
  const result = execute({
    OsClient: 'iTdos',
    Param: {
      Action: 'UploadPrepared',
      AppId: 'app-1',
      PackageVersion: 'v1.2.3',
      BuildZip: { FileName: 'build.zip', FileByteBase64: 'YnVpbGQ=', Size: 5 },
      SourceZip: { FileName: 'source.zip', FileByteBase64: 'c291cmNl', Size: 6 },
    },
    CurrentUser: { Id: 'admin', Level: 9999 },
    FormEngine: {
      GetFormData: () => ({
        Code: 1,
        Data: {
          Id: 'app-1',
          AppKey: 'demo-app',
          Name: 'Demo',
          AppVersion: 'v1.2.3',
          ApplicationType: 'Web',
          IsPublic: isPublic,
        },
      }),
    },
    Method: {
      Upload(param) {
        uploads.push(param);
        const fileName = Object.keys(param.FilesByteBase64)[0];
        return {
          Code: 1,
          Data: [{
            Id: `file-${uploads.length}`,
            FileName: fileName,
            FilePathName: `/itdos/ai-app-packages/demo-app/${fileName}`,
            Size: fileName === 'source.zip' ? 6 : 5,
          }],
        };
      },
    },
    EncryptHelper: { Sha256Hex: value => `sha-${value}` },
    SysConfig: { FileServer: 'https://static.example.test' },
  }, {
    Convert: {
      FromBase64String: value => ({ Length: Buffer.from(value, 'base64').length }),
    },
  }, () => '20260901010101');
  return { result, uploads };
}

test('source ZIP is always private while build ZIP follows application visibility', () => {
  const publicApp = executeUploadPrepared(null);
  assert.equal(publicApp.result.Code, 1);
  assert.equal(publicApp.uploads[0].Limit, false, 'legacy null visibility remains public for build output');
  assert.equal(publicApp.uploads[1].Limit, true, 'source must always use private HDFS');
  assert.equal(publicApp.result.Data.Manifest[0].BuildZip.StorageScope, 'HdfsPublic');
  assert.equal(publicApp.result.Data.Manifest[0].SourceZip.StorageScope, 'HdfsPrivate');
  assert.equal(publicApp.result.Data.Manifest[0].SourceZip.FullPath, '');

  const privateApp = executeUploadPrepared(0);
  assert.equal(privateApp.uploads[0].Limit, true);
  assert.equal(privateApp.uploads[1].Limit, true);
  assert.equal(privateApp.result.Data.Manifest[0].BuildZip.StorageScope, 'HdfsPrivate');
});

test('normal applications include source by default and publisher records the storage policy', () => {
  assert.match(source, /option\.IncludeSource === undefined \|\| option\.IncludeSource === null[\s\S]*?\? true/u);
  assert.match(publisher, /includeSourceParamSupplied[\s\S]*?includeSourceParamSupplied \? boolValue\(V8\.Param\.IncludeSource, false\) : true/u);
  assert.match(publisher, /Source: includeSource \? 'PrivateHdfs' : 'NotIncluded'/u);
  assert.match(publisher, /Build: storeVisibility \? 'PublicHdfs' : 'PrivateHdfs'/u);
  assert.match(publisher, /源码 ZIP 必须保存到官方 HDFS 私有桶/u);
});
