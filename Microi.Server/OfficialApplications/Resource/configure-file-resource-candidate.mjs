import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import manifest, { policyFields } from '../PlatformService/file-resource-manifest.mjs';
import { alignMasterCatalogMetadata } from '../PlatformService/sync-file-resource-master-metadata.mjs';

export const fileResourceCandidateNames = ['app.microi.sys-log.json', 'app.microi.sys-config.json', 'app.microi.saas-engine.json'];
const stableId = key => crypto.createHash('sha256').update('managed-file-resource/1|' + key).digest('hex').slice(0, 32);
const engineSource = () => fs.readFileSync(new URL('../PlatformService/engines/mci-file-resource-manager.js', import.meta.url), 'utf8');
const baseColumns = [
  { name: 'Id', label: 'Id', type: 'varchar(36)', required: true, primary: true },
  { name: 'CreateTime', label: '创建时间', type: 'datetime' },
  { name: 'UpdateTime', label: '修改时间', type: 'datetime' },
  { name: 'UserId', label: '创建人Id', type: 'varchar(36)' },
  { name: 'UserName', label: '创建人', type: 'varchar(255)' },
  { name: 'IsDeleted', label: '是否已删除', type: 'int', defaultValue: '0' },
];
const physical = (table, f, ordinal) => ({
  TABLE_NAME: table, COLUMN_NAME: f.name, COLUMN_TYPE: f.type, DATA_TYPE: f.type.split('(')[0],
  IS_NULLABLE: f.required ? 'NO' : 'YES', COLUMN_DEFAULT: f.defaultValue === undefined || f.defaultValue === '' ? null : f.defaultValue,
  COLUMN_COMMENT: f.label, COLUMN_KEY: f.primary ? 'PRI' : '', EXTRA: '', ORDINAL_POSITION: ordinal,
});
const sqlColumn = f => '  `' + f.name + '` ' + f.type + (f.required ? ' NOT NULL' : ' NULL')
  + (f.primary ? ' PRIMARY KEY' : '')
  + (f.defaultValue !== undefined && f.defaultValue !== '' ? ' DEFAULT ' + f.defaultValue : '')
  + " COMMENT '" + f.label.replace(/'/g, "''") + "'";

function upsertField(pkg, table, f, ordinal, tab = 'basic') {
  const old = pkg.DiyFields.find(x => x.TableId === table.Id && x.Name === f.name);
  const field = {
    TableName: table.Name, TableId: table.Id, Id: old?.Id || stableId(table.Name.toLowerCase() + '/field/' + f.name),
    Name: f.name, Label: f.label, Type: f.type, Component: f.component, Tab: tab, Sort: ordinal,
    Visible: 1, AppVisible: 1, Readonly: f.readonly ? 1 : 0, NotEmpty: 0, Unique: 0,
    InTableEdit: 0, Encrypt: 0, NameConfirm: 1, TableWidth: 150, BindRole: '[]', Data: '[]', Config: '',
    DefaultValue: f.defaultValue ?? '', Description: f.description || '',
  };
  if (old) Object.assign(old, field); else pkg.DiyFields.push(field);
  const column = pkg.PhysicalColumns.find(x => x.TABLE_NAME.toLowerCase() === table.Name.toLowerCase() && x.COLUMN_NAME === f.name);
  if (column) Object.assign(column, physical(table.Name, f, column.ORDINAL_POSITION));
  else {
    const previous = pkg.PhysicalColumns.filter(x => x.TABLE_NAME.toLowerCase() === table.Name.toLowerCase());
    pkg.PhysicalColumns.push(physical(table.Name, f, Math.max(0, ...previous.map(x => Number(x.ORDINAL_POSITION) || 0)) + 1));
  }
}

function addOwnedTables(pkg) {
  for (const definition of manifest.tables) {
    let table = pkg.DiyTables.find(x => x.Name.toLowerCase() === definition.name);
    if (!table) {
      table = { Id: stableId('table/' + definition.name), Name: definition.name, Description: definition.description,
        Column: 2, ReadPrimary: 1, V8Limit: 0, IsDeleted: 0, Tabs: JSON.stringify([{ Id: 'basic', Name: '基本信息', Sort: 10 }]),
        FormOpenWidth: '80%', FormOpenType: 'Dialog' };
      pkg.DiyTables.push(table);
    }
    for (const [index, f] of definition.fields.entries()) upsertField(pkg, table, { ...f, readonly: true }, (index + 1) * 10);
    // No ordinary CRUD menu is installed. Readonly is a UI hint, not a
    // server-side write boundary; generic CRUD permissions still apply.
    for (const [index, f] of baseColumns.entries()) {
      if (!pkg.PhysicalColumns.some(x => x.TABLE_NAME.toLowerCase() === table.Name.toLowerCase() && x.COLUMN_NAME === f.name))
        pkg.PhysicalColumns.push(physical(table.Name, f, index + 1));
    }
    const columns = [...baseColumns, ...definition.fields];
    for (const [index, f] of columns.entries()) {
      const column = pkg.PhysicalColumns.find(x => x.TABLE_NAME.toLowerCase() === table.Name.toLowerCase() && x.COLUMN_NAME === f.name);
      column.ORDINAL_POSITION = index + 1;
    }
    const ddl = 'CREATE TABLE IF NOT EXISTS `' + table.Name + '` (\n' + columns.map(sqlColumn).join(',\n') + '\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;';
    let create = pkg.DDLStatements.find(x => x.TableName.toLowerCase() === table.Name.toLowerCase() && /^CREATE TABLE\b/i.test(x.DDL));
    if (create) create.DDL = ddl; else pkg.DDLStatements.push({ TableName: table.Name, TableId: table.Id, DDL: ddl });
    for (const index of definition.indexes) {
      const statement = 'CREATE ' + (index.unique ? 'UNIQUE ' : '') + 'INDEX `' + index.name + '` ON `' + table.Name + '` (' + index.columns.map(x => '`' + x + '`').join(', ') + ');';
      let old = pkg.DDLStatements.find(x => x.TableName.toLowerCase() === table.Name.toLowerCase() && x.DDL.includes('INDEX `' + index.name + '`'));
      if (old) old.DDL = statement; else pkg.DDLStatements.push({ TableName: table.Name, TableId: table.Id, DDL: statement });
    }
  }
}

function addPolicyFields(pkg) {
  const table = pkg.DiyTables.find(x => x.Name.toLowerCase() === 'sys_config');
  assert.ok(table, '系统设置权威表必须已存在');
  const backup = pkg.DiyFields.find(x => x.TableId === table.Id && x.Name === 'FileServerBak');
  assert.ok(backup, '保留当前候选已有 FileServerBak；不猜测或重建其身份');
  assert.ok(!pkg.DiyFields.some(x => x.TableId === table.Id && /^FileServerBakTraffic(?:ThresholdGiB|WindowHours)$/.test(x.Name)), '不得保留超长同义字段；遇到旧方案先显式核查来源');
  const create = pkg.DDLStatements.find(x => x.TableName.toLowerCase() === 'sys_config' && /^CREATE TABLE\b/i.test(x.DDL));
  assert.ok(create, '系统设置包必须保留空库建表DDL');
  // Two existing separator defects break empty-schema parsing. Repair only these
  // exact column lines; unrelated shared declarations are preserved verbatim.
  create.DDL = create.DDL
    .replace(/(  `DisableTaskScheduling` int NULL COMMENT '停用任务调度')\r?\n/, '$1,\n')
    .replace(/(  `CompatiblePlatformOldVersion` int NULL COMMENT '兼容平台旧版本'),,/, '$1,');
  for (const [index, f] of policyFields.entries()) {
    upsertField(pkg, table, f, Number(backup.Sort) + index + 1, backup.Tab);
    if (!create.DDL.includes('`' + f.name + '`')) {
      assert.match(create.DDL, /  `FileServerBak`[^\n]*\n/, '备用地址DDL锚点必须存在');
      create.DDL = create.DDL.replace(/(  `FileServerBak`[^\n]*\n)/, '$1' + sqlColumn(f) + ',\n');
    }
  }
}

export function configureFileResourceCandidate(input, name) {
  assert.ok(fileResourceCandidateNames.includes(name), '仅处理本功能的三个归属包');
  let pkg = structuredClone(input); const version = pkg.PackageInfo.Version;
  for (const key of ['DiyTables', 'DiyFields', 'PhysicalColumns', 'DDLStatements', 'SysApiEngines']) assert.ok(Array.isArray(pkg[key]), key + '缺失');
  if (name === 'app.microi.sys-log.json') {
    assert.equal(pkg.PackageInfo.AppId, manifest.ownerAppId);
    addOwnedTables(pkg);
    const key = 'mci-file-resource-manager', prior = pkg.SysApiEngines.find(x => x.ApiEngineKey === key);
    const engine = { Id: prior?.Id || stableId('engine/' + key), ApiEngineKey: key, ApiName: '热点公开资源目录', ApiAddress: '/apiengine/' + key,
      ApiV8Code: engineSource(), Version: 'v1.0.0', IsEnable: 1, StopHttp: 0, AllowAnonymous: 0, V8Unlimited: 1,
      V8Limit: 0, EnableLog: 0, IsDeleted: 0, ResponseType: 'JSON', Category: '系统日志/监控/CDN', ApiRole: '[]', Lock: 0,
      Timeout: 600, LimitRecursion: 200, LimitMemory: 128, MaxStatements: 5000000 };
    if (prior) Object.assign(prior, engine); else pkg.SysApiEngines.push(engine);
    pkg.ResourcePolicies ||= {}; pkg.ResourcePolicies.ApiEngines ||= {};
    pkg.ResourcePolicies.ApiEngines[key] = { Ownership: 'Application', UpgradePolicy: 'Managed' };
    pkg = alignMasterCatalogMetadata(pkg);
  } else {
    addPolicyFields(pkg);
    assert.ok(!pkg.SysApiEngines.some(x => x.ApiEngineKey === 'mci-file-resource-manager'), 'Managed接口只归属系统日志包');
  }
  // This tenant's chosen 1 GiB/24h is deliberately not included as a data seed.
  assert.deepEqual(pkg.DataSets, input.DataSets);
  assert.deepEqual(pkg.ScheduleJobs, input.ScheduleJobs);
  assert.deepEqual(pkg.ApplicationBundles, input.ApplicationBundles);
  for (const [count, rows] of Object.entries({ TableCount: 'DiyTables', FieldCount: 'DiyFields', PhysicalColumnCount: 'PhysicalColumns', DDLCount: 'DDLStatements', ApiEngineCount: 'SysApiEngines' })) pkg.PackageInfo[count] = pkg[rows].length;
  assert.equal(pkg.PackageInfo.Version, version, '本地候选不伪造发布版本');
  return pkg;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert.ok(process.argv.includes('--write'), '使用 --write 明确更新本地候选；不会触碰同步基线或远端');
  for (const name of fileResourceCandidateNames) {
    const file = new URL(name, import.meta.url), previous = fs.readFileSync(file, 'utf8');
    const next = JSON.stringify(configureFileResourceCandidate(JSON.parse(previous), name), null, 2) + '\n';
    assert.equal(fs.readFileSync(file, 'utf8'), previous, '候选被其他任务修改，拒绝覆盖');
    if (next !== previous) fs.writeFileSync(file, next);
    console.log(JSON.stringify({ File: name, LocalCandidateOnly: true, VersionUnchanged: true, Bytes: Buffer.byteLength(next) }));
  }
}
