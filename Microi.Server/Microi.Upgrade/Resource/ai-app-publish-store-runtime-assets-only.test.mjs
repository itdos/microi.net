import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

// 可对实际三方合成候选或保存的旧正文重放；不访问远端，也不替换被测源码。
const source = await readFile(process.env.MICROI_RUNTIME_ONLY_PUBLISHER
  || new URL('./ai-app-publish-store.js', import.meta.url), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const resourceNames = ['DDLStatements', 'PhysicalColumns', 'DiyTables', 'DiyFields',
  'DataSets', 'SysMenus', 'WfFlowDesigns', 'WfNodes', 'WfLines', 'SysApiEngines', 'ScheduleJobs'];

export function runRuntimePublisher(overrides = {}, sourceText = source) {
  const hash = 'a'.repeat(64), fingerprint = 'b'.repeat(64);
  const path = '/itdos/micro-app/test-web/index.html';
  const app = { Id: 'app-id', AppId: 'test-web', AppKey: 'test-web', Name: '测试应用',
    ApplicationType: 'Web', PublisherType: '官方应用', AppVersion: 'v1.2.0', CurrentVersion: 4,
    IsPublic: 1, IsApprove: 1, PublishState: 'Completed', PublishFence: '4', PublishRowVersion: '4',
    CommittedPublishVersionId: 'version-id', CommittedRuntimeManifestHash: hash, PublicPublishPath: path,
    SelectMenu: '[]', SelectTable: '[]', SelectApiEngine: '[]', SelectData: '[]',
    AppPakcet: JSON.stringify({ ScheduleJobs: [{ JobName: 'historical-job' }] }), ...overrides.app };
  const version = { Id: 'version-id', AppId: app.Id, VersionNo: 'v1.2.0', RowVersion: '6',
    PublishState: 'Completed', RuntimeManifestHash: hash, RequestId: 'request-id',
    RequestFingerprint: fingerprint, RouteSnapshotJson: '[]', RouteSnapshotHash: sha('[]'),
    EntryPath: 'index.html', ...overrides.version };
  const proof = { VersionId: version.Id, RuntimeManifestHash: hash, PublishFence: '4',
    PublishRowVersion: '4', VersionRowVersion: '6', PublishState: 'Completed',
    StableResolverPath: '/micro-app/v3/tenants/itdos/kinds/runtime/apps/test-web/assets/index.html',
    CdnPreviewPath: path, RequestId: 'request-id', RequestFingerprint: fingerprint, ...overrides.proof };
  const parameters = { Action: 'InspectResourceSnapshot', ProtocolVersion: 3, RuntimeAssetsOnly: true,
    AppId: app.Id, AppKey: app.AppKey, AppVersion: 'v1.2.0', IncludeSource: false,
    MenuIds: [], TableIds: [], ApiEngineKeys: [], FlowIds: [], DataSelections: [], ScheduleJobNames: [],
    SelectMenu: [], SelectTable: [], SelectApiEngine: [], SelectData: {},
    Routes: [], RouteSnapshotJson: '[]', RouteSnapshotHash: sha('[]'),
    SharedPublicRuntime: { EntryUrl: 'https://static.example.test/itdos/micro-app/test-web/v1.2.0/index.html',
      BaseUrl: 'https://static.example.test/itdos/micro-app/test-web/v1.2.0', ManifestHash: hash, TotalSize: 50 },
    CommittedProof: proof, ...overrides.parameters };
  const calls = [], writes = [];
  const coreNames = ['sys_microistore', 'sys_microistore_changelog', 'mci_ai_app_file',
    'mci_ai_app_version', 'sys_microiservice', 'sys_microiservice_page'];
  const context = {
    DateNow: () => '2026-10-03 07:21:44',
    V8: { OsClient: 'iTdos', Param: parameters, CurrentUser: { Id: 'admin', Level: 9999, Name: '管理员' },
      EncryptHelper: { Sha256Hex: value => sha(String(value)) },
      FormEngine: {
        GetFormData(table, query) {
          calls.push({ table, query });
          if (table === 'sys_microistore') return { Code: 1, Data: app };
          if (table === 'sys_microistore_changelog') return { Code: 1, Data: { Id: 'log-id',
            StoreId: app.Id, OsClient: 'iTdos', Version: 'v1.2.0', Title: '测试发行',
            ChangeType: 'Feature', Content: '验证资源边界', ReleaseTime: '2026-10-03 07:00:00' } };
          throw new Error('unexpected read ' + table);
        },
        GetTableData(table, query) {
          calls.push({ table, query });
          if (table === 'mci_ai_app_version') return { Code: 1, Data: [version] };
          if (table === 'diy_table') return { Code: 1, Data: coreNames.map((Name, i) => ({ Id: 't' + i, Name })) };
          if (table === 'diy_field') return { Code: 1, Data: coreNames.map((Name, i) => ({ Id: 'f' + i, TableId: 't' + i, Name: 'Id' })) };
          if (table === 'diy_schedule_job') return { Code: 1, Data: [{ Id: 'job', JobName: 'historical-job', ApiEngineKey: 'historical-engine', Cron: '0 0 0 * * ?' }] };
          if (table === 'sys_apiengine') return { Code: 1, Data: [{ ApiEngineKey: 'historical-engine' }] };
          throw new Error('unexpected table read ' + table);
        },
        AddFormData(...args) { writes.push(args); throw new Error('Inspect must not write'); },
        UptFormData(...args) { writes.push(args); throw new Error('Inspect must not write'); },
        UptFormDataByWhere(...args) { writes.push(args); throw new Error('CAS rejection must not write'); },
      },
      Method: {},
      ApiEngine: { Run(key) { calls.push({ engine: key }); throw new Error('unexpected selected export ' + key); } },
    },
  };
  const result = vm.runInNewContext('(function(){\n' + sourceText + '\n})()', context, { timeout: 2000 });
  return { result, calls, writes };
}

test('RuntimeAssetsOnly full publisher exports eleven empty arrays without core reads or historical jobs', () => {
  const { result, calls, writes } = runRuntimePublisher();
  assert.equal(result.Code, 1, result.Msg);
  const resources = result.Data.ResourceSnapshot.Resources;
  for (const name of resourceNames) assert.equal(resources[name].length, 0, name + ' must be empty');
  assert.equal(calls.some(c => ['diy_table', 'diy_field', 'diy_schedule_job'].includes(c.table)), false);
  assert.equal(calls.some(c => c.engine), false);
  assert.equal(writes.length, 0);
  assert.equal(sha(result.Data.ResourceSnapshotCanonicalJson), result.Data.ResourceSnapshotHash);
});

test('RuntimeAssetsOnly omission and false retain six core tables and the original historical job behavior', () => {
  for (const flag of [undefined, false]) {
    const { result, calls } = runRuntimePublisher({ app: { AppPakcet: '{}' }, parameters: { RuntimeAssetsOnly: flag } });
    assert.equal(result.Code, 1, result.Msg);
    assert.equal(result.Data.ResourceSnapshot.Resources.DiyTables.length, 6);
    assert.equal(result.Data.ResourceSnapshot.Resources.DDLStatements.length, 6);
    assert.equal(result.Data.ResourceSnapshot.Resources.ScheduleJobs.length, 0);
    assert.equal(calls.some(c => c.table === 'diy_table'), true);
    assert.throws(() => runRuntimePublisher({ parameters: { RuntimeAssetsOnly: flag } }),
      /定时任务引用的接口引擎未包含/);
  }
});

test('RuntimeAssetsOnly rejects all explicit resource selection aliases, including malformed and object values', () => {
  for (const field of ['MenuIds', 'SelectMenu', 'TableIds', 'SelectTable', 'ApiEngineKeys',
    'SelectApiEngine', 'ApiEngineRemovalKeys', 'FlowIds', 'ScheduleJobNames', 'JobNames',
    'DataSelections', 'DataSets', 'SelectData', 'Pages', 'MenuContract', 'ResourcePolicies', 'ApiEnginePolicies']) {
    for (const value of [['resource'], '["resource"]', { Resource: 'resource' },
      { length: 0, Resource: 'resource' }, 'not-json']) {
      const { result, writes } = runRuntimePublisher({ parameters: { [field]: value } });
      assert.equal(result.Code, 0, field);
      assert.match(result.Msg, /RuntimeAssetsOnly/);
      assert.equal(writes.length, 0);
    }
  }
});

test('RuntimeAssetsOnly rejects historical selections even when current explicit arrays are empty', () => {
  for (const field of ['SelectMenu', 'SelectTable', 'SelectApiEngine', 'SelectData']) {
    const { result } = runRuntimePublisher({ app: { [field]: '[{"Id":"previous-resource"}]' } });
    assert.equal(result.Code, 0);
    assert.match(result.Msg, /非空历史资源选择/);
  }
});

test('RuntimeAssetsOnly requires Web, v3, explicit source exclusion and verified shared runtime', () => {
  const cases = [
    { app: { ApplicationType: 'UniApp' } },
    { parameters: { ProtocolVersion: undefined, Action: 'Package' } },
    { parameters: { IncludeSource: true } },
    { parameters: { IncludeSource: undefined } },
    { parameters: { SharedPublicRuntime: null } },
    { parameters: { DatabaseOnlyBuild: true } },
    { parameters: { SharedPublicRuntime: { EntryUrl: 'http://unsafe.test/v1.2.0/index.html', ManifestHash: 'a'.repeat(64) } } },
  ];
  for (const value of cases) {
    const { result, writes } = runRuntimePublisher(value);
    assert.equal(result.Code, 0, JSON.stringify(value));
    assert.equal(writes.length, 0);
  }
});

test('RuntimeAssetsOnly cannot bypass committed pointer, version, request, route or manifest verification', () => {
  for (const value of [
    { app: { PublishFence: '5' } }, { app: { CommittedPublishVersionId: 'new-version' } },
    { version: { RowVersion: '7' } }, { version: { RequestFingerprint: 'c'.repeat(64) } },
    { version: { RouteSnapshotHash: 'd'.repeat(64) } },
    { parameters: { SharedPublicRuntime: { EntryUrl: 'https://static.example.test/v1.2.0/index.html', ManifestHash: 'd'.repeat(64) } } },
  ]) {
    const { result, writes } = runRuntimePublisher(value);
    assert.equal(result.Code, 0);
    assert.equal(writes.length, 0);
  }
});

test('RuntimeAssetsOnly still rejects missing or drifted resource snapshot CAS before any write', () => {
  for (const ExpectedResourceSnapshotHash of [undefined, 'c'.repeat(64)]) {
    const { result, writes } = runRuntimePublisher({ parameters: { Action: 'Publish', ExpectedResourceSnapshotHash } });
    assert.equal(result.Code, 0);
    assert.match(result.Msg, /ExpectedResourceSnapshotHash|资源快照已漂移/);
    assert.equal(writes.length, 0);
  }
});

test('RuntimeAssetsOnly rejects hidden prepared menu bindings and archives', () => {
  const prepared = { AppId: 'app-id', AppKey: 'test-web', PackageVersion: 'v1.2.0', SharedPublicRuntimeOnly: true };
  for (const value of [{ MenuContract: { MenuIds: ['hidden-menu'] } },
    { SourceZip: { StorageScope: 'HdfsPrivate', Limit: true } },
    { BuildZip: { StorageScope: 'HdfsPublic', Limit: false } }]) {
    const { result, writes } = runRuntimePublisher({ parameters: { PreparedAssets: [{ ...prepared, ...value }] } });
    assert.equal(result.Code, 0);
    assert.equal(writes.length, 0);
  }
});
