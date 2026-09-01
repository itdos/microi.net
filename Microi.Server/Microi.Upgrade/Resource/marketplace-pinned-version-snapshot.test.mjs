import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const modelSource = await readFile(resolve(directory, 'get-microi-store-model.js'), 'utf8');
const listSource = await readFile(resolve(directory, 'get-microi-store-list.js'), 'utf8');
const importerSource = await readFile(resolve(directory, 'import-package.js'), 'utf8');
const bulkSource = await readFile(resolve(directory, 'bulk-import-packages.js'), 'utf8');
const executeModel = new Function('V8', 'System', modelSource);

function packageRow(version, extra = {}) {
  return {
    Id: 'store-saas',
    AppId: 'app.microi.saas-engine',
    AppName: 'SaaS引擎',
    AppVersion: version,
    AppPakcet: JSON.stringify({
      PackageInfo: { AppId: 'app.microi.saas-engine', Version: version },
    }),
    IsPublic: 1,
    ApplicationType: 'Platform',
    PublisherType: '官方应用',
    ...extra,
  };
}

function execute(params, { current = packageRow('v7.5.18'), history = [], exact = {}, v8 = {} } = {}) {
  return executeModel({
    Param: { Id: 'store-saas', ...params },
    CurrentUser: { Id: 'admin' },
    Method: { GetCurrentToken: () => ({ CurrentUser: { Id: 'admin' } }) },
    FormEngine: {
      GetFormData(table, query) {
        if (table === 'sys_microistore') return { Code: 1, Data: current };
        if (table === 'mic_data_version') {
          return exact[query.Id]
            ? { Code: 1, Data: exact[query.Id] }
            : { Code: 2, Data: null };
        }
        throw new Error(`unexpected table ${table}`);
      },
      GetTableData(table) {
        assert.equal(table, 'mic_data_version');
        return { Code: 1, Data: history };
      },
    },
    ...v8,
  }, {
    Text: {
      Encoding: {
        UTF8: {
          GetByteCount: value => Buffer.byteLength(String(value || ''), 'utf8'),
          GetString: value => String(value || ''),
        },
      },
    },
  });
}

test('后台安装按计划版本选择不可变快照而不是易变当前行', () => {
  const result = execute(
    { PinCurrentVersion: true, ExpectedAppVersion: 'v7.5.17' },
    {
      history: [
        { Id: 'version-18', Version: '2.8.4', Data: JSON.stringify(packageRow('v7.5.18')) },
        { Id: 'version-17', Version: '2.8.3', Data: JSON.stringify(packageRow('v7.5.17')) },
      ],
    },
  );

  assert.equal(result.Code, 1);
  assert.equal(result.Data.AppVersion, 'v7.5.17');
  assert.equal(result.Data.StoreVersionId, 'version-17');
  assert.equal(result.Data.IsPinnedInstallSnapshot, true);
});

test('期望版本快照尚未生成时失败关闭而不退回当前包', () => {
  const result = execute(
    { PinCurrentVersion: true, ExpectedAppVersion: 'v7.5.17' },
    {
      history: [
        { Id: 'version-18', Version: '2.8.4', Data: JSON.stringify(packageRow('v7.5.18')) },
      ],
    },
  );

  assert.equal(result.Code, 0);
  assert.equal(result.Data.ErrorType, 'MARKETPLACE_VERSION_SNAPSHOT_PENDING');
  assert.match(result.Msg, /不可变安装快照尚未就绪/);
});

test('显式历史快照必须与期望应用版本一致', () => {
  const result = execute(
    {
      StoreVersionId: 'version-18',
      ExpectedAppVersion: 'v7.5.17',
    },
    {
      exact: {
        'version-18': {
          Id: 'version-18',
          Version: '2.8.4',
          Data: JSON.stringify(packageRow('v7.5.18')),
        },
      },
    },
  );

  assert.equal(result.Code, 0);
  assert.equal(result.Data.ErrorType, 'MARKETPLACE_VERSION_SNAPSHOT_MISMATCH');
  assert.equal(result.Data.ExpectedAppVersion, 'v7.5.17');
  assert.equal(result.Data.ActualAppVersion, 'v7.5.18');
});

test('新版导入器显式获取 HDFS 指针，旧导入器仅在响应期获得校验后的兼容包正文', () => {
  const packageText = '{"PackageInfo":{"Version":"v7.5.50"}}';
  const expectedSha = 'a'.repeat(64);
  const pointerRow = packageRow('v7.5.50', {
    AppPakcet: '',
    PackageHdfsPath: '/itdos/microi-store/packages/store-saas/app.json',
    PackageSha256: expectedSha,
    PackageSize: Buffer.byteLength(packageText, 'utf8'),
  });
  let downloadCount = 0;
  const v8 = {
    SysConfig: { FileServer: 'https://file.example.com' },
    Http: {
      GetResponse(request) {
        downloadCount += 1;
        assert.equal(request.Url, 'https://file.example.com/itdos/microi-store/packages/store-saas/app.json');
        return { StatusCode: 200, Content: packageText };
      },
    },
    EncryptHelper: { Sha256Hex: () => expectedSha },
  };

  const pointerResult = execute(
    { PackagePointerMode: 'HdfsV1' },
    { current: pointerRow, v8 },
  );
  assert.equal(pointerResult.Code, 1);
  assert.equal(pointerResult.Data.AppPakcet, '');
  assert.equal(pointerResult.Data.PackageDownloadUrl, 'https://file.example.com/itdos/microi-store/packages/store-saas/app.json');
  assert.equal(downloadCount, 0);

  const legacyResult = execute({}, { current: { ...pointerRow }, v8 });
  assert.equal(legacyResult.Code, 1);
  assert.equal(legacyResult.Data.AppPakcet, packageText);
  assert.equal(legacyResult.Data.LegacyPackageHydrated, 1);
  assert.equal(downloadCount, 1);
  assert.match(modelSource, /MARKETPLACE_LEGACY_IMPORTER_HDFS_BRIDGE_V1/);
  assert.match(importerSource, /PackagePointerMode:\s*'HdfsV1'/);
});

test('商城源只在响应期为当前应用的私有 ZIP 生成临时地址', () => {
  const sourcePath = '/itdos/ai-app-packages/v3/app.microi.saas-engine/v7.5.18/source/hash/source.zip';
  const current = packageRow('v7.5.18', {
    AiAppPackageManifest: JSON.stringify([{
      AppId: 'app.microi.saas-engine',
      AppKey: 'app.microi.saas-engine',
      SourceZip: {
        FilePathName: sourcePath,
        Path: sourcePath,
        Limit: true,
        StorageScope: 'HdfsPrivate',
      },
      BuildZip: {
        FilePathName: '/itdos/ai-app-packages/v3/app.microi.saas-engine/v7.5.18/build/hash/build.zip',
        Path: 'https://static.example.test/build.zip',
        Limit: false,
        StorageScope: 'HdfsPublic',
      },
    }]),
  });
  const calls = [];
  const result = execute({}, {
    current,
    v8: {
      OsClient: 'iTdos',
      Method: {
        GetPrivateFileUrl(param) {
          calls.push(param);
          return { Code: 1, Data: { Url: 'https://signed.example.test/source.zip?token=short-lived' } };
        },
      },
    },
  });

  assert.equal(result.Code, 1);
  assert.deepEqual(calls, [{ OsClient: 'iTdos', FilePathName: sourcePath, Limit: true }]);
  assert.equal(
    result.DataAppend.ApplicationAssetDownloadUrls[sourcePath],
    'https://signed.example.test/source.zip?token=short-lived',
  );
  assert.equal(result.Data.AiAppPackageManifest, current.AiAppPackageManifest, '不可变快照没有被签名 URL 污染');
});

test('旧导入器在响应包副本中获得私有 ZIP 签名地址且不可变快照不落签名', () => {
  const sourcePath = '/itdos/ai-app-packages/v3/app.microi.saas-engine/v7.5.18/source/hash/source.zip';
  const buildPath = '/itdos/ai-app-packages/v3/app.microi.saas-engine/v7.5.18/build/hash/build.zip';
  const packageAssets = {
    SourceZip: {
      FilePathName: sourcePath,
      Path: sourcePath,
      FullPath: sourcePath,
      Limit: true,
      StorageScope: 'HdfsPrivate',
    },
    BuildZip: {
      FilePathName: buildPath,
      Path: buildPath,
      FullPath: buildPath,
      Limit: false,
      StorageScope: 'HdfsPublic',
    },
  };
  const packageText = JSON.stringify({
    PackageInfo: { AppId: 'app.microi.saas-engine', Version: 'v7.5.18' },
    ApplicationBundle: {
      Application: { AppId: 'app.microi.saas-engine', AppKey: 'app.microi.saas-engine' },
      PackageAssets: JSON.stringify(packageAssets),
    },
  });
  const current = packageRow('v7.5.18', {
    AppPakcet: packageText,
    AiAppPackageManifest: JSON.stringify([{
      AppId: 'app.microi.saas-engine',
      AppKey: 'app.microi.saas-engine',
      SourceZip: packageAssets.SourceZip,
      BuildZip: packageAssets.BuildZip,
    }]),
  });
  const signedUrl = 'https://signed.example.test/source.zip?token=short-lived';
  const result = execute({}, {
    current,
    v8: {
      OsClient: 'iTdos',
      Method: {
        GetPrivateFileUrl: () => ({ Code: 1, Data: { Url: signedUrl } }),
      },
    },
  });

  assert.equal(result.Code, 1);
  assert.equal(result.Data.LegacyApplicationAssetUrlsDecorated, 1);
  const responsePackage = JSON.parse(result.Data.AppPakcet);
  const responseAssets = JSON.parse(responsePackage.ApplicationBundle.PackageAssets);
  assert.equal(responseAssets.SourceZip.FullPath, signedUrl);
  assert.equal(responseAssets.SourceZip.Url, signedUrl);
  assert.equal(responseAssets.SourceZip.FilePathName, sourcePath);
  assert.equal(responseAssets.BuildZip.FullPath, buildPath, '公有编译 ZIP 不应被私有签名桥改写');
  assert.equal(current.AppPakcet, packageText, '数据库行中的不可变包正文没有被签名 URL 污染');
  assert.equal(
    JSON.parse(JSON.parse(current.AppPakcet).ApplicationBundle.PackageAssets).SourceZip.FullPath,
    sourcePath,
  );
  assert.match(modelSource, /MARKETPLACE_LEGACY_PRIVATE_ASSET_URL_BRIDGE_V1/);
});

test('商城源拒绝为跨应用的私有 ZIP 路径签名', () => {
  const current = packageRow('v7.5.18', {
    AiAppPackageManifest: JSON.stringify([{
      AppKey: 'app.microi.saas-engine',
      SourceZip: {
        FilePathName: '/itdos/ai-app-packages/v3/another-app/v1.0.0/source/hash/source.zip',
        Limit: true,
      },
    }]),
  });
  const result = execute({}, {
    current,
    v8: {
      OsClient: 'iTdos',
      Method: { GetPrivateFileUrl: () => { throw new Error('must not sign'); } },
    },
  });
  assert.equal(result.Code, 0);
  assert.match(result.Msg, /路径不属于当前应用/);
});

test('批量计划先自举应用商城并把快照 Id 贯穿到子导入器', () => {
  assert.match(listSource, /BULK_PLATFORM_BOOTSTRAP_ORDER_V1/);
  assert.match(listSource, /app\.microi\.store/);
  assert.match(bulkSource, /BulkInstallPlan:\s*true/);
  assert.match(bulkSource, /prioritizeBootstrapPlan/);
  assert.match(bulkSource, /StoreVersionId:\s*item\.StoreVersionId/);
  assert.match(importerSource, /MARKETPLACE_PINNED_INSTALL_SNAPSHOT_V1|PinCurrentVersion/);
  assert.match(importerSource, /checkpoint\.StoreVersionId\s*=\s*checkpointStoreVersionId/);
  assert.match(importerSource, /PACKAGE_REPLAY_VERSION_GUARD_V2/);
});
