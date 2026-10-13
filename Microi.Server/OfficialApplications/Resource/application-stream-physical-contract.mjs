import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// 安全审计台账只交付物理结构，不生成可写的 DIY 元数据或审计种子行。
export const auditTable = 'mci_app_stream_gate_transition';
export const auditColumns = [
  ['Id', 'varchar(50)'], ['TransitionId', 'varchar(128)'], ['OsClient', 'varchar(50)'],
  ['OsClientType', 'varchar(50)'], ['OsClientNetwork', 'varchar(50)'],
  ['ExpectedMode', 'varchar(20)'], ['ExpectedMinProtocol', 'int'], ['ExpectedGateEpoch', 'bigint'],
  ['TargetMode', 'varchar(20)'], ['TargetMinProtocol', 'int'], ['ResultGateEpoch', 'bigint'],
  ['DrainProofJson', 'mediumtext'], ['DrainProofSha256', 'char(64)'],
  ['RequestFingerprint', 'char(64)'], ['ConfirmationSha256', 'char(64)'],
  ['OperatorUserId', 'varchar(50)'], ['OperatorAccount', 'varchar(100)', true],
  ['OperatorName', 'varchar(200)', true], ['Reason', 'varchar(1000)', true], ['CreateTime', 'datetime'],
];
export const gateIndexes = [
  { TableName: 'mci_ai_app_version', IndexName: 'ux_aav_app_version', Unique: true, Columns: ['AppId', 'VersionNo'] },
  { TableName: 'mci_ai_app_version', IndexName: 'ux_aav_app_request', Unique: true, Columns: ['AppId', 'RequestId'], SqlServerFilterColumn: 'RequestId' },
  { TableName: 'mci_ai_app_file', IndexName: 'ux_aaf_version_pathhash', Unique: true, Columns: ['VersionId', 'FilePathHash'], SqlServerFilterColumn: 'VersionId' },
  { TableName: 'mci_ai_app_version', IndexName: 'ix_aav_state_time_app', Unique: false, Columns: ['PublishState', 'UpdateTime', 'AppId'] },
  { TableName: 'mci_ai_app_file', IndexName: 'ix_aaf_app_version_scope', Unique: false, Columns: ['AppId', 'VersionId', 'StorageScope'] },
  { TableName: 'sys_microistore', IndexName: 'ix_store_active_fence', Unique: false, Columns: ['ActivePublishVersionId', 'PublishFence'] },
  { TableName: auditTable, IndexName: 'ux_asgt_transition_id', Unique: true, Columns: ['TransitionId'] },
];

export function applyApplicationStreamPhysicalContract(packageModel) {
  const model = structuredClone(packageModel);
  if ((model.DiyTables || []).some(t => t.Name === auditTable)
      || (model.DiyFields || []).some(f => f.TableName === auditTable)
      || (model.DataSets || []).some(d => d.TableName === auditTable)) {
    throw Error('应用流式发布审计表禁止 DIY 元数据或种子数据');
  }
  model.DDLStatements ||= [];
  model.PhysicalColumns ||= [];
  const upsert = (list, match, value) => {
    const matches = list.map((row, index) => match(row) ? index : -1).filter(index => index >= 0);
    if (matches.length > 1) throw Error('应用流式发布物理契约包含重复声明');
    if (matches.length) list[matches[0]] = { ...list[matches[0]], ...value };
    else list.push(value);
  };
  const ddl = `CREATE TABLE IF NOT EXISTS \`${auditTable}\` (\n`
    + auditColumns.map(([name, type]) => `  \`${name}\` ${type} ${name === 'Id' ? 'NOT NULL PRIMARY KEY' : 'NULL'}`).join(',\n')
    + '\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;';
  upsert(model.DDLStatements, row => row.TableName === auditTable && /^CREATE\s+TABLE/i.test(row.DDL), {
    TableName: auditTable, DDL: ddl, ApplicationStreamGateContract: true,
  });
  for (const [index, [name, type, unicode]] of auditColumns.entries()) {
    upsert(model.PhysicalColumns, row => row.TABLE_NAME === auditTable && row.COLUMN_NAME === name, {
      TABLE_NAME: auditTable, COLUMN_NAME: name, COLUMN_TYPE: type,
      DATA_TYPE: type.replace(/\(.*/, ''), IS_NULLABLE: name === 'Id' ? 'NO' : 'YES',
      COLUMN_DEFAULT: null, COLUMN_COMMENT: name, COLUMN_KEY: name === 'Id' ? 'PRI' : '',
      EXTRA: '', ORDINAL_POSITION: index + 1, ...(unicode ? { SQLSERVER_UNICODE: true } : {}),
    });
  }
  for (const index of gateIndexes) {
    const statement = {
      TableName: index.TableName,
      DDL: `CREATE ${index.Unique ? 'UNIQUE ' : ''}INDEX \`${index.IndexName}\` ON \`${index.TableName}\` (${index.Columns.map(c => `\`${c}\``).join(',')});`,
      ApplicationStreamGateContract: true,
      ...(index.SqlServerFilterColumn ? { SqlServerFilterColumn: index.SqlServerFilterColumn } : {}),
    };
    upsert(model.DDLStatements, row => row.TableName === index.TableName
      && new RegExp('^CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+`?' + index.IndexName + '(?:`|\\s)', 'i').test(row.DDL), statement);
  }
  model.PackageInfo.DDLCount = model.DDLStatements.length;
  model.PackageInfo.PhysicalColumnCount = model.PhysicalColumns.length;
  return model;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const packagePath = new URL('./app.microi.store.json', import.meta.url);
  const model = applyApplicationStreamPhysicalContract(JSON.parse(fs.readFileSync(packagePath, 'utf8')));
  fs.writeFileSync(packagePath, JSON.stringify(model, null, 2) + '\n');
  const helper = fs.readFileSync(new URL('./application-stream-gate-export.js', import.meta.url), 'utf8')
    .replace('APPLICATION_STREAM_GATE_AUDIT_COLUMNS', JSON.stringify(auditColumns))
    .replace('APPLICATION_STREAM_GATE_INDEXES', JSON.stringify(gateIndexes));
  const exporterPath = new URL('./export-package.js', import.meta.url);
  let exporter = fs.readFileSync(exporterPath, 'utf8');
  if (exporter.includes('/* APPLICATION_STREAM_GATE_PHYSICAL_EXPORT_V1')) {
    exporter = exporter.replace(/\/\* APPLICATION_STREAM_GATE_PHYSICAL_EXPORT_V1[\s\S]*?\/\* END_APPLICATION_STREAM_GATE_PHYSICAL_EXPORT_V1 \*\//, helper.trim());
  } else exporter = exporter.replace('// ==================== 参数接收与校验 ====================', helper + '\n// ==================== 参数接收与校验 ====================');
  if (!exporter.includes('    appendApplicationStreamGatePhysicalContract(packageData);')) {
    exporter = exporter.replace('    if(SparseTableSelections.length)', '    appendApplicationStreamGatePhysicalContract(packageData);\n    if(SparseTableSelections.length)');
  }
  fs.writeFileSync(exporterPath, exporter);
  process.stdout.write(JSON.stringify({ DDLCount: model.PackageInfo.DDLCount, PhysicalColumnCount: model.PackageInfo.PhysicalColumnCount }) + '\n');
}
