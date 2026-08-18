#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const resourceDirectory = dirname(fileURLToPath(import.meta.url));
const packagePath = resolve(resourceDirectory, 'app.microi.store.json');
const storeTableId = '6cf254f1-edd0-4f04-96bc-c9ad08b5a2c1';
const visibilityFieldId = 'a4000100-0000-4000-8000-000000000101';
const versionsEngineId = 'a4000100-0000-4000-8000-000000000102';
const deprecatedStandaloneMenuIds = new Set([
  '01KXFSG8153B3VZPZ45WNCCFHR',
  '01KXFSG7MZ40CY8KCWCZZZJH2M',
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function addVisibilityColumn(packageModel) {
  const ddl = (packageModel.DDLStatements || []).find(item => item.TableName === 'sys_microistore');
  assert(ddl && typeof ddl.DDL === 'string', '应用商城包缺少 sys_microistore DDL');
  if (!/`IsPublic`\s+/i.test(ddl.DDL)) {
    const anchor = "  `PublisherType` varchar(50) NULL COMMENT '发布者来源',";
    assert(ddl.DDL.includes(anchor), 'sys_microistore DDL 缺少 PublisherType 锚点');
    ddl.DDL = ddl.DDL.replace(
      anchor,
      "  `IsPublic` int NOT NULL DEFAULT 1 COMMENT '公开应用',\n" + anchor,
    );
  }

  const columns = Array.isArray(packageModel.PhysicalColumns) ? packageModel.PhysicalColumns : [];
  packageModel.PhysicalColumns = columns;
  if (!columns.some(item => item.TABLE_NAME === 'sys_microistore' && item.COLUMN_NAME === 'IsPublic')) {
    const tableColumns = columns.filter(item => item.TABLE_NAME === 'sys_microistore');
    const maxOrdinal = tableColumns.reduce(
      (maximum, item) => Math.max(maximum, Number(item.ORDINAL_POSITION) || 0),
      0,
    );
    columns.push({
      TABLE_NAME: 'sys_microistore',
      COLUMN_NAME: 'IsPublic',
      COLUMN_TYPE: 'int(11)',
      DATA_TYPE: 'int',
      IS_NULLABLE: 'NO',
      COLUMN_DEFAULT: '1',
      COLUMN_COMMENT: '公开应用',
      COLUMN_KEY: '',
      EXTRA: '',
      ORDINAL_POSITION: maxOrdinal + 1,
    });
  }
}

function addVisibilityField(packageModel) {
  const fields = Array.isArray(packageModel.DiyFields) ? packageModel.DiyFields : [];
  packageModel.DiyFields = fields;
  if (fields.some(item => item.TableId === storeTableId && item.Name === 'IsPublic')) return;

  const switchTemplate = fields.find(item => item.TableId === storeTableId && item.Component === 'Switch');
  assert(switchTemplate, '应用商城包缺少可复用的 Switch 字段模板');
  const field = JSON.parse(JSON.stringify(switchTemplate));
  Object.assign(field, {
    Id: visibilityFieldId,
    TableId: storeTableId,
    TableName: 'sys_microistore',
    Name: 'IsPublic',
    Label: '公开应用',
    Type: 'int',
    Component: 'Switch',
    Visible: 1,
    AppVisible: 1,
    Readonly: 0,
    IsLockField: 0,
    NameConfirm: 1,
    NotEmpty: 0,
    DefaultValue: '1',
    FormWidth: 12,
    TableWidth: 100,
    Sort: 1250,
    BindRole: '[]',
    Data: '[]',
    Description: '开启后无需登录即可被其它商城源发现和安装；关闭后只有已登录并持有该来源私有权限的用户可见。',
    CreateTime: '2026-08-18 00:00:00',
  });
  fields.push(field);
}

function upgradeStoreTableEvent(packageModel) {
  const table = (packageModel.DiyTables || []).find(item => item.Id === storeTableId);
  assert(table, '应用商城包缺少 sys_microistore 表定义');
  let code = String(table.SubmitBeforeServerV8 || '');
  if (!code.includes('MARKETPLACE_VISIBILITY_DEFAULT_V1')) {
    const anchor = "var action = String(V8.FormSubmitAction || '');";
    assert(code.includes(anchor), 'sys_microistore SubmitBeforeServerV8 缺少 action 锚点');
    code = code.replace(
      anchor,
      `${anchor}\n// MARKETPLACE_VISIBILITY_DEFAULT_V1：兼容旧包，新增应用默认公开；更新时不覆盖既有选择。\nif ((action === 'Insert' || action === 'Add') && !hasOwn(V8.Form, 'IsPublic')) {\n    V8.Form.IsPublic = 1;\n}`,
    );
    code = code.replace('Version: v1.0.1', 'Version: v1.1.0');
    table.SubmitBeforeServerV8 = code;
  }
}

function addVersionsEngine(packageModel) {
  const engines = Array.isArray(packageModel.SysApiEngines) ? packageModel.SysApiEngines : [];
  packageModel.SysApiEngines = engines;
  if (engines.some(item => item.ApiEngineKey === 'get-microi-store-versions')) return;

  const template = engines.find(item => item.ApiEngineKey === 'get-microi-store-model');
  assert(template, '应用商城包缺少 get-microi-store-model 接口模板');
  const engine = JSON.parse(JSON.stringify(template));
  Object.assign(engine, {
    Id: versionsEngineId,
    ApiEngineKey: 'get-microi-store-versions',
    ApiName: '[系统]获取应用商城历史版本',
    ApiAddress: '/apiengine/get-microi-store-versions',
    ApiV8Code: '/*\n * ApiEngineKey: get-microi-store-versions\n * Version: v1.0.0\n */\nreturn { Code: 0, Msg: "应用商城历史版本接口尚未同步" };',
    Version: 'v1.0.0',
    AllowAnonymous: 1,
    StopHttp: 0,
    EnableLog: 0,
    Timeout: 600,
    LimitMemory: 2048,
    UpdateTime: '2026-08-18 00:00:00',
    CreateTime: '2026-08-18 00:00:00',
  });
  engines.push(engine);
}

function upgradeLegacyMenus(packageModel) {
  for (const menu of packageModel.SysMenus || []) {
    if (deprecatedStandaloneMenuIds.has(String(menu.Id || ''))) {
      // 保留资源 Id 以让已安装租户收到升级，但停用独立菜单/路由。功能统一在 /microi-store 内完成。
      menu.Display = 0;
      menu.AppDisplay = 0;
      menu.Url = '/microi-store';
      menu.Description = '已合并到统一应用商城页面；保留本资源仅用于升级旧租户。';
    }

    if (String(menu.Url || '') !== '/microi-store' || !menu.PageBtns) continue;
    let buttons;
    try {
      buttons = typeof menu.PageBtns === 'string' ? JSON.parse(menu.PageBtns) : menu.PageBtns;
    } catch (error) {
      throw new Error(`应用商城 PageBtns 不是有效 JSON：${error.message}`);
    }
    for (const button of buttons || []) {
      if (button.Id !== '01KAPPSTOREPAGEEXPORT000001') continue;
      let code = String(button.V8Code || '');
      code = code.replace("DialogType: 'Drawer'", "DialogType: 'Dialog'");
      code = code.replace("Width: '980px'", "Width: '80%'");
      code = code.replace(
        "SelectFields: ['AppName', 'AppVersion', 'ApplicationType'",
        "SelectFields: ['AppName', 'AppVersion', 'ApplicationType', 'Category', 'IsPublic', 'AppPreview', 'AppDetail'",
      );
      code = code.replace(
        "DefaultValues: { AppVersion: '1.0.0', ApplicationType: 'Regular'",
        "DefaultValues: { AppVersion: '1.0.0', ApplicationType: 'Regular', Category: 'other', IsPublic: 1",
      );
      button.V8Code = code;
    }
    menu.PageBtns = JSON.stringify(buttons || []);
  }
}

function updatePackageInfo(packageModel) {
  const info = packageModel.PackageInfo || (packageModel.PackageInfo = {});
  info.Version = 'v7.4.2';
  info.CreateTime = '2026-08-18T00:00:00.000Z';
  info.MenuCount = (packageModel.SysMenus || []).length;
  info.TableCount = (packageModel.DiyTables || []).length;
  info.FieldCount = (packageModel.DiyFields || []).length;
  info.DDLCount = (packageModel.DDLStatements || []).length;
  info.PhysicalColumnCount = (packageModel.PhysicalColumns || []).length;
  info.ApiEngineCount = (packageModel.SysApiEngines || []).length;
}

async function main() {
  const packageModel = JSON.parse(await readFile(packagePath, 'utf8'));
  addVisibilityColumn(packageModel);
  addVisibilityField(packageModel);
  upgradeStoreTableEvent(packageModel);
  addVersionsEngine(packageModel);
  upgradeLegacyMenus(packageModel);
  updatePackageInfo(packageModel);
  await writeFile(packagePath, `${JSON.stringify(packageModel, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `MARKETPLACE_FEDERATION_PACKAGE_UPGRADED fields=${packageModel.DiyFields.length} engines=${packageModel.SysApiEngines.length}\n`,
  );
}

await main();
