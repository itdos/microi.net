import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  advanceOfficialPackageVersion,
  validateOfficialPackageChangeLog,
} from './resource-sync-core.mjs';

const packageUrl = new URL('./app.microi.store.json', import.meta.url);
const packageName = 'app.microi.store.json';
const previousVersion = 'v7.8.4';
const targetVersion = 'v7.8.5';
const releaseTime = '2026-09-02 02:31:15';
const title = '旧租户私有源码安装兼容修复';
const changeType = 'Fix';
const content = '商城详情接口在不修改不可变快照的前提下，为旧版安装器返回包副本中的官方私有 ZIP 临时签名地址；修复尚未升级应用商城的租户安装官方 AI 应用时把源站私有路径交给本租户签名、进而误报源码 ZIP SHA256 校验失败的问题。';

const engineCapabilities = new Map([
  ['ApiEngine:import-microi-store-package@', 'ApiEngine:import-microi-store-package@v2.5.4'],
  ['ApiEngine:get-microi-store-model@', 'ApiEngine:get-microi-store-model@v1.3.1'],
  ['ApiEngine:ai_app_prepare_store_assets@', 'ApiEngine:ai_app_prepare_store_assets@v1.2.0'],
  ['ApiEngine:ai_app_publish_store@', 'ApiEngine:ai_app_publish_store@v1.9.23'],
]);
const featureCapabilities = [
  'Marketplace:PrivateApplicationSourceArchiveV1',
  'Marketplace:ApplicationAssetSignedDownloadV1',
  'Marketplace:PackageIdentityBindingV1',
  'Marketplace:ApplicationBuildVisibilityV1',
  'Marketplace:LegacyPrivateAssetUrlBridgeV1',
];

function synchronizeCapabilities(values) {
  let result = Array.isArray(values) ? [...values] : [];
  for (const [prefix, capability] of engineCapabilities) {
    result = result.filter(item => !String(item || '').startsWith(prefix));
    result.push(capability);
  }
  for (const capability of featureCapabilities) {
    if (!result.includes(capability)) result.push(capability);
  }
  return result;
}

const packageModel = JSON.parse(await readFile(packageUrl, 'utf8'));
const packageInfo = packageModel.PackageInfo || {};
const engines = new Map((packageModel.SysApiEngines || []).map(engine => [engine.ApiEngineKey, engine]));
const modelEngineSource = (await readFile(new URL('./get-microi-store-model.js', import.meta.url), 'utf8'))
  .replace(/\r\n?/g, '\n');
const modelEngine = engines.get('get-microi-store-model');
const modelEngineVersion = modelEngineSource.match(/Version\s*:\s*(v?\d+\.\d+\.\d+)/i);
if (!modelEngine || !modelEngineVersion) {
  throw new Error('缺少 get-microi-store-model 内嵌接口或独立源码版本声明');
}
modelEngine.ApiV8Code = modelEngineSource;
modelEngine.Version = modelEngineVersion[1].startsWith('v')
  ? modelEngineVersion[1]
  : `v${modelEngineVersion[1]}`;
for (const capability of engineCapabilities.values()) {
  const [key, version] = capability.substring('ApiEngine:'.length).split('@');
  if (String(engines.get(key)?.Version || '') !== version) {
    throw new Error(`${key} 内嵌版本必须为 ${version}，实际为 ${engines.get(key)?.Version || '(空)'}`);
  }
}

packageInfo.RequiredPlatformCapabilities = synchronizeCapabilities(packageInfo.RequiredPlatformCapabilities);
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
  const historyItem = { Version: targetVersion, Date: releaseTime.substring(0, 10), Description: content };
  packageInfo.ChangeHistory = Array.isArray(packageInfo.ChangeHistory)
    ? [historyItem, ...packageInfo.ChangeHistory.filter(item => String(item?.Version || '') !== targetVersion)]
    : `${releaseTime.substring(0, 10)} ${targetVersion} ${content}\n${String(packageInfo.ChangeHistory || '').replace(/^\s+/, '')}`;
} else {
  throw new Error(`只允许从 ${previousVersion} 提升到 ${targetVersion}，实际为 ${packageInfo.Version || '(空)'}`);
}

const output = `${JSON.stringify(packageModel, null, 2)}\n`;
validateOfficialPackageChangeLog(packageName, output);
await writeFile(fileURLToPath(packageUrl), output, 'utf8');
process.stdout.write(`${packageName}\t${packageInfo.Version}\t${title}\n`);
