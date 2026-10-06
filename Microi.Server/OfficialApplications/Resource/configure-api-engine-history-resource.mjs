#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'

const resourceUrls = [new URL('./app.microi.form-engine.json', import.meta.url)]
if (process.argv.includes('--sync-base')) {
  resourceUrls.push(new URL('./.resource-sync-base/app.microi.form-engine.json', import.meta.url))
}

const targetVersion = 'v7.5.4'
const releaseLine = '2026-08-21 v7.5.4 将接口引擎修改历史改为 TableChild 子表；旧 ChangeHistory 按非空行幂等迁移，新版 MCP 与 VS Code 写入独立版本记录。'
const parentTableId = 'cf389aef-72cc-4980-9c5b-143123561ac0'
const parentTabId = '01KFFN4HBY49TNPBX3K0KKHHG3'
const historyTableId = '7bc0d2ab-c7b0-4d4b-9f62-1ce6ca3d02a1'
const historyTabId = '7bc0d2ab-c7b0-4d4b-9f62-1ce6ca3d02a2'
const historyTableName = 'mci_apiengine_change_history'

const historyDdl = `CREATE TABLE IF NOT EXISTS \`${historyTableName}\` (
  \`Id\` varchar(36) NOT NULL PRIMARY KEY,
  \`CreateTime\` datetime NULL COMMENT '创建时间',
  \`UpdateTime\` datetime NULL COMMENT '修改时间',
  \`UserId\` varchar(36) NULL COMMENT '创建人Id',
  \`UserName\` varchar(255) NULL COMMENT '创建人',
  \`IsDeleted\` int NULL COMMENT '是否已删除',
  \`ApiEngineId\` varchar(36) NOT NULL COMMENT '接口引擎Id',
  \`Version\` varchar(25) NULL COMMENT '版本号',
  \`Description\` mediumtext NULL COMMENT '修改说明',
  \`EntryKey\` varchar(64) NULL COMMENT '幂等键（平台写入时生成，人工补录可为空）',
  \`Source\` varchar(50) NULL COMMENT '记录来源',
  UNIQUE KEY \`ux_mci_apiengine_history_entry\` (\`EntryKey\`),
  KEY \`ix_mci_apiengine_history_engine_time\` (\`ApiEngineId\`, \`CreateTime\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`

const historyTable = {
  EnableTrash: 0,
  EnableDataVersion: 0,
  DataLogRole: '[]',
  DisplayDefaultField: 1,
  EnableDataComment: 0,
  EnableDataLog: 0,
  DataEncryptSave: 0,
  IsAnonymousRead: 0,
  Description: '接口引擎修改历史',
  Tabs: JSON.stringify([{ Id: historyTabId, Name: '修改记录', _RawName: '修改记录', Sort: 1, Display: true }]),
  TabsPosition: 'top',
  FormLabelPosition: 'top',
  Column: 1,
  BindRole: '[]',
  Name: historyTableName,
  IsTree: 0,
  DataEncryptTransfer: 0,
  TreeLazy: 0,
  EnableCache: 0,
  IsAnonymousAdd: 0,
  Id: historyTableId,
  CreateTime: '2026-08-21 00:00:00',
}

const field = (id, name, label, type, component, sort, extra = {}) => ({
  Id: id,
  CreateTime: '2026-08-21 00:00:00',
  TableId: historyTableId,
  TableName: historyTableName,
  Name: name,
  Label: label,
  Type: type,
  Component: component,
  Sort: sort,
  Visible: 1,
  AppVisible: 1,
  Readonly: 0,
  NotEmpty: 0,
  InTableEdit: 0,
  Unique: 0,
  NameConfirm: 1,
  TableWidth: 140,
  Tab: historyTabId,
  BindRole: '[]',
  Data: '[]',
  Encrypt: 0,
  ...extra,
})

const historyFields = [
  field('7bc0d2ab-c7b0-4d4b-9f62-1ce6ca3d02b1', 'ApiEngineId', '接口引擎Id', 'varchar(36)', 'Text', 100, {
    Visible: 0,
    AppVisible: 0,
    TableWidth: 0,
  }),
  field('7bc0d2ab-c7b0-4d4b-9f62-1ce6ca3d02b2', 'Version', '版本号', 'varchar(25)', 'Text', 200, {
    FormWidth: 6,
    TableWidth: 110,
  }),
  field('7bc0d2ab-c7b0-4d4b-9f62-1ce6ca3d02b3', 'Description', '修改说明', 'mediumtext', 'Textarea', 300, {
    FormWidth: 18,
    TableWidth: 360,
    NotEmpty: 1,
    Config: JSON.stringify({ Textarea: { DefaultRows: 3 } }),
  }),
  field('7bc0d2ab-c7b0-4d4b-9f62-1ce6ca3d02b4', 'EntryKey', '幂等键', 'varchar(64)', 'Text', 400, {
    Visible: 0,
    AppVisible: 0,
    TableWidth: 0,
  }),
  field('7bc0d2ab-c7b0-4d4b-9f62-1ce6ca3d02b5', 'Source', '记录来源', 'varchar(50)', 'Text', 500, {
    FormWidth: 6,
    TableWidth: 130,
    Readonly: 1,
  }),
]

const legacyField = {
  Id: '01KS68M8VHK2AF8Q0DVMDCC9Q3',
  CreateTime: '2026-08-21 00:00:00',
  TableId: parentTableId,
  TableName: 'sys_apiengine',
  Name: 'ChangeHistory',
  Label: '修改历史说明（兼容）',
  Type: 'mediumtext',
  Component: 'Textarea',
  Sort: 3600,
  Visible: 0,
  AppVisible: 0,
  Readonly: 1,
  NotEmpty: 0,
  FormWidth: 24,
  TableWidth: 0,
  Tab: parentTabId,
  InTableEdit: 0,
  Unique: 0,
  NameConfirm: 1,
  BindRole: '[]',
  Data: '[]',
  Encrypt: 0,
  Description: '滚动升级兼容字段；新版界面与同步工具不再直接维护此多行文本。',
}

const parentTableChildField = {
  Id: '7bc0d2ab-c7b0-4d4b-9f62-1ce6ca3d02c1',
  CreateTime: '2026-08-21 00:00:00',
  TableId: parentTableId,
  TableName: 'sys_apiengine',
  Name: 'ChangeHistoryRows',
  Label: '修改历史',
  Type: '1',
  Component: 'TableChild',
  Sort: 3610,
  Visible: 1,
  AppVisible: 1,
  Readonly: 0,
  NotEmpty: 0,
  FormWidth: 24,
  TableWidth: 0,
  Tab: parentTabId,
  InTableEdit: 0,
  Unique: 0,
  NameConfirm: 1,
  BindRole: '[]',
  Data: '[]',
  Encrypt: 0,
  Description: '每次修改一条记录；MCP、VS Code 与历史迁移均写入此子表。',
  Config: JSON.stringify({
    ParamData: {},
    EnableSearch: false,
    TableChildTableId: historyTableId,
    TableChildSysMenuId: '',
    TableChildSysMenuName: '',
    TableChildFkFieldName: 'ApiEngineId',
    TableChildCallbackField: '',
    TableChildRowClickV8: '',
    TableChild: {
      Data: [],
      SearchAppend: { _OrderBy: 'CreateTime', _OrderByType: 'DESC' },
      PrimaryTableFieldName: 'Id',
      DisablePagination: false,
      NoneDefaultHeight: true,
    },
  }),
}

const physicalColumns = [
  ['Id', 'varchar(36)', 'varchar', 'NO', null, '', 'PRI'],
  ['CreateTime', 'datetime', 'datetime', 'YES', null, '创建时间', ''],
  ['UpdateTime', 'datetime', 'datetime', 'YES', null, '修改时间', ''],
  ['UserId', 'varchar(36)', 'varchar', 'YES', null, '创建人Id', ''],
  ['UserName', 'varchar(255)', 'varchar', 'YES', null, '创建人', ''],
  ['IsDeleted', 'int', 'int', 'YES', null, '是否已删除', ''],
  ['ApiEngineId', 'varchar(36)', 'varchar', 'NO', null, '接口引擎Id', 'MUL'],
  ['Version', 'varchar(25)', 'varchar', 'YES', null, '版本号', ''],
  ['Description', 'mediumtext', 'mediumtext', 'YES', null, '修改说明', ''],
  ['EntryKey', 'varchar(64)', 'varchar', 'YES', null, '幂等键（平台写入时生成，人工补录可为空）', 'UNI'],
  ['Source', 'varchar(50)', 'varchar', 'YES', null, '记录来源', ''],
].map(([name, columnType, dataType, nullable, defaultValue, comment, key], index) => ({
  TABLE_NAME: historyTableName,
  COLUMN_NAME: name,
  COLUMN_TYPE: columnType,
  DATA_TYPE: dataType,
  IS_NULLABLE: nullable,
  COLUMN_DEFAULT: defaultValue,
  COLUMN_COMMENT: comment,
  COLUMN_KEY: key,
  EXTRA: '',
  ORDINAL_POSITION: index + 1,
}))

const upsert = (rows, value, predicate) => {
  const index = rows.findIndex(predicate)
  if (index >= 0) rows[index] = value
  else rows.push(value)
}

const parseVersion = value => {
  const match = String(value || '').match(/^v(\d+)\.(\d+)\.(\d+)$/i)
  return match ? match.slice(1).map(Number) : [0, 0, 0]
}

const maxVersion = (left, right) => {
  const a = parseVersion(left)
  const b = parseVersion(right)
  for (let index = 0; index < 3; index += 1) {
    if (a[index] > b[index]) return left
    if (a[index] < b[index]) return right
  }
  return left || right
}

for (const resourceUrl of resourceUrls) {
  const packageModel = JSON.parse(await readFile(resourceUrl, 'utf8'))
  packageModel.DDLStatements ||= []
  packageModel.PhysicalColumns ||= []
  packageModel.DiyTables ||= []
  packageModel.DiyFields ||= []

  upsert(
    packageModel.DDLStatements,
    { TableName: historyTableName, TableId: historyTableId, DDL: historyDdl },
    item => item.TableName === historyTableName,
  )
  packageModel.PhysicalColumns = packageModel.PhysicalColumns
    .filter(item => String(item.TABLE_NAME || item.TableName || '').toLowerCase() !== historyTableName)
    .concat(physicalColumns)
  upsert(packageModel.DiyTables, historyTable, item => item.Id === historyTableId || item.Name === historyTableName)

  const managedFields = [legacyField, parentTableChildField, ...historyFields]
  for (const managedField of managedFields) {
    upsert(
      packageModel.DiyFields,
      managedField,
      item => item.Id === managedField.Id
        || (item.TableId === managedField.TableId && item.Name === managedField.Name),
    )
  }

  const info = packageModel.PackageInfo ||= {}
  const historyLines = String(info.ChangeHistory || '').split('\n').filter(Boolean)
  info.Version = maxVersion(info.Version, targetVersion)
  info.Description = '表单引擎基础资源。表单设计与运行时统一使用物理属性和现代分组工作台；接口引擎修改历史使用可查询、可审计的 TableChild 子表。'
  info.ChangeHistory = `${[releaseLine, ...historyLines.filter(line => line !== releaseLine)].join('\n')}\n`
  info.RequiredPlatformCapabilities = [...new Set([
    ...(info.RequiredPlatformCapabilities || []),
    'ServerTable:mci_apiengine_change_history',
    'ClientComponent:TableChild',
  ])]
  info.TableCount = packageModel.DiyTables.length
  info.FieldCount = packageModel.DiyFields.length
  info.DDLCount = packageModel.DDLStatements.length
  info.PhysicalColumnCount = packageModel.PhysicalColumns.length
  info.ApiEngineCount = (packageModel.SysApiEngines || []).length

  await writeFile(resourceUrl, `${JSON.stringify(packageModel, null, 2)}\n`, 'utf8')
}

console.log(JSON.stringify({
  version: targetVersion,
  table: historyTableName,
  tableId: historyTableId,
  fieldCount: historyFields.length + 2,
  resources: resourceUrls.length,
}))
