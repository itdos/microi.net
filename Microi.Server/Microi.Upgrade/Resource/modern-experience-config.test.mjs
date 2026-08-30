import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));

async function readPackage(name) {
  return JSON.parse(await readFile(resolve(directory, name), 'utf8'));
}

test('官方平台应用包的 PC 复合列默认保持紧凑双行', async () => {
  for (const name of [
    'app.microi.form-engine.json',
    'app.microi.module-engine.json',
    'app.microi.saas-engine.json',
    'app.microi.store.json',
  ]) {
    const packageModel = await readPackage(name);
    for (const menu of packageModel.SysMenus || []) {
      if (!menu.ViewSchema) continue;
      const schema = typeof menu.ViewSchema === 'string' ? JSON.parse(menu.ViewSchema) : menu.ViewSchema;
      for (const view of schema.Views || []) {
        if (String(view.Scene || '').toLowerCase() !== 'list') continue;
        const device = String(view.Device || 'All').toLowerCase();
        if (device !== 'pc' && device !== 'all') continue;
        for (const column of view?.Layout?.List?.Columns || []) {
          assert.ok(
            !Array.isArray(column.Lines) || column.Lines.length <= 1,
            `${name}/${menu.Name || menu.Id} must use at most one secondary line`,
          );
        }
      }
    }
  }
});

test('系统设置的模块 ViewSchema 不再保存表单工作台配置', async () => {
  const packageModel = await readPackage('app.microi.saas-engine.json');
  const menu = packageModel.SysMenus.find(item => item.Id === 'ea6b79e8-2c6b-4d0f-9b6a-44d01a3479bf');
  const schema = JSON.parse(menu.ViewSchema);
  const view = schema.Views.find(item => item.Scene === 'List' && item.Device === 'PC');

  assert.notEqual(String(view.Layout.Preset || '').toLowerCase(), 'formworkbench');
  assert.equal(view.Layout.Form, undefined);
  const table = packageModel.DiyTables.find(item => item.Id === 'c8570fa6-c10f-4014-8cb4-4b046e7ba69c');
  const presentation = JSON.parse(table.FormPresentation);
  assert.equal(presentation.Presentation, 'ControlCenter');
  assert.equal(Object.hasOwn(presentation, 'OpenFirstRecord'), false);
  assert.equal(menu.OpenFirstRecord, 1);
  assert.equal(presentation.NavigationTitle, '配置分组');
  assert.deepEqual(presentation.RecordSelector.LabelFields, ['PeizhiMC', 'SysTitle', 'ApiBase']);
  assert.equal(menu.OpenType, 'Diy');
  assert.match(menu.PageBtns, /安全与服务接入/);
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
  const storePackageModel = await readPackage('app.microi.store.json');
  const sourcePackageModel = JSON.parse(await readFile(
    resolve(directory, '../../../AI-Project/microi/AI应用/microi-platform-service/package.json'),
    'utf8',
  ));
  const bundle = packageModel.ApplicationBundles.find(item => item.Application?.AppKey === 'microi-platform-service');
  const storeBundle = storePackageModel.ApplicationBundles.find(item => item.Application?.AppKey === 'microi-platform-service');

  assert.ok(bundle);
  assert.ok(storeBundle);
  assert.ok(bundle.Routes.some(route => route.RoutePath === '/marketplace'));
  assert.equal(bundle.VersionNo, `v${sourcePackageModel.version}`);
  assert.equal(bundle.Application.CurrentVersion, storeBundle.Application.CurrentVersion);
  assert.ok(Number.isInteger(bundle.Application.CurrentVersion) && bundle.Application.CurrentVersion > 0);
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
  assert.match(engines.get('get-microi-store-model').ApiV8Code, /delete plain\.PrivateSourcePath/);
  assert.match(engines.get('get-microi-store-model').ApiV8Code, /MARKETPLACE_PINNED_INSTALL_SNAPSHOT_V1/);
  assert.match(engines.get('get-microi-store').ApiV8Code, /BULK_PLATFORM_BOOTSTRAP_ORDER_V1/);
  const versionsEngine = engines.get('get-microi-store-versions');
  assert.match(versionsEngine.ApiV8Code, /mic_data_version/);
  assert.equal(versionsEngine.Version, 'v1.1.2');
  assert.match(versionsEngine.ApiV8Code, /PaginationVersion:\s*1/);
  assert.match(versionsEngine.ApiV8Code, /V8\.Param\._PageIndex/);
  assert.match(versionsEngine.ApiV8Code, /V8\.Param\._PageSize/);
  assert.match(versionsEngine.ApiV8Code, /V8\.Param\._Keyword/);
  assert.match(versionsEngine.ApiV8Code, /_PageSize:\s*pageSize/);
  assert.doesNotMatch(versionsEngine.ApiV8Code, /_PageSize:\s*500/);
  assert.match(engines.get('import-microi-store-package').ApiV8Code, /MARKETPLACE_PRIVATE_SOURCE_CREDENTIAL_V1/);
  assert.match(engines.get('import-microi-store-package').ApiV8Code, /StoreVersionId/);
  assert.match(engines.get('import-microi-store-package').ApiV8Code, /PACKAGE_REPLAY_VERSION_GUARD_V2/);
  assert.match(engines.get('bulk-import-microi-store-packages').ApiV8Code, /prioritizeBootstrapPlan/);

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
    const normalizeLineEndings = value => String(value || '').replace(/\r\n/g, '\n').trim();
    assert.equal(normalizeLineEndings(engines.get(key).ApiV8Code), normalizeLineEndings(standalone));
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
  const runtime = await readFile(resolve(directory, '../../Microi.net/Marketplace/MarketplaceSourceRuntime.cs'), 'utf8');
  assert.match(runtime, /RequireAdministratorAsync/);
  assert.match(runtime, /TenantSystemSettingsSecurity\.ProtectSecret/);
  assert.match(runtime, /ExpiresAtUtc\.Value <= DateTime\.UtcNow/);
  assert.match(runtime, /\["_ClientType"\] = "MCP"/);
  assert.doesNotMatch(runtime, /return\s+Json\([^\n]*credential\.Token/);
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
