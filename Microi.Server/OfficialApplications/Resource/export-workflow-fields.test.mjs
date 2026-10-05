import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const exporter = fs.readFileSync(new URL('./export-package.js', import.meta.url), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const names = {
  wf_flowdesign: ['Id', 'FlowName', 'TableId', 'IsEnable'],
  wf_node: ['Id', 'FlowDesignId', 'NodeName', 'NodeType', 'AllowAddUsers', 'Users', 'Roles', 'Depts'],
  wf_line: ['Id', 'FlowDesignId', 'FromNodeId', 'ToNodeId', 'LineName'],
};
function workflowPackage() {
  return {
    PackageInfo: { AppKey: 'fixture-workflow', Version: 'v1.0.1' },
    SysMenus: [], DiyTables: [], DiyFields: [], SysApiEngines: [], DDLStatements: [], PhysicalColumns: [],
    Installation: { ConfigurationPolicy: 'PreserveTenantValues' },
    WfFlowDesigns: [{ Id: 'flow', FlowName: '停用安装母版', TableId: 'form', IsEnable: 0 }],
    WfNodes: [{ Id: 'node', FlowDesignId: 'flow', NodeName: '审批', NodeType: 'Approve', AllowAddUsers: 0, Users: [], Roles: [], Depts: [] }],
    WfLines: [{ Id: 'line', FlowDesignId: 'flow', FromNodeId: 'node', ToNodeId: 'end', LineName: '审批到结束' }],
  };
}

// 执行完整导出器而非复刻 guard：记录真实持久分支的 HDFS、fence、日志与指针动作。
function run(candidate = workflowPackage(), options = {}) {
  const writes = [], schemaReads = [], calls = [];
  let storedPackage;
  const store = { Id: 'store', AppKey: 'fixture-workflow', AppVersion: 'v1.0.0', PackageSha256: 'old', Status: 'Published', IsApprove: 1 };
  const log = { Id: 'log', Version: 'v1.0.1', Title: '修复', Content: '字段闭包验收', ChangeType: 'Fix', ReleaseTime: '2026-10-03 04:00:00', Sort: 100 };
  const logs = options.newLog ? [] : [clone(log)];
  const metadata = ['diy_table', 'diy_field', 'wf_flowdesign', 'wf_node', 'wf_line'].map(Name => ({ Id: `table-${Name}`, Name }));
  const param = {
    TableIds: ['missing'], PackageVersion: 'v1.0.1', PersistStoreId: 'store', PersistAppKey: 'fixture-workflow',
    ExpectedPersistAppVersion: 'v1.0.0', ExpectedPersistPackageSha256: 'old',
    PreparedPersistPackageByteBase64: options.native ? undefined : Buffer.from(JSON.stringify(candidate)).toString('base64'),
    PersistChangeLog: options.newLog ? log : undefined,
    ...(options.native ? { FlowIds: ['flow'] } : {}),
    ...(options.exportOnly ? { PersistStoreId: undefined } : {}),
  };
  const V8 = {
    Param: param, OsClient: 'fixture-tenant', OsClientModel: options.noProvider ? {} : { DbType: options.provider || 'MySql' },
    CurrentUser: { Id: 'admin', Level: 9999, Name: '管理' }, DbTrans: { Id: 'shared' }, Method: { NewUlid: () => 'fence' },
    FormEngine: {
      GetTableData(table, query) {
        calls.push(['read', table]);
        if (table === 'diy_table') return { Code: 1, Data: query._Where?.[0]?.[0] === 'Name' ? clone(metadata) : [] };
        if (table === 'diy_field') return { Code: 1, Data: [] };
        if (table === 'sys_microistore_changelog') return { Code: 1, Data: clone(logs) };
        if (table === 'mic_data_version') return { Code: 1, Data: [] };
        const key = { wf_flowdesign: 'WfFlowDesigns', wf_node: 'WfNodes', wf_line: 'WfLines' }[table];
        if (key) return { Code: 1, Data: clone(candidate[key] || []) };
        throw Error(`未声明读 ${table}`);
      },
      GetFormData(table) {
        assert.equal(table, 'sys_microistore');
        return { Code: 1, Data: clone(store) };
      },
      UptFormDataByWhere(table, value, transaction) {
        assert.equal(table, 'sys_microistore'); assert.equal(transaction, V8.DbTrans);
        writes.push('fence'); store.BuildStatus = value.BuildStatus; return { Code: 1 };
      },
      AddFormData(table, value, transaction) {
        assert.equal(table, 'sys_microistore_changelog'); assert.equal(transaction, V8.DbTrans);
        writes.push('log'); logs.push(clone(value)); return { Code: 1 };
      },
      UptFormData(table, value, transaction) {
        assert.equal(table, 'sys_microistore'); assert.equal(transaction, V8.DbTrans);
        writes.push('pointer'); Object.assign(store, clone(value)); return { Code: 1 };
      },
    },
    Db: { FromSql(sql) {
      let table;
      const strictRead = /SELECT COLUMN_NAME|FROM sys\.columns/i.test(sql);
      return {
        AddInParameter(key, value) { assert.equal(key, '@p0'); table = value; return this; },
        ToArray() {
          if (!strictRead) return [];
          schemaReads.push({ sql, table });
          if (options.schemaError) throw Error('模拟目录不可读');
          if (options.schemaRows !== undefined) return clone(options.schemaRows);
          return (options.columns?.[table] || names[table] || []).map(COLUMN_NAME => ({ COLUMN_NAME }));
        },
      };
    } },
    ApiEngine: { Run(key, input) {
      assert.equal(key, 'microi-store-package-storage'); assert.equal(input.Action, 'Store');
      writes.push('hdfs');
      const bytes = Buffer.from(input.PackageByteBase64, 'base64'); storedPackage = JSON.parse(bytes.toString('utf8'));
      return { Code: 1, Data: { PackageId: 'package', PackageStorageMode: 'HdfsPublic', PackageHdfsPath: '/fixture/package.json', PackageSha256: sha(bytes), PackageSize: bytes.length, PackageContentType: 'application/json; charset=utf-8', PackageFormatVersion: 1, PackageUploadedAt: '2026-10-03' } };
    } },
  };
  const System = { Convert: { FromBase64String: value => Buffer.from(value, 'base64'), ToBase64String: bytes => Buffer.from(bytes).toString('base64') }, Text: { Encoding: { UTF8: { GetString: bytes => Buffer.from(bytes).toString('utf8'), GetBytes: value => Buffer.from(value) } } } };
  const result = vm.runInNewContext(`(function(){${exporter}\n})()`, { V8, System, DateNow: () => '2026-10-03 04:00:00' }, { timeout: 1000 });
  return { result, writes, schemaReads, storedPackage, calls, store };
}

function denied(candidate, options) {
  const actual = run(candidate, options);
  assert.equal(actual.result.Code, 0, actual.result.Msg);
  assert.match(actual.result.Msg, /工作流.*字段|工作流.*物理列|工作流.*数据库|工作流.*资源/);
  assert.deepEqual(actual.writes, [], '字段失败必须早于 HDFS、fence、日志与指针');
  assert.equal(actual.store.AppVersion, 'v1.0.0');
  return actual;
}

for (const value of [0, true, false, null]) {
  test(`预制工作流拒绝不存在的 AllowAddNodes=${String(value)}，伪造 PhysicalColumns 不能授权`, () => {
    const candidate = workflowPackage(); candidate.WfNodes[0].AllowAddNodes = value;
    candidate.PhysicalColumns.push({ TABLE_NAME: 'wf_node', COLUMN_NAME: 'AllowAddNodes' });
    candidate.PackageInfo.PhysicalColumnCount = 1;
    denied(candidate, { newLog: true });
  });
}
test('停用空绑定合法模板保留 AllowAddUsers=0，完整成功走 HDFS 和共享事务 CAS', () => {
  const actual = run(workflowPackage(), { newLog: true });
  assert.equal(actual.result.Code, 1, actual.result.Msg);
  assert.deepEqual(actual.writes, ['hdfs', 'fence', 'log', 'pointer']);
  assert.deepEqual(actual.storedPackage.WfNodes, workflowPackage().WfNodes);
  assert.equal(actual.storedPackage.Installation.ConfigurationPolicy, 'PreserveTenantValues');
  assert.equal(actual.result.Data.SnapshotPending, true);
  assert.equal(actual.schemaReads.length, 3);
});
test('同样的合法原生导出资源经过物理字段校验并保留真实绑定', () => {
  const candidate = workflowPackage(); candidate.WfNodes[0].Users = [{ Id: 'actual-user', Name: '实际审批人' }];
  const actual = run(candidate, { native: true });
  assert.equal(actual.result.Code, 1, actual.result.Msg);
  assert.deepEqual(actual.storedPackage.WfNodes, candidate.WfNodes);
  assert.equal(actual.schemaReads.length, 3);
});
test('无持久化的原生导出同样拒绝未知字段，合法模型保持原资源正文', () => {
  const candidate = workflowPackage();
  const actual = run(candidate, { native: true, exportOnly: true });
  assert.equal(actual.result.Code, 1, actual.result.Msg);
  assert.deepEqual(clone(actual.result.Data.WfNodes), candidate.WfNodes);
  assert.deepEqual(actual.writes, []); assert.equal(actual.schemaReads.length, 3);
  candidate.WfNodes[0].AllowAddNodes = true;
  denied(candidate, { native: true, exportOnly: true });
});
test('flow、node、line 均拒绝未知字段与大小写重复字段', () => {
  for (const key of ['WfFlowDesigns', 'WfNodes', 'WfLines']) {
    const unknown = workflowPackage(); unknown[key][0].UnknownFlag = null; denied(unknown);
    const duplicate = workflowPackage(); duplicate[key][0].id = duplicate[key][0].Id; denied(duplicate);
  }
});
test('当前数据库确实存在的租户定制列允许，不采用包自报或核心硬编码白名单', () => {
  const candidate = workflowPackage(); candidate.WfNodes[0].TenantApprovalNote = null;
  const actual = run(candidate, { columns: { wf_node: [...names.wf_node, 'TenantApprovalNote'] } });
  assert.equal(actual.result.Code, 1, actual.result.Msg);
  assert.equal(actual.storedPackage.WfNodes[0].TenantApprovalNote, null);
});
test('无工作流老包无需工作流物理列或 provider，保持正式持久化兼容', () => {
  const candidate = workflowPackage(); delete candidate.WfFlowDesigns; delete candidate.WfNodes; delete candidate.WfLines;
  const actual = run(candidate, { noProvider: true, schemaError: true });
  assert.equal(actual.result.Code, 1, actual.result.Msg); assert.deepEqual(actual.schemaReads, []);
});
test('元数据目录不可读、空列、无效列或重复列必须失败关闭', () => {
  for (const options of [
    { schemaError: true }, { schemaRows: [] }, { schemaRows: null },
    { schemaRows: [{ COLUMN_NAME: '' }] },
    { schemaRows: [{ COLUMN_NAME: 'Id' }, { COLUMN_NAME: 'id' }] },
  ]) denied(workflowPackage(), options);
});
test('工作流字段闭包只用可信源 provider 和固定当前数据库三表参数', () => {
  for (const [provider, pattern, forbidden] of [
    ['MySql', /TABLE_SCHEMA\s*=\s*DATABASE\(\)/, /sys\.columns|USER_TAB_COLUMNS/],
    ['MariaDB', /TABLE_SCHEMA\s*=\s*DATABASE\(\)/, /sys\.columns|USER_TAB_COLUMNS/],
    ['SqlServer', /sys\.columns[\s\S]*OBJECT_ID\(@p0/, /DATABASE\(\)|USER_TAB_COLUMNS/],
    ['Oracle', /USER_TAB_COLUMNS[\s\S]*UPPER\(@p0\)/, /DATABASE\(\)|sys\.columns/],
  ]) {
    const candidate = workflowPackage(); candidate.PackageInfo.DbType = 'attacker-provider';
    const actual = run(candidate, { provider }); assert.equal(actual.result.Code, 1, actual.result.Msg);
    assert.deepEqual(actual.schemaReads.map(read => read.table), ['wf_flowdesign', 'wf_node', 'wf_line']);
    for (const read of actual.schemaReads) { assert.match(read.sql, pattern); assert.doesNotMatch(read.sql, forbidden); }
  }
  denied(workflowPackage(), { provider: 'PostgreSQL' }); denied(workflowPackage(), { noProvider: true });
});
test('非法 workflow 资源形状不能被 copyArray 静默当成空资源', () => {
  for (const value of ['[]', {}, { length: 1, 0: { Id: 'node' } }, [null], [0], [[]]]) {
    const candidate = workflowPackage(); candidate.WfNodes = value; denied(candidate);
  }
});
