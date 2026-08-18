import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));

async function readPackage(name) {
  return JSON.parse(await readFile(resolve(directory, name), 'utf8'));
}

test('系统设置通过 ViewSchema 使用通用表单工作台并保留经典列表', async () => {
  const packageModel = await readPackage('app.microi.saas-engine.json');
  const menu = packageModel.SysMenus.find(item => item.Id === 'ea6b79e8-2c6b-4d0f-9b6a-44d01a3479bf');
  const schema = JSON.parse(menu.ViewSchema);
  const view = schema.Views.find(item => item.Scene === 'List' && item.Device === 'PC');

  assert.equal(view.Layout.Preset, 'FormWorkbench');
  assert.deepEqual(view.Layout.Form, {
    Presentation: 'SettingsCenter',
    Mode: 'Edit',
    ShowClassicList: true,
    RecordSelector: {
      Display: 'Both',
      LabelFields: ['PeizhiMC', 'SysTitle', 'ApiBase'],
      Placeholder: '选择要维护的系统配置'
    }
  });
  assert.equal(menu.OpenType, 'Diy');
  assert.match(menu.PageBtns, /登录与身份/);
});

test('应用商城统一入口由内置微服务承载', async () => {
  const packageModel = await readPackage('app.microi.store.json');
  const menu = packageModel.SysMenus.find(item => item.Id === '61b7faee-35b2-4571-add2-5231a355f368');

  assert.equal(menu.Url, '/microi-store');
  assert.equal(menu.LegacyMenuUrl, '/microi-store');
  assert.equal(menu.OpenType, 'MicroService');
  assert.equal(menu.IsMicroiService, 1);
  assert.equal(menu.ComponentPath, '/micro-app/host');
  assert.equal(menu.MicroServiceKey, 'microi-platform-service');
  assert.equal(menu.MicroServiceRoutePath, '/marketplace');
});

test('应用商城包独立交付菜单依赖的微服务运行时且菜单 Url 唯一', async () => {
  const packageModel = await readPackage('app.microi.store.json');
  const bundle = packageModel.ApplicationBundles.find(item => item.Application?.AppKey === 'microi-platform-service');
  const tableNames = new Set(packageModel.DiyTables.map(item => item.Name));
  const urls = packageModel.SysMenus.map(item => item.Url).filter(Boolean).map(item => item.toLowerCase());

  assert.ok(bundle);
  const marketplaceRoute = bundle.Routes.find(route => route.RoutePath === '/marketplace');
  assert.ok(marketplaceRoute);
  assert.ok(JSON.parse(marketplaceRoute.RouteMetaJson).LegacyMenuUrls.includes('/microi-store'));
  assert.ok(marketplaceRoute.LegacyMenuUrls.includes('/microi-store'));
  assert.equal(bundle.MicroService.StorageMode, 'db');
  assert.ok(bundle.BuildAssets.length > 0);
  assert.ok(tableNames.has('sys_microiservice'));
  assert.ok(tableNames.has('sys_microiservice_page'));
  assert.equal(new Set(urls).size, urls.length);
  assert.equal(packageModel.PackageInfo.AiApplicationCount, 1);
});

test('平台微服务包包含商城路由', async () => {
  const packageModel = await readPackage('app.microi.saas-engine.json');
  const bundle = packageModel.ApplicationBundles.find(item => item.Application?.AppKey === 'microi-platform-service');

  assert.ok(bundle);
  assert.ok(bundle.Routes.some(route => route.RoutePath === '/marketplace'));
  assert.equal(bundle.VersionNo, 'v1.6.0');
  assert.equal(bundle.Application.CurrentVersion, 18);
  assert.equal(bundle.MicroService.StorageMode, 'db');

  const saasMenu = packageModel.SysMenus.find(item => item.Id === '42078414-512a-4840-9843-9b75ab79ba79');
  const backupButton = JSON.parse(saasMenu.PageBtns).find(item => item.Id === 'database-backup-page-btn');
  assert.match(backupButton.V8Code, /Width: '80%'/);
  assert.match(backupButton.V8Code, /BodyHeight: 'min\(820px, calc\(100vh - 160px\)\)'/);
});

test('联邦商城包包含公开范围、私有凭据和历史版本契约', async () => {
  const packageModel = await readPackage('app.microi.store.json');
  const engines = new Map(packageModel.SysApiEngines.map(item => [item.ApiEngineKey, item]));
  const visibility = packageModel.DiyFields.find(item => item.TableName === 'sys_microistore' && item.Name === 'IsPublic');

  assert.equal(visibility.Component, 'Switch');
  assert.equal(visibility.DefaultValue, '1');
  assert.match(packageModel.DiyTables.find(item => item.Name === 'sys_microistore').SubmitBeforeServerV8, /MARKETPLACE_VISIBILITY_DEFAULT_V1/);
  assert.match(engines.get('get-microi-store').ApiV8Code, /ownedOnly/);
  assert.match(engines.get('get-microi-store').ApiV8Code, /V8\.Param\.Visibility/);
  assert.match(engines.get('get-microi-store-model').ApiV8Code, /delete row\.PrivateSourcePath/);
  assert.match(engines.get('get-microi-store-versions').ApiV8Code, /mic_data_version/);
  assert.match(engines.get('import-microi-store-package').ApiV8Code, /MARKETPLACE_PRIVATE_SOURCE_CREDENTIAL_V1/);
  assert.match(engines.get('import-microi-store-package').ApiV8Code, /StoreVersionId/);

  for (const [id, url] of [
    ['01KXFSG8153B3VZPZ45WNCCFHR', '/microi-store-installed'],
    ['01KXFSG7MZ40CY8KCWCZZZJH2M', '/microi-store-published'],
  ]) {
    const menu = packageModel.SysMenus.find(item => item.Id === id);
    assert.equal(menu.Display, 0);
    assert.equal(menu.AppDisplay, 0);
    assert.equal(menu.Url, url);
  }

  for (const [file, key] of [
    ['get-microi-store-list.js', 'get-microi-store'],
    ['get-microi-store-model.js', 'get-microi-store-model'],
    ['get-microi-store-versions.js', 'get-microi-store-versions'],
  ]) {
    const standalone = (await readFile(resolve(directory, file), 'utf8')).trim();
    assert.equal(engines.get(key).ApiV8Code.trim(), standalone);
  }
});

test('应用导入器前置校验菜单运行时并透传结构化失败详情', async () => {
  const importer = await readFile(resolve(directory, 'import-package.js'), 'utf8');
  const bulkImporter = await readFile(resolve(directory, 'bulk-import-packages.js'), 'utf8');

  assert.match(importer, /PACKAGE_MENU_RUNTIME_PREFLIGHT_V1/);
  assert.match(importer, /PACKAGE_BOUND_MICROSERVICE_MENU_V1/);
  assert.match(importer, /菜单 Url 重复/);
  assert.match(importer, /未交付对应 ApplicationBundle/);
  assert.match(importer, /Data: \{ Errors: packageMenuRuntimeContract\.Errors \}/);
  assert.match(bulkImporter, /BULK_STRUCTURED_CHILD_ERRORS_V1/);
  assert.match(bulkImporter, /normalizedKey == 'errors'/);
});

test('私有商城源由可信后端持有凭据且过期即失效', async () => {
  const controller = await readFile(resolve(directory, '../../Microi.net.Api/Controllers/MarketplaceSourceController.cs'), 'utf8');
  assert.match(controller, /RequireAdministratorAsync/);
  assert.match(controller, /TenantSystemSettingsSecurity\.ProtectSecret/);
  assert.match(controller, /ExpiresAtUtc\.Value <= DateTime\.UtcNow/);
  assert.match(controller, /_ClientType["']?\] = "MCP"/);
  assert.doesNotMatch(controller, /return\s+Json\([^\n]*credential\.Token/);
});

test('负向开关就地复用旧字段身份且数据包不再暴露旧名称', async () => {
  const formPackage = await readPackage('app.microi.form-engine.json');
  const saasPackage = await readPackage('app.microi.saas-engine.json');

  const tableMaskField = formPackage.DiyFields.find(item => item.Name === 'DisableFormMaskBlur');
  const aiAssistantField = saasPackage.DiyFields.find(item => item.Name === 'DisableAiAssistant');

  assert.equal(tableMaskField.Id, '01M071WPKYQBB7YVXJK3PN67FE');
  assert.equal(tableMaskField.DefaultValue, '0');
  assert.equal(aiAssistantField.Id, '01KYMC0EPFCNED4J6C45MF696X');
  assert.equal(aiAssistantField.DefaultValue, '0');
  assert.ok(!formPackage.DiyFields.some(item => item.Name === 'FormMaskBlur'));
  assert.ok(!saasPackage.DiyFields.some(item => item.Name === 'IsShowAiAssistant'));
});
