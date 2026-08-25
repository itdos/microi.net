#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const resourceDirectory = dirname(fileURLToPath(import.meta.url));
const packagePath = resolve(resourceDirectory, 'app.microi.store.json');
const storeTableId = '6cf254f1-edd0-4f04-96bc-c9ad08b5a2c1';
const storeMenuId = '61b7faee-35b2-4571-add2-5231a355f368';
const changelogTableId = '9f6dc1a0-bfad-4c9a-9aa8-3a7122be8a01';
const changelogMenuId = '9f6dc1a0-bfad-4c9a-9aa8-3a7122be8a02';
const changelogFieldId = '9f6dc1a0-bfad-4c9a-9aa8-3a7122be8a03';
const changelogTabId = '9f6dc1a0-bfad-4c9a-9aa8-3a7122be8a04';
const changelogFormTabId = '9f6dc1a0-bfad-4c9a-9aa8-3a7122be8a05';
const createdAt = '2026-08-23 12:00:00';

const fieldDefinitions = [
  {
    id: '9f6dc1a0-bfad-4c9a-9aa8-3a7122be8a09',
    name: 'OsClient',
    label: '租户标识',
    type: 'varchar(50)',
    component: 'Text',
    visible: 0,
    readonly: 1,
    notEmpty: 1,
    formWidth: 24,
    tableWidth: 150,
    sort: 90,
    description: '当前租户标识，由平台写入并用于租户级唯一性与子表回查索引。',
  },
  {
    id: '9f6dc1a0-bfad-4c9a-9aa8-3a7122be8a10',
    name: 'StoreId',
    label: '商城应用',
    type: 'varchar(50)',
    component: 'Text',
    visible: 0,
    notEmpty: 1,
    formWidth: 24,
    tableWidth: 180,
    sort: 100,
    description: '关联 sys_microistore.Id，由更新日志子表自动带入。',
  },
  {
    id: '9f6dc1a0-bfad-4c9a-9aa8-3a7122be8a11',
    name: 'Version',
    label: '版本号',
    type: 'varchar(50)',
    component: 'Text',
    visible: 1,
    notEmpty: 1,
    formWidth: 8,
    tableWidth: 110,
    sort: 200,
    description: '必须与本次发布的 AppVersion 完全一致，例如 v1.7.6。',
  },
  {
    id: '9f6dc1a0-bfad-4c9a-9aa8-3a7122be8a12',
    name: 'Title',
    label: '更新标题',
    type: 'varchar(200)',
    component: 'Text',
    visible: 1,
    notEmpty: 1,
    formWidth: 16,
    tableWidth: 220,
    sort: 300,
    description: '一句话说明本版本给用户带来的主要变化。',
  },
  {
    id: '9f6dc1a0-bfad-4c9a-9aa8-3a7122be8a13',
    name: 'ChangeType',
    label: '更新类型',
    type: 'varchar(50)',
    component: 'Select',
    visible: 1,
    notEmpty: 1,
    formWidth: 8,
    tableWidth: 110,
    sort: 400,
    defaultValue: 'Feature',
    description: '新增、优化、修复、安全或重要变更。',
  },
  {
    id: '9f6dc1a0-bfad-4c9a-9aa8-3a7122be8a14',
    name: 'ReleaseTime',
    label: '发布时间',
    type: 'varchar(25)',
    component: 'DateTime',
    visible: 1,
    notEmpty: 1,
    formWidth: 8,
    tableWidth: 155,
    sort: 500,
    description: '本版本正式发布或准备发布的时间。',
  },
  {
    id: '9f6dc1a0-bfad-4c9a-9aa8-3a7122be8a15',
    name: 'Sort',
    label: '排序',
    type: 'int',
    component: 'NumberText',
    visible: 1,
    notEmpty: 0,
    formWidth: 8,
    tableWidth: 85,
    sort: 600,
    defaultValue: '100',
    description: '同一时间下数值越小越靠前。',
  },
  {
    id: '9f6dc1a0-bfad-4c9a-9aa8-3a7122be8a16',
    name: 'Content',
    label: '更新内容',
    type: 'mediumtext',
    component: 'Textarea',
    visible: 1,
    notEmpty: 1,
    formWidth: 24,
    tableWidth: 360,
    sort: 700,
    description: '面向用户写清新增能力、行为变化、修复内容和必要的升级提示。',
  },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error('JSON 配置无效：' + error.message);
  }
}

function replaceByIdentity(list, row, identities) {
  const index = list.findIndex((item) => identities.some((identity) => (
    String(item?.[identity] || '').toLowerCase() === String(row?.[identity] || '').toLowerCase()
  )));
  if (index >= 0) list[index] = row;
  else list.push(row);
}

function fieldReference(field) {
  return {
    Id: field.Id,
    Name: field.Name,
    Label: field.Label,
    TableDescription: '应用更新日志',
    TableName: 'sys_microistore_changelog',
    TableId: changelogTableId,
    AsName: '',
  };
}

function cloneField(packageModel, definition) {
  let template = null;
  if (definition.component === 'DateTime') {
    template = packageModel.DiyFields.find((item) => item.TableId === storeTableId && item.Name === 'AppUpdateTime');
  } else {
    template = packageModel.DiyFields.find((item) => item.Component === definition.component);
  }
  assert(template, '应用商城包缺少字段模板：' + definition.component);
  const field = JSON.parse(JSON.stringify(template));
  Object.assign(field, {
    Id: definition.id,
    TableId: changelogTableId,
    TableName: 'sys_microistore_changelog',
    Name: definition.name,
    Label: definition.label,
    Type: definition.type,
    Component: definition.component,
    Visible: definition.visible,
    AppVisible: definition.visible,
    Readonly: definition.readonly || 0,
    IsLockField: 0,
    NameConfirm: 1,
    NotEmpty: definition.notEmpty,
    FormWidth: definition.formWidth,
    TableWidth: definition.tableWidth,
    Sort: definition.sort,
    Tab: changelogFormTabId,
    Description: definition.description,
    DefaultValue: definition.defaultValue || '',
    BindRole: '[]',
    Data: '[]',
    V8Code: '',
    V8TmpEngineTable: '',
    V8TmpEngineForm: '',
    CreateTime: createdAt,
    UpdateTime: createdAt,
  });
  if (definition.component === 'Select') {
    field.Data = JSON.stringify([
      { Key: 'Feature', Value: '新增' },
      { Key: 'Improvement', Value: '优化' },
      { Key: 'Fix', Value: '修复' },
      { Key: 'Security', Value: '安全' },
      { Key: 'Breaking', Value: '重要变更' },
    ]);
    const config = parseJson(field.Config, {});
    Object.assign(config, {
      DataSource: 'KeyValue',
      SelectLabel: 'Value',
      SelectSaveField: 'Key',
      SelectSaveFormat: 'Text',
      EnableSearch: false,
    });
    field.Config = JSON.stringify(config);
  }
  if (definition.component === 'DateTime') {
    const config = parseJson(field.Config, {});
    config.DateTimeType = 'datetime';
    field.Config = JSON.stringify(config);
  }
  if (definition.component === 'Textarea') {
    const config = parseJson(field.Config, {});
    config.Textarea = { DefaultRows: 7 };
    field.Config = JSON.stringify(config);
  }
  return field;
}

function configureTable(packageModel) {
  const template = packageModel.DiyTables.find((item) => item.Name === 'sys_microistoreversion');
  assert(template, '应用商城包缺少 sys_microistoreversion 表模板');
  const table = JSON.parse(JSON.stringify(template));
  Object.assign(table, {
    Id: changelogTableId,
    Name: 'sys_microistore_changelog',
    Description: '应用更新日志',
    Column: 2,
    FormOpenWidth: '900px',
    FormOpenType: 'Dialog',
    Tabs: JSON.stringify([
      {
        Name: '更新内容',
        EnName: 'changelog',
        Display: true,
        Sort: 1,
        Id: changelogFormTabId,
        Icon: 'Document',
        _RawName: '更新内容',
      },
    ]),
    SubmitBeforeServerV8: [
      '/*',
      ' * V8 Event',
      ' * TableKey: sys_microistore_changelog',
      ' * EventType: SubmitBeforeServerV8',
      ' * Version: v1.0.0',
      ' * Function:',
      ' * - 保存更新日志前从服务端租户上下文写入隐藏租户字段；删除操作不改写数据。',
      ' * - 租户上下文缺失时阻止提交，避免产生无法归属的日志。',
      ' */',
      '',
      "if (String(V8.FormSubmitAction || '').toLowerCase() === 'delete') return { Code: 1 };",
      "var tenantKey = String(V8.OsClient || '').trim();",
      "if (!tenantKey) return { Code: 0, Msg: '租户上下文缺失，无法保存更新日志。' };",
      'V8.Form.OsClient = tenantKey;',
      'return { Code: 1 };',
      '',
    ].join('\n'),
    CreateTime: createdAt,
    UpdateTime: createdAt,
  });
  replaceByIdentity(packageModel.DiyTables, table, ['Id', 'Name']);
}

function configureFields(packageModel) {
  const generated = fieldDefinitions.map((definition) => cloneField(packageModel, definition));
  packageModel.DiyFields = packageModel.DiyFields.filter((item) => (
    item.TableId !== changelogTableId && item.Id !== changelogFieldId
  ));
  packageModel.DiyFields.push(...generated);

  const template = packageModel.DiyFields.find((item) => item.Component === 'TableChild');
  assert(template, '应用商城包缺少 TableChild 字段模板');
  const childField = JSON.parse(JSON.stringify(template));
  const config = parseJson(childField.Config, {});
  Object.assign(config, {
    TableChildTableId: changelogTableId,
    TableChildSysMenuId: changelogMenuId,
    TableChildSysMenuName: '应用更新日志',
    TableChildFkFieldName: 'StoreId',
    TableChildCallbackField: '',
    TableChildRowClickV8: '',
  });
  config.TableChild = {
    ...(config.TableChild || {}),
    Data: [],
    SearchAppend: {},
    PrimaryTableFieldName: 'Id',
    DisablePagination: false,
    NoneDefaultHeight: false,
  };
  Object.assign(childField, {
    Id: changelogFieldId,
    TableId: storeTableId,
    TableName: 'sys_microistore',
    Label: '更新日志',
    Name: 'ChangeLogs',
    Type: '',
    Component: 'TableChild',
    Description: '每次创建、修改或升级应用都必须先填写与 AppVersion 完全一致的更新日志。',
    NotEmpty: 0,
    Visible: 1,
    AppVisible: 1,
    Readonly: 0,
    FormWidth: 24,
    TableWidth: 180,
    Sort: 4550,
    Tab: changelogTabId,
    Config: JSON.stringify(config),
    Data: '[]',
    BindRole: '[]',
    CreateTime: createdAt,
    UpdateTime: createdAt,
  });
  packageModel.DiyFields.push(childField);
}

function configureMenu(packageModel) {
  const template = packageModel.SysMenus.find((item) => item.Id === storeMenuId);
  assert(template, '应用商城包缺少主菜单模板');
  const menu = JSON.parse(JSON.stringify(template));
  const byName = new Map(
    packageModel.DiyFields
      .filter((field) => field.TableId === changelogTableId)
      .map((field) => [field.Name, field]),
  );
  const visibleNames = ['Version', 'Title', 'ChangeType', 'ReleaseTime', 'Content'];
  const searchNames = ['Version', 'Title', 'ChangeType', 'ReleaseTime'];
  const hiddenNames = ['OsClient', 'StoreId'];
  Object.assign(menu, {
    Id: changelogMenuId,
    ParentId: template.ParentId,
    Name: '应用更新日志',
    Description: '应用商城详情中的版本更新说明，仅作为 TableChild 配置入口。',
    Url: '/microi-store-changelog',
    Display: 0,
    AppDisplay: 0,
    HasChild: 0,
    DiyTableId: changelogTableId,
    Component: 'views/module-engine/index',
    TableDiyFieldIds: JSON.stringify(visibleNames.map((name) => fieldReference(byName.get(name)))),
    SelectFields: JSON.stringify(visibleNames.map((name) => fieldReference(byName.get(name)))),
    SearchFieldIds: JSON.stringify(searchNames.map((name) => fieldReference(byName.get(name)))),
    SortFieldIds: JSON.stringify(['ReleaseTime', 'Sort'].map((name) => fieldReference(byName.get(name)))),
    NotShowFields: JSON.stringify(hiddenNames.map((name) => fieldReference(byName.get(name)))),
    DefaultOrderBy: JSON.stringify([
      { Id: byName.get('ReleaseTime').Id, Name: 'ReleaseTime', Sort: 1, Type: 'DESC' },
      { Id: byName.get('Sort').Id, Name: 'Sort', Sort: 2, Type: 'ASC' },
    ]),
    PageBtns: '[]',
    MoreBtns: '[]',
    UpdateTime: createdAt,
  });
  replaceByIdentity(packageModel.SysMenus, menu, ['Id']);
}

function configureParentForm(packageModel) {
  const table = packageModel.DiyTables.find((item) => item.Id === storeTableId);
  assert(table, '应用商城包缺少 sys_microistore 表定义');
  const tabs = parseJson(table.Tabs, []);
  const existing = tabs.find((tab) => tab.Id === changelogTabId);
  const tab = existing || {};
  Object.assign(tab, {
    Name: '更新日志',
    EnName: 'changelog',
    Display: true,
    Sort: 2,
    Id: changelogTabId,
    Icon: 'Document',
    _RawName: '更新日志',
  });
  if (!existing) tabs.push(tab);
  tabs.sort((left, right) => Number(left.Sort || 0) - Number(right.Sort || 0));
  table.Tabs = JSON.stringify(tabs);

  const button = packageModel.DiyFields.find((item) => item.TableId === storeTableId && item.Name === 'BtnMakeApp');
  assert(button && typeof button.V8Code === 'string', '应用商城包缺少开始制作按钮');
  if (!button.V8Code.includes('MARKETPLACE_CHANGELOG_REQUIRED_V1')) {
    const anchor = "var packageVersion = V8.Form.AppVersion || V8.Form.PackageVersion || '1.0.0';";
    assert(button.V8Code.includes(anchor), '开始制作按钮缺少 packageVersion 锚点');
    const gate = [
      anchor,
      '// MARKETPLACE_CHANGELOG_REQUIRED_V1：任何应用制包前必须已有当前精确版本的完整更新日志。',
      "var normalizeReleaseVersion = function (value) {",
      "  var match = /^v?(\\d+)\\.(\\d+)\\.(\\d+)$/.exec(String(value || '').trim());",
      "  return match ? ('v' + parseInt(match[1], 10) + '.' + parseInt(match[2], 10) + '.' + parseInt(match[3], 10)) : '';",
      '};',
      "var storeId = String((V8.Form && V8.Form.Id) || '').trim();",
      'var releaseVersion = normalizeReleaseVersion(packageVersion);',
      "if (!storeId || !releaseVersion) {",
      "  V8.Tips('请先保存商城应用，并填写合法的 AppVersion（例如 v1.2.3）。', false);",
      '  return;',
      '}',
      "var releaseLogResult = await V8.FormEngine.GetFormData('sys_microistore_changelog', {",
      "  _Where: [['OsClient', '=', V8.OsClient], ['AND', 'StoreId', '=', storeId], ['AND', 'Version', '=', releaseVersion]],",
      "  _SelectFields: ['Id', 'OsClient', 'Title', 'ChangeType', 'Content', 'ReleaseTime', 'IsDeleted']",
      '});',
      'var releaseLog = releaseLogResult && releaseLogResult.Code == 1 ? releaseLogResult.Data : null;',
      "if (!releaseLog || releaseLog.IsDeleted == 1 || !String(releaseLog.Title || '').trim()",
      "    || !String(releaseLog.ChangeType || '').trim() || !String(releaseLog.Content || '').trim()",
      "    || !String(releaseLog.ReleaseTime || '').trim()) {",
      "  V8.Tips('请先在【更新日志】页签填写与 ' + releaseVersion + ' 完全一致的完整更新日志，再制作应用。', false);",
      '  return;',
      '}',
      'packageVersion = releaseVersion;',
    ].join('\n');
    button.V8Code = button.V8Code.replace(anchor, gate);
  }
  button.V8Code = button.V8Code
    .replace(
      "_Where: [['StoreId', '=', storeId], ['AND', 'Version', '=', releaseVersion]],",
      "_Where: [['OsClient', '=', V8.OsClient], ['AND', 'StoreId', '=', storeId], ['AND', 'Version', '=', releaseVersion]],",
    )
    .replace(
      "_SelectFields: ['Id', 'Title', 'ChangeType', 'Content', 'ReleaseTime', 'IsDeleted']",
      "_SelectFields: ['Id', 'OsClient', 'Title', 'ChangeType', 'Content', 'ReleaseTime', 'IsDeleted']",
    );
  assert(button.V8Code.includes("['OsClient', '=', V8.OsClient]"), '开始制作按钮缺少租户范围更新日志校验');
}

function configureSchema(packageModel) {
  const ddl = [
    'CREATE TABLE IF NOT EXISTS sys_microistore_changelog (',
    '  Id varchar(36) NOT NULL PRIMARY KEY,',
    "  CreateTime datetime NULL COMMENT '创建时间',",
    "  UpdateTime datetime NULL COMMENT '修改时间',",
    "  UserId varchar(36) NULL COMMENT '创建人Id',",
    "  UserName varchar(255) NULL COMMENT '创建人',",
    "  IsDeleted int NULL DEFAULT 0 COMMENT '是否已删除',",
    "  OsClient varchar(50) NOT NULL COMMENT '租户标识',",
    "  StoreId varchar(50) NOT NULL COMMENT '应用商城记录Id',",
    "  Version varchar(50) NOT NULL COMMENT '版本号',",
    "  Title varchar(200) NOT NULL COMMENT '更新标题',",
    "  ChangeType varchar(50) NOT NULL DEFAULT 'Feature' COMMENT '更新类型',",
    "  Content mediumtext NOT NULL COMMENT '更新内容',",
    "  ReleaseTime varchar(25) NOT NULL COMMENT '发布时间',",
    "  Sort int NULL DEFAULT 100 COMMENT '排序',",
    '  UNIQUE KEY ux_microistore_changelog_store_version (OsClient, StoreId, Version),',
    '  KEY ix_microistore_changelog_store_release (OsClient, StoreId, ReleaseTime)',
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;',
  ].join('\n');
  replaceByIdentity(packageModel.DDLStatements, {
    TableId: changelogTableId,
    TableName: 'sys_microistore_changelog',
    DDL: ddl,
  }, ['TableId', 'TableName']);

  const physicalColumns = [
    ['Id', 'varchar(36)', 'varchar', 'NO', null, 'Id', 'PRI', 1],
    ['CreateTime', 'datetime', 'datetime', 'YES', null, '创建时间', '', 2],
    ['UpdateTime', 'datetime', 'datetime', 'YES', null, '修改时间', '', 3],
    ['UserId', 'varchar(36)', 'varchar', 'YES', null, '创建人Id', '', 4],
    ['UserName', 'varchar(255)', 'varchar', 'YES', null, '创建人', '', 5],
    ['IsDeleted', 'int(11)', 'int', 'YES', '0', '是否已删除', '', 6],
    ['OsClient', 'varchar(50)', 'varchar', 'NO', null, '租户标识', 'MUL', 7],
    ['StoreId', 'varchar(50)', 'varchar', 'NO', null, '应用商城记录Id', 'MUL', 8],
    ['Version', 'varchar(50)', 'varchar', 'NO', null, '版本号', '', 9],
    ['Title', 'varchar(200)', 'varchar', 'NO', null, '更新标题', '', 10],
    ['ChangeType', 'varchar(50)', 'varchar', 'NO', 'Feature', '更新类型', '', 11],
    ['Content', 'mediumtext', 'mediumtext', 'NO', null, '更新内容', '', 12],
    ['ReleaseTime', 'varchar(25)', 'varchar', 'NO', null, '发布时间', '', 13],
    ['Sort', 'int(11)', 'int', 'YES', '100', '排序', '', 14],
  ].map(([name, columnType, dataType, nullable, defaultValue, comment, key, ordinal]) => ({
    TABLE_NAME: 'sys_microistore_changelog',
    COLUMN_NAME: name,
    COLUMN_TYPE: columnType,
    DATA_TYPE: dataType,
    IS_NULLABLE: nullable,
    COLUMN_DEFAULT: defaultValue,
    COLUMN_COMMENT: comment,
    COLUMN_KEY: key,
    EXTRA: '',
    ORDINAL_POSITION: ordinal,
  }));
  packageModel.PhysicalColumns = packageModel.PhysicalColumns.filter(
    (item) => item.TABLE_NAME !== 'sys_microistore_changelog',
  );
  packageModel.PhysicalColumns.push(...physicalColumns);
}

function updatePackageInfo(packageModel) {
  const info = packageModel.PackageInfo || (packageModel.PackageInfo = {});
  info.Version = 'v7.5.32';
  info.CreateTime = '2026-08-23T12:00:00.000Z';
  info.RequiredPlatformCapabilities = Array.from(new Set([
    ...(info.RequiredPlatformCapabilities || []).filter((capability) => (
      !String(capability).startsWith('ApiEngine:get-microi-store-model@')
      && !String(capability).startsWith('ApiEngine:ai_app_publish_store@')
    )),
    'Schema:MarketplaceChangeLogV1',
    'ApiEngine:get-microi-store-model@v1.2.9',
    'ApiEngine:ai_app_publish_store@v1.8.6',
    'Importer:ManagedApiEngineFlagPhysicalReconciliation',
    'Importer:ExistingMenuUrlCollisionRecovery',
  ]));
  const historyLine = '2026-08-23 v7.5.32 导入器在低代码字段元数据落后时参数化补正受管接口开关并二次严格回读；既有菜单 Url 冲突时保留租户当前唯一路由或生成安全后缀。';
  const previousChangeLogLine =
    '2026-08-23 v7.5.31 新增应用更新日志子表、商城详情时间线与精确版本发布门禁；所有应用类型发布前必须填写完整更新日志。';
  const isCurrentHistoryLine = (line) => String(line || '') === historyLine
    || String(line || '') === previousChangeLogLine;
  const oldHistory = typeof info.ChangeHistory === 'string'
    ? info.ChangeHistory.split(/\r?\n/).filter((line) => line && !isCurrentHistoryLine(line))
    : (Array.isArray(info.ChangeHistory)
        ? info.ChangeHistory
          .filter((item) => !isCurrentHistoryLine(item?.Description))
          .map((item) => [item.Date, item.Version, item.Description].filter(Boolean).join(' '))
        : []);
  info.ChangeHistory = [historyLine, previousChangeLogLine, ...oldHistory].join('\n') + '\n';
  info.MenuCount = packageModel.SysMenus.length;
  info.TableCount = packageModel.DiyTables.length;
  info.FieldCount = packageModel.DiyFields.length;
  info.DDLCount = packageModel.DDLStatements.length;
  info.PhysicalColumnCount = packageModel.PhysicalColumns.length;
  info.ApiEngineCount = (packageModel.SysApiEngines || []).length;
  info.DataSetCount = (packageModel.DataSets || []).length;
  info.DataRowCount = (packageModel.DataSets || []).reduce(
    (count, dataSet) => count + (Array.isArray(dataSet.Rows) ? dataSet.Rows.length : 0),
    0,
  );
}

async function main() {
  const packageModel = JSON.parse(await readFile(packagePath, 'utf8'));
  packageModel.DDLStatements ||= [];
  packageModel.PhysicalColumns ||= [];
  packageModel.SysMenus ||= [];
  packageModel.DiyTables ||= [];
  packageModel.DiyFields ||= [];
  configureTable(packageModel);
  configureFields(packageModel);
  configureMenu(packageModel);
  configureParentForm(packageModel);
  configureSchema(packageModel);
  const importer = (packageModel.SysApiEngines || []).find(
    (item) => item.ApiEngineKey === 'import-microi-store-package',
  );
  assert(importer, '应用商城包缺少统一应用导入器');
  const importerHistoryLine =
    '2026-08-23 20:10:00 v2.3.4 受管接口开关物理补正后二次严格回读；既有菜单 Url 冲突安全重试';
  importer.ChangeHistory = [
    importerHistoryLine,
    ...String(importer.ChangeHistory || '').split(/\r?\n/)
      .filter((line) => line && line !== importerHistoryLine),
  ].join('\n') + '\n';
  packageModel.ResourcePolicies ||= {};
  packageModel.ResourcePolicies.ApiEngines ||= {};
  packageModel.ResourcePolicies.ApiEngines['get-microi-store-model'] = {
    Ownership: 'Application',
    UpgradePolicy: 'Managed',
  };
  packageModel.ResourcePolicies.ApiEngines.ai_app_publish_store = {
    Ownership: 'Application',
    UpgradePolicy: 'Managed',
  };
  updatePackageInfo(packageModel);
  await writeFile(packagePath, JSON.stringify(packageModel, null, 2) + '\n', 'utf8');
  process.stdout.write(JSON.stringify({
    version: packageModel.PackageInfo.Version,
    tables: packageModel.DiyTables.length,
    fields: packageModel.DiyFields.length,
    menus: packageModel.SysMenus.length,
    ddls: packageModel.DDLStatements.length,
  }) + '\n');
}

await main();
