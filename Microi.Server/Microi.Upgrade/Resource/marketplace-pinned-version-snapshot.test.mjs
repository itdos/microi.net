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
const executeModel = new Function('V8', modelSource);

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

function execute(params, { current = packageRow('v7.5.18'), history = [], exact = {} } = {}) {
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
