#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  advanceOfficialPackageVersion,
  normalizeOfficialPackageExecutionLimits,
  validateOfficialPackageChangeLog,
} from './resource-sync-core.mjs';

const packageUrl = new URL('./app.microi.store.json', import.meta.url);
const listUrl = new URL('./get-microi-store-list.js', import.meta.url);
const publisherUrl = new URL('./ai-app-publish-store.js', import.meta.url);
const eventUrl = new URL(
  '../../../Microi-V8-Engine/Microi%E5%90%BE%E7%A0%81%20(api.itdos.com)/iTdos.Product.Internal/'
    + '%E8%A1%A8%E5%8D%95%E5%BC%95%E6%93%8E/%E5%BA%94%E7%94%A8%E5%95%86%E5%9F%8E%EF%BC%88sys_microistore%EF%BC%89/'
    + '%E8%A1%A8%E5%8D%95V8%E4%BA%8B%E4%BB%B6/%E5%90%8E%E7%AB%AF%E8%A1%A8%E5%8D%95%E6%8F%90%E4%BA%A4%E5%89%8DV8%E4%BA%8B%E4%BB%B6%EF%BC%88SubmitBeforeServerV8%EF%BC%89.js',
  import.meta.url,
);

const packageName = 'app.microi.store.json';
const sourcePackageVersion = 'v7.9.20';
const targetPackageVersion = 'v7.9.21';
const listVersion = 'v1.5.0';
const publisherVersion = 'v1.9.24';
const eventVersion = 'v1.1.4';
const releaseTime = '2026-09-04 13:18:00';
const title = '平台应用通知稳定标识与坏行隔离修复';
const content = '商城列表 v1.5.0 对历史 AppId 缺失记录使用 AppKey 或 StoreId 稳定降级，单条缺版本记录显式标为版本异常，不再拖垮全部租户通知；发布器 v1.9.24 和 sys_microistore 提交前事件 v1.1.4 对称补齐 AppId/AppKey 并强回读，阻止同类脏数据再次产生；安装记录计算保留最新软删除状态。';

function canonicalSource(value) {
  return String(value || '').replace(/\r\n?/g, '\n').replace(/\n*$/, '\n');
}

function prependHistory(value, line, version) {
  const prior = String(value || '')
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(item => item && !item.includes(` ${version} `));
  return `${[line, ...prior].join('\n')}\n`;
}

function replaceCapabilities(values, replacements, additions) {
  const prior = Array.isArray(values) ? values : [];
  const filtered = prior.filter(value => !replacements.some(prefix => String(value || '').startsWith(prefix)));
  return [...new Set([...filtered, ...additions])];
}

const [listSource, publisherSource, eventSource] = await Promise.all([
  readFile(listUrl, 'utf8').then(canonicalSource),
  readFile(publisherUrl, 'utf8').then(canonicalSource),
  readFile(eventUrl, 'utf8').then(canonicalSource),
]);

if (!listSource.includes(`Version: ${listVersion}`)
    || !listSource.includes('MARKETPLACE_PLATFORM_NOTICE_ROW_ISOLATION_V1')
    || !listSource.includes('MARKETPLACE_STABLE_APPLICATION_IDENTITY_V1')) {
  throw new Error(`get-microi-store-list.js 必须为 ${listVersion} 并包含通知坏行隔离合同。`);
}
if (!publisherSource.includes(`Version: ${publisherVersion}`)
    || !publisherSource.includes('MARKETPLACE_STABLE_APPLICATION_IDENTITY_V1')
    || !publisherSource.includes('marketplaceIdentityReadbackMatches')) {
  throw new Error(`ai-app-publish-store.js 必须为 ${publisherVersion} 并包含稳定标识强回读合同。`);
}
if (!eventSource.includes(`Version: ${eventVersion}`)
    || !eventSource.includes('MARKETPLACE_STABLE_APPLICATION_IDENTITY_V1')) {
  throw new Error(`sys_microistore SubmitBeforeServerV8 必须为 ${eventVersion} 并包含稳定标识合同。`);
}

let packageModel = JSON.parse(await readFile(packageUrl, 'utf8'));
const packageInfo = packageModel.PackageInfo || (packageModel.PackageInfo = {});
if (packageInfo.Name !== '应用商城') throw new Error('应用商城官方包身份不正确。');
if (![sourcePackageVersion, targetPackageVersion].includes(String(packageInfo.Version || ''))) {
  throw new Error(`只允许从 ${sourcePackageVersion} 提升到 ${targetPackageVersion}，实际为 ${packageInfo.Version || '(空)'}`);
}

const engines = new Map((packageModel.SysApiEngines || []).map(engine => [engine.ApiEngineKey, engine]));
const listEngine = engines.get('get-microi-store');
const publisherEngine = engines.get('ai_app_publish_store');
if (!listEngine || !publisherEngine) throw new Error('应用商城包缺少通知列表或发布接口引擎。');

listEngine.ApiV8Code = listSource;
listEngine.Version = listVersion;
listEngine.UpdateTime = releaseTime;
listEngine.ChangeHistory = prependHistory(
  listEngine.ChangeHistory,
  `${releaseTime} ${listVersion} 平台应用通知补齐稳定标识、隔离单条坏数据并保留最新卸载状态`,
  listVersion,
);

publisherEngine.ApiV8Code = publisherSource;
publisherEngine.Version = publisherVersion;
publisherEngine.UpdateTime = releaseTime;
publisherEngine.ChangeHistory = prependHistory(
  publisherEngine.ChangeHistory,
  `${releaseTime} ${publisherVersion} 发布前补齐 AppId/AppKey 并在持久化后强回读`,
  publisherVersion,
);

const storeTable = (packageModel.DiyTables || []).find(table => table.Name === 'sys_microistore');
if (!storeTable) throw new Error('应用商城包缺少 sys_microistore 表定义。');
storeTable.SubmitBeforeServerV8 = eventSource;

const capabilityPrefixes = [
  'ApiEngine:get-microi-store@',
  'ApiEngine:ai_app_publish_store@',
];
const capabilities = [
  `ApiEngine:get-microi-store@${listVersion}`,
  `ApiEngine:ai_app_publish_store@${publisherVersion}`,
  'Marketplace:StableApplicationIdentityV1',
  'Marketplace:PlatformNoticeRowIsolationV1',
  'Marketplace:InstalledVersionTombstonePrecedenceV1',
  'ClientFeature:OfficialPlatformNoticeRowIsolationV1',
];
for (const field of ['RequiredPlatformCapabilities', 'Capabilities']) {
  packageInfo[field] = replaceCapabilities(packageInfo[field], capabilityPrefixes, capabilities);
}

if (String(packageInfo.Version) === sourcePackageVersion) {
  packageInfo.ChangeLog = {
    Version: sourcePackageVersion,
    Title: title,
    ChangeType: 'Fix',
    Content: content,
    ReleaseTime: packageInfo.ChangeLog?.ReleaseTime || releaseTime,
  };
  advanceOfficialPackageVersion(packageInfo, targetPackageVersion, releaseTime);
} else {
  packageInfo.ChangeLog = {
    Version: targetPackageVersion,
    Title: title,
    ChangeType: 'Fix',
    Content: content,
    ReleaseTime: releaseTime,
  };
  packageInfo.ChangeHistory = prependHistory(
    packageInfo.ChangeHistory,
    `${releaseTime.substring(0, 10)} ${targetPackageVersion} ${content}`,
    targetPackageVersion,
  );
}

packageInfo.ApiEngineCount = (packageModel.SysApiEngines || []).length;
packageModel = JSON.parse(normalizeOfficialPackageExecutionLimits(
  packageName,
  JSON.stringify(packageModel),
));
const output = `${JSON.stringify(packageModel, null, 2)}\n`;
validateOfficialPackageChangeLog(packageName, output);
await writeFile(fileURLToPath(packageUrl), output, 'utf8');

process.stdout.write(`${packageName}\t${packageInfo.Version}\t${listVersion}\t${publisherVersion}\t${eventVersion}\n`);
