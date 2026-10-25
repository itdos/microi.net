import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('./import-package.js', import.meta.url), 'utf8');
const normalized = source.replace(/\r\n/g, '\n');
const entryEnd = normalized.indexOf('\ntry {\n    if (scheduleJobContract.Errors.length', normalized.indexOf('var packageMenuRuntimeContract'));
assert.ok(entryEnd > 0);
const columns = [...new Set([...source.matchAll(/\['([A-Za-z_][A-Za-z0-9_]*)',/g)].map(match => match[1]))].map(ColumnName => ({ ColumnName }));
const hash = value => createHash('sha256').update(value).digest('hex');

// 执行真实导入入口到资源写入前，保留下载、物理自举和 ValidateOnly 分支。
// 所有副作用都登记；不以另写一个版本比较器代替安装器行为验证。
function run({ info = {}, backend = 'v8.6.7', download = false, validateOnly = false,
  missingColumns = false, missingReader = false, readerThrows = false, params = {}, checkpoint } = {}) {
  const writes = [], calls = [];
  const model = { PackageInfo: { AppId: 'compat-fixture', Name: '兼容性夹具', Version: 'v1.0.0', ...info },
    SysApiEngines: [], ResourcePolicies: { ApiEngines: {} } };
  const body = JSON.stringify(model);
  const V8 = { OsClient: 'compat-fixture', OsClientModel: { DbType: 'MySql' }, SysConfig: {},
    CurrentUser: { Id: 'admin', Level: 9999 }, InvokeType: 'Client',
    Param: { ...(download ? { StoreId: 'store-fixture' } : { Package: model }), ValidateOnly: validateOnly, ...params },
    Method: { NewGuid: () => 'operation-fixture', UpdateBackgroundTask: value => writes.push({ progress: value }) },
    EncryptHelper: { Sha256Hex: hash }, Cache: { Get: () => '', Set: (...args) => writes.push({ cache: args }) },
    Http: { Post: () => ({ Code: 1, Data: { Id: 'store-fixture', AppKey: 'compat-fixture', AppVersion: 'v1.0.0',
      StoreVersionId: 'immutable-fixture', PackageDownloadUrl: 'https://fixture.invalid/package.json',
      PackageSha256: hash(body), PackageSize: Buffer.byteLength(body) } }),
      GetResponse: () => ({ StatusCode: 200, Content: body }) },
    Db: { FromSql(sql) { return { AddInParameter() { return this; },
      ToArray() { return /INFORMATION_SCHEMA\.COLUMNS/.test(sql) && !missingColumns ? columns : []; },
      ExecuteNonQuery() { writes.push({ sql }); return 1; } }; } }
  };
  if (!missingReader) V8.Method.GetBackendVersion = () => {
    calls.push('GetBackendVersion'); if (readerThrows) throw new Error('private-host-detail'); return backend;
  };
  if (checkpoint) Object.assign(V8.Param, { _BackgroundTaskId: 'task-fixture', _TrustedServerInvocation: true,
    _BackgroundTaskCheckpoint: { TaskId: 'task-fixture', ...checkpoint } });
  const System = { Text: { Encoding: { UTF8: { GetByteCount: value => Buffer.byteLength(value) } } } };
  const result = vm.runInNewContext('(function(){' + normalized.slice(0, entryEnd)
    + '\nreturn {Code:1,Data:{Compatibility:typeof packageRuntimeCompatibility===\'undefined\'?null:packageRuntimeCompatibility},ReachedResources:true};})()', { V8, System }, { timeout: 1500 });
  return { result: JSON.parse(JSON.stringify(result)), writes, calls };
}

for (const download of [false, true]) for (const validateOnly of [false, true]) {
  test(`${download ? '下载包' : '直接包'} ${validateOnly ? '预检' : '正式安装'}：最低后端版本不满足时零写入`, () => {
    const value = run({ info: { ServerMinVersion: '8.6.8' }, backend: 'v8.6.7', download, validateOnly,
      missingColumns: true, checkpoint: { Phase: 'Prerequisites' } });
    assert.equal(value.result.Code, 0);
    assert.equal(value.result.Data.ErrorType, 'PACKAGE_RUNTIME_VERSION_TOO_LOW');
    assert.equal(value.result.Data.Compatibility.BackendVersion, 'v8.6.7');
    assert.deepEqual(value.writes, []);
  });
}

test('安装预检在旧库不执行物理兼容 DDL、进度或包缓存写入', () => {
  const value = run({ info: { ServerMinVersion: '8.6.7' }, validateOnly: true, download: true,
    missingColumns: true, checkpoint: { Phase: 'Prerequisites' } });
  assert.equal(value.result.Code, 1, value.result.Msg);
  assert.equal(value.result.Data.Compatibility.ServerStatus, 'Compatible');
  assert.deepEqual(value.writes, []);
});

test('同版本、数字进位和四段平台版本按数值比较', () => {
  for (const [minimum, backend] of [['8.6.7', 'v8.6.7'], ['v8.6.9', '8.6.10'], ['8.9.9', 'v8.10.0'],
    ['8.6.7.0', '8.6.7'], ['8.6.7.1', '8.6.7.2']]) {
    const value = run({ info: { ServerMinVersion: minimum }, backend, validateOnly: true });
    assert.equal(value.result.Code, 1, value.result.Msg);
    assert.equal(value.result.Data.Compatibility.ServerStatus, 'Compatible');
    assert.equal(value.calls.length, 1);
  }
  assert.equal(run({ info: { ServerMinVersion: '8.6.7.1' }, backend: 'v8.6.7' }).result.Code, 0);
});

test('历史无声明包不要求新原子，也不把未核验写成兼容通过', () => {
  for (const info of [{}, { ServerMinVersion: '', ClientMinVersion: null }]) {
    const value = run({ info, missingReader: true, validateOnly: true });
    assert.equal(value.result.Code, 1, value.result.Msg);
    assert.equal(value.result.Data.Compatibility.ServerStatus, 'NotDeclared');
    assert.equal(value.result.Data.Compatibility.ClientStatus, 'NotDeclared');
    assert.deepEqual(value.calls, []);
  }
});

test('有声明而原子缺失、异常或运行版本未知时拒绝，不泄露原异常', () => {
  for (const options of [{ missingReader: true }, { readerThrows: true }, { backend: '' }, { backend: '未知' }, { backend: '8.6.7-beta' }]) {
    const value = run({ info: { ServerMinVersion: '8.6.0' }, ...options });
    assert.equal(value.result.Code, 0);
    assert.equal(value.result.Data.ErrorType, 'PACKAGE_RUNTIME_VERSION_UNAVAILABLE');
    assert.doesNotMatch(JSON.stringify(value.result), /private-host-detail/);
    assert.deepEqual(value.writes, []);
  }
});

test('非法最低版本声明不降级为未限制', () => {
  for (const field of ['ServerMinVersion', 'ClientMinVersion']) for (const value of ['latest', '8.6', '8.6.7-beta', '8.6.7.0.1', '8.6.99999999999999999999', 8, false, {}, ['8.6.7']]) {
    const output = run({ info: { [field]: value }, missingColumns: true });
    assert.equal(output.result.Code, 0, `${field}: ${JSON.stringify(value)}`);
    assert.equal(output.result.Data.ErrorType, 'PACKAGE_RUNTIME_VERSION_INVALID');
    assert.deepEqual(output.writes, []);
  }
});

test('前端最低版本保留待核验状态，调用参数不能冒充已部署版本', () => {
  const value = run({ info: { ClientMinVersion: '8.6.7' }, missingReader: true, validateOnly: true,
    params: { ClientVersion: '99.0.0', FrontendVersion: '99.0.0' } });
  assert.equal(value.result.Code, 1, value.result.Msg);
  assert.equal(value.result.Data.Compatibility.ClientStatus, 'PendingClientVerification');
  assert.equal(value.result.Data.Compatibility.ClientMinVersion, '8.6.7');
  assert.ok(value.result.Data.Compatibility.Warnings.length > 0);
});

test('伪造参数、Managed 重装及后台后续分片都不能绕过当前节点版本', () => {
  for (const phase of ['Ddl', 'Fields', 'ApplicationAssets', 'ScheduleJobs']) {
    const options = { info: { ServerMinVersion: '8.6.8' }, params: { ServerVersion: '99.0.0', BackendVersion: '99.0.0',
      SkipVersionCheck: true, Force: true, InstallAction: 'Reinstall' }, checkpoint: { Phase: phase, Index: 3 } };
    assert.equal(run({ ...options, backend: '8.6.8' }).result.Code, 1);
    const oldNode = run({ ...options, backend: '8.6.7' });
    assert.equal(oldNode.result.Code, 0);
    assert.equal(oldNode.result.Data.ErrorType, 'PACKAGE_RUNTIME_VERSION_TOO_LOW');
    assert.deepEqual(oldNode.writes, []);
  }
});
