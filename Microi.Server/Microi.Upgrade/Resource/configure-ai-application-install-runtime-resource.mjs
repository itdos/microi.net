import { readFile, writeFile } from 'node:fs/promises';

import {
  advanceOfficialPackageVersion,
  validateOfficialPackageChangeLog,
} from './resource-sync-core.mjs';

const packageUrl = new URL('./app.microi.store.json', import.meta.url);
const packageName = 'app.microi.store.json';
const previousVersion = 'v7.9.0';
const targetVersion = 'v7.9.1';
const releaseTime = '2026-09-02 15:57:00';
const title = '应用新建安装目录长度兼容修复';
const changeType = 'Fix';
const content = '内嵌 microi-platform-service v1.9.7 / CurrentVersion 50，并保留 v7.9.0 的资源清单预检、菜单挂载选择、管理员权限与即时菜单刷新能力；导入器 v2.6.1 将新建安装目录的稳定 ModuleEngineKey 固定为46字符，兼容 sys_menu.ModuleEngineKey varchar(50) 的历史物理契约，修复目标租户创建父目录时 Data too long 导致事务回滚。';

const engineDefinitions = Object.freeze([
  Object.freeze({
    key: 'import-microi-store-package',
    source: 'import-package.js',
    version: 'v2.6.1',
  }),
  Object.freeze({
    key: 'get-microi-store-model',
    source: 'get-microi-store-model.js',
    version: 'v1.4.0',
  }),
  Object.freeze({
    key: 'get-microi-store',
    source: 'get-microi-store-list.js',
    version: 'v1.4.9',
  }),
]);
const featureCapabilities = Object.freeze([
  'ApiEngine:get-microi-store@v1.4.8',
  'Marketplace:PublicApplicationEntryUrlV1',
  'Installer:StandaloneApplicationLaunchMenuV1',
  'Installer:PackageRuntimeVersionSeparationV1',
  'Marketplace:InstalledApplicationPreviewV1',
  'Marketplace:PackageSummaryV1',
  'Installer:InstallParentMenuV1',
  'Installer:AdministratorMenuPermissionV1',
  'ClientFeature:MarketplaceMenuRefreshV1',
]);

function normalizeSource(value) {
  return `${String(value || '').replace(/\r\n?/g, '\n').replace(/\n*$/g, '')}\n`;
}

function synchronizeCapabilities(values) {
  let result = Array.isArray(values) ? [...values] : [];
  for (const definition of engineDefinitions) {
    const prefix = `ApiEngine:${definition.key}@`;
    result = result.filter(item => !String(item || '').startsWith(prefix));
    result.push(`${prefix}${definition.version}`);
  }
  for (const capability of featureCapabilities) {
    if (!result.includes(capability)) result.push(capability);
  }
  return result;
}

const packageModel = JSON.parse(await readFile(packageUrl, 'utf8'));
const packageInfo = packageModel.PackageInfo || (packageModel.PackageInfo = {});
const engines = new Map((packageModel.SysApiEngines || []).map(engine => [engine.ApiEngineKey, engine]));

for (const definition of engineDefinitions) {
  const engine = engines.get(definition.key);
  if (!engine) throw new Error(`app.microi.store.json 缺少 ${definition.key}`);
  const source = normalizeSource(await readFile(new URL(`./${definition.source}`, import.meta.url), 'utf8'));
  const sourceVersion = source.match(/Version\s*:\s*(v?\d+\.\d+\.\d+)/i)?.[1] || '';
  if (sourceVersion !== definition.version) {
    throw new Error(`${definition.source} 版本应为 ${definition.version}，实际为 ${sourceVersion || '(空)'}`);
  }
  engine.ApiV8Code = source;
  engine.Version = definition.version;
  const historyLine = `${releaseTime.substring(0, 10)} ${definition.version} ${content}`;
  engine.ChangeHistory = [
    historyLine,
    ...String(engine.ChangeHistory || '').split(/\r?\n/).filter(
      line => line && !line.includes(` ${definition.version} `),
    ),
  ].join('\n');
}

packageInfo.RequiredPlatformCapabilities = synchronizeCapabilities(
  packageInfo.RequiredPlatformCapabilities,
);
packageInfo.Capabilities = synchronizeCapabilities(packageInfo.Capabilities);

if (String(packageInfo.Version || '') === previousVersion) {
  packageInfo.ChangeLog = {
    ...packageInfo.ChangeLog,
    Title: title,
    ChangeType: changeType,
    Content: content,
  };
  advanceOfficialPackageVersion(packageInfo, targetVersion, releaseTime);
} else if (String(packageInfo.Version || '') === targetVersion) {
  packageInfo.ChangeLog = {
    Version: targetVersion,
    Title: title,
    ChangeType: changeType,
    Content: content,
    ReleaseTime: releaseTime,
  };
  const historyLine = `${releaseTime.substring(0, 10)} ${targetVersion} ${content}`;
  packageInfo.ChangeHistory = [
    historyLine,
    ...String(packageInfo.ChangeHistory || '').split(/\r?\n/).filter(
      line => line && !line.includes(` ${targetVersion} `),
    ),
  ].join('\n') + '\n';
} else {
  throw new Error(`只允许从 ${previousVersion} 提升到 ${targetVersion}，实际为 ${packageInfo.Version || '(空)'}`);
}

packageInfo.ApiEngineCount = (packageModel.SysApiEngines || []).length;
const output = `${JSON.stringify(packageModel, null, 2)}\n`;
validateOfficialPackageChangeLog(packageName, output);
await writeFile(packageUrl, output, 'utf8');
process.stdout.write(`${JSON.stringify({
  packageVersion: packageInfo.Version,
  engines: engineDefinitions.map(item => `${item.key}@${item.version}`),
  capabilities: featureCapabilities,
})}\n`);
