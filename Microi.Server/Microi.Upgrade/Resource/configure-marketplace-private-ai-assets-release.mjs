import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  advanceOfficialPackageVersion,
  validateOfficialPackageChangeLog,
} from './resource-sync-core.mjs';

const packageUrl = new URL('./app.microi.store.json', import.meta.url);
const packageName = 'app.microi.store.json';
const previousVersion = 'v7.7.32';
const targetVersion = 'v7.7.33';
const releaseTime = '2026-09-01 20:46:58';
const title = 'AI 应用源码私有交付与安装快照修复';
const changeType = 'Fix';
const content = '源码 ZIP 统一写入吾码官方 HDFS 私有桶，公开应用的编译 ZIP 保持公有、私有应用的编译 ZIP 改为私有；商城源按所选 AppKey 临时签名私有资产，安装器兼容历史 Path 并强校验应用与版本身份，修复跨租户 ZIP 地址解析失败和错包风险。';

const engineCapabilities = new Map([
  ['ApiEngine:import-microi-store-package@', 'ApiEngine:import-microi-store-package@v2.5.4'],
  ['ApiEngine:get-microi-store-model@', 'ApiEngine:get-microi-store-model@v1.3.0'],
  ['ApiEngine:ai_app_prepare_store_assets@', 'ApiEngine:ai_app_prepare_store_assets@v1.2.0'],
  ['ApiEngine:ai_app_publish_store@', 'ApiEngine:ai_app_publish_store@v1.9.14'],
]);
const featureCapabilities = [
  'Marketplace:PrivateApplicationSourceArchiveV1',
  'Marketplace:ApplicationAssetSignedDownloadV1',
  'Marketplace:PackageIdentityBindingV1',
  'Marketplace:ApplicationBuildVisibilityV1',
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
