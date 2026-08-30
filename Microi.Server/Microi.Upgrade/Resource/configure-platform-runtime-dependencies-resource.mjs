import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const packagePath = resolve(directory, 'app.microi.store.json');
const targetPackageVersion = 'v7.6.17';
const releaseTime = '2026-08-26 19:00:00';

const dependencies = Object.freeze([
  Object.freeze({
    key: 'get-microi-store-legacy-route',
    name: '获取应用商城列表（旧地址兼容）',
    source: 'get-microi-store-legacy-route.js',
    id: '019d2f00-0000-7a01-8000-000000000001',
    version: 'v1.0.1',
    apiAddress: '/apiengine/get-microi-store',
    category: '应用商城',
    enableLog: 0,
    lock: 0,
    allowAnonymous: 1,
    capabilities: [
      'ApiEngine:get-microi-store-legacy-route@v1.0.0',
      'Compatibility:LegacyMarketplaceListRouteV1',
    ],
  }),
  Object.freeze({
    key: 'get-microi-upgrade-resource',
    name: '获取与发布吾码升级资源',
    source: 'official-resource-api.js',
    id: '01KX2B5G1W8W4D4GRZHEV10H90',
    version: 'v1.3.4',
    apiAddress: '/apiengine/get-microi-upgrade-resource',
    category: '应用商城',
    enableLog: 0,
    lock: 0,
    allowAnonymous: 1,
    capabilities: [
      'V8.Method.AuthorizeOfficialResourcePublish',
      // Rolling control-plane upgrades are executed by the currently live
      // previous engine. Retain its exact capability marker until v1.3.4 has
      // been published and projected, while also declaring the new contract.
      'ApiEngine:get-microi-upgrade-resource@v1.3.2',
      'ApiEngine:get-microi-upgrade-resource@v1.3.3',
      'ApiEngine:get-microi-upgrade-resource@v1.3.4',
    ],
  }),
  Object.freeze({
    key: 'platform-background-task',
    name: '平台后台任务',
    source: 'platform-background-task.js',
    id: '97e9cc2f-a544-468c-b885-000000000013',
    version: 'v1.1.0',
    apiAddress: '/apiengine/platform-background-task',
    category: '平台内置',
    enableLog: 0,
    lock: 1,
    capabilities: [
      'ServerFeature:V8.ManageBackgroundTask',
      'ApiEngine:platform-background-task@v1.1.0',
    ],
  }),
  Object.freeze({
    key: 'platform-sys-menu',
    name: '平台系统菜单',
    source: 'platform-sys-menu.js',
    id: '9434a0ec-f360-4cb1-8adb-00f5fb879f53',
    version: 'v1.0.0',
    apiAddress: '/apiengine/platform-sys-menu',
    category: '系统/平台目录',
    enableLog: 1,
    lock: 0,
    capabilities: [
      'V8.Method.ManageSystemDirectory',
      'ApiEngine:platform-sys-menu@v1.0.1',
    ],
  }),
  Object.freeze({
    key: 'platform-marketplace-source',
    name: '平台应用商城源审计',
    source: 'platform-marketplace-source.js',
    id: '019d2a01-9d63-7f91-8c03-000000000001',
    version: 'v1.0.0',
    apiAddress: '/apiengine/platform-marketplace-source',
    category: '应用商城',
    enableLog: 1,
    lock: 0,
    stopHttp: 1,
    capabilities: [
      'ApiEngine:platform-marketplace-source@v1.0.0',
    ],
  }),
  Object.freeze({
    key: 'platform-marketplace-source-hook',
    name: '应用商城源个性化扩展',
    source: 'platform-marketplace-source-hook.js',
    id: '019d2a01-9d63-7f91-8c03-000000000002',
    version: 'v1.0.0',
    apiAddress: '/apiengine/platform-marketplace-source-hook',
    category: '应用商城',
    enableLog: 1,
    lock: 0,
    stopHttp: 1,
    ownership: 'Tenant',
    upgradePolicy: 'CreateIfMissing',
    capabilities: [
      'ApiEngine:platform-marketplace-source-hook@v1.0.0',
    ],
  }),
]);

function compareSemver(left, right) {
  const parse = value => String(value || '')
    .replace(/^v/i, '')
    .split('.')
    .slice(0, 3)
    .map(item => Number(item) || 0);
  const leftParts = parse(left);
  const rightParts = parse(right);
  for (let index = 0; index < 3; index += 1) {
    const delta = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function normalizeSource(value) {
  return `${String(value || '').replace(/\r\n?/g, '\n').replace(/\n*$/g, '')}\n`;
}

function appendUnique(values, value) {
  const result = Array.isArray(values) ? values : [];
  if (!result.includes(value)) result.push(value);
  return result;
}

const packageModel = JSON.parse(await readFile(packagePath, 'utf8'));
const engines = Array.isArray(packageModel.SysApiEngines) ? packageModel.SysApiEngines : [];
packageModel.SysApiEngines = engines;
// 当前用户界面偏好由“系统账号”应用唯一交付，商城不再保留 Managed 副本。
const preferenceIndex = engines.findIndex(item => item.ApiEngineKey === 'platform-user-update-preferences');
if (preferenceIndex >= 0) engines.splice(preferenceIndex, 1);
if (packageModel.ResourcePolicies?.ApiEngines) {
  delete packageModel.ResourcePolicies.ApiEngines['platform-user-update-preferences'];
}

for (const dependency of dependencies) {
  const sourceText = await readFile(resolve(directory, dependency.source), 'utf8');
  let engine = engines.find(item => item.ApiEngineKey === dependency.key);
  if (!engine) {
    engine = {
      IsDeleted: 0,
      UserName: '管理员',
      UserId: 'c74d669c-a3d4-11e5-b60d-b870f43edd03',
      UpdateTime: releaseTime,
      CreateTime: releaseTime,
      Id: dependency.id,
      ChangeHistory: '',
      Version: dependency.version,
      LimitRecursion: 5000,
      LimitMemory: 2048,
      MaxStatements: 100000000,
      Timeout: 600,
      StopHttp: dependency.stopHttp || 0,
      EnableLog: dependency.enableLog,
      Category: dependency.category,
      Files: '[]',
      AllowAnonymous: dependency.allowAnonymous || 0,
      ApiAddress: dependency.apiAddress,
      ResponseFile: 0,
      Lock: dependency.lock,
      V8Limit: 0,
      V8Unlimited: 1,
      ApiV8Code: '',
      ApiRole: '[]',
      IsEnable: 1,
      ApiEngineKey: dependency.key,
      ApiName: dependency.name,
    };
    engines.push(engine);
  }

  Object.assign(engine, {
    Version: dependency.version,
    ApiName: dependency.name,
    Category: dependency.category,
    ApiAddress: dependency.apiAddress,
    ApiV8Code: normalizeSource(sourceText),
    IsEnable: 1,
    StopHttp: dependency.stopHttp || 0,
    AllowAnonymous: dependency.allowAnonymous || 0,
    EnableLog: dependency.enableLog,
    Lock: dependency.lock,
    V8Limit: 0,
    V8Unlimited: 1,
  });

  const info = packageModel.PackageInfo || (packageModel.PackageInfo = {});
  for (const fieldName of ['RequiredPlatformCapabilities', 'Capabilities']) {
    info[fieldName] = (Array.isArray(info[fieldName]) ? info[fieldName] : []).filter(capability => (
      !String(capability).startsWith(`ApiEngine:${dependency.key}@`)
    ));
  }
  for (const capability of dependency.capabilities) {
    info.RequiredPlatformCapabilities = appendUnique(info.RequiredPlatformCapabilities, capability);
    info.Capabilities = appendUnique(info.Capabilities, capability);
  }

  const policies = packageModel.ResourcePolicies
    || (packageModel.ResourcePolicies = { SchemaVersion: 1 });
  policies.SchemaVersion = policies.SchemaVersion || 1;
  policies.ApiEngines = policies.ApiEngines || {};
  policies.ApiEngines[dependency.key] = {
    Ownership: dependency.ownership || 'Platform',
    UpgradePolicy: dependency.upgradePolicy || 'Managed',
  };
}

const info = packageModel.PackageInfo || (packageModel.PackageInfo = {});
const protocolCapabilities = [
  'ApiEngine:get-microi-store-model@v1.2.9',
  'ApiEngine:import-microi-store-package@v2.4.9',
  'Installer:StartupDependencyApiFastBootstrap',
  'Installer:StartupDependencyPreinstallBootstrapV1',
  'Installer:StartupApiRuntimeFlagReconciliation',
  'Marketplace:HdfsLegacyImporterBridgeV1',
];
for (const fieldName of ['RequiredPlatformCapabilities', 'Capabilities']) {
  info[fieldName] = Array.from(new Set([
    ...(Array.isArray(info[fieldName]) ? info[fieldName] : []).filter(capability => (
      !String(capability).startsWith('ApiEngine:get-microi-store-model@')
      && !String(capability).startsWith('ApiEngine:import-microi-store-package@')
      && String(capability) !== 'Installer:StartupDependencyApiFastBootstrap'
      && String(capability) !== 'Installer:StartupDependencyPreinstallBootstrapV1'
      && String(capability) !== 'Installer:StartupApiRuntimeFlagReconciliation'
      && String(capability) !== 'Marketplace:HdfsLegacyImporterBridgeV1'
      && String(capability) !== 'ApiEngine:platform-user-update-preferences'
    )),
    ...protocolCapabilities,
  ]));
}
if (compareSemver(info.Version, targetPackageVersion) < 0) info.Version = targetPackageVersion;
info.ApiEngineCount = engines.length;

if (info.Version === targetPackageVersion) {
  info.ChangeLog = {
    Version: targetPackageVersion,
    Title: '官方接口闭包发布控制面自举修复',
    ChangeType: 'Fix',
    Content: '官方资源发布控制面先兼容消息通知新增 wechat_send_tpl_msg，再原子发布九个应用包和 106 个接口引擎投影；同时保留 WebOS 菜单统一迁移与应用商城 CreateIfMissing 个性化 Hook。',
    ReleaseTime: releaseTime,
  };
  const historyLine = '2026-08-26 v7.6.17 官方资源控制面支持消息通知七接口闭包的两阶段安全自举，并保留 WebOS 菜单统一迁移与应用商城个性化 Hook。';
  const history = String(info.ChangeHistory || '');
  if (!history.includes(historyLine)) info.ChangeHistory = `${historyLine}\n${history}`;
}

await writeFile(packagePath, `${JSON.stringify(packageModel, null, 2)}\n`, 'utf8');
