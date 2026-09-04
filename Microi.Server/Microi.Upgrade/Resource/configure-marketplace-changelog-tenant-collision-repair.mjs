#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  advanceOfficialPackageVersion,
  normalizeOfficialPackageExecutionLimits,
  validateOfficialPackageChangeLog,
} from './resource-sync-core.mjs';

const packageUrl = new URL('./app.microi.store.json', import.meta.url);
const importerUrl = new URL('./import-package.js', import.meta.url);
const packageName = 'app.microi.store.json';
const sourcePackageVersion = 'v7.9.19';
const targetPackageVersion = 'v7.9.20';
const importerVersion = 'v2.7.2';
const releaseTime = '2026-09-04 09:00:00';
const title = '升级日志租户回填唯一键冲突修复';
const content = '导入器 v2.7.2 在 sys_microistore_changelog.OsClient 收紧为非空前，按目标租户与 StoreId、Version 确定性归并历史空租户重复记录，再参数化回填并强回读；修复 ux_microistore_changelog_store_version 重复键导致升级13整包回滚，并增加5000条上限、并发删除计数和幂等复跑门禁。';
const marker = 'MARKETPLACE_CHANGELOG_TENANT_COLLISION_REPAIR_V1';
const capability = 'Importer:MarketplaceChangelogTenantCollisionRepairV1';

function replaceVersionedCapability(values, prefix, nextValue) {
  return [
    ...(Array.isArray(values) ? values : [])
      .filter(value => !String(value || '').startsWith(prefix)),
    nextValue,
  ];
}

function appendUnique(values, additions) {
  return Array.from(new Set([...(Array.isArray(values) ? values : []), ...additions]));
}

function prependOnce(value, line) {
  const lines = String(value || '').split(/\r?\n/).filter(Boolean);
  return `${[line, ...lines.filter(item => item !== line)].join('\n')}\n`;
}

const importerSource = (await readFile(importerUrl, 'utf8'))
  .replace(/\r\n?/g, '\n')
  .replace(/\n*$/, '\n');
if (!importerSource.includes(`Version: ${importerVersion}`)
    || !importerSource.includes(marker)
    || !importerSource.includes('PHYSICAL_NOT_NULL_TENANT_BACKFILL_V1')) {
  throw new Error(`import-package.js 必须先升级到 ${importerVersion} 并包含更新日志冲突修复合同。`);
}

let packageModel = JSON.parse(await readFile(packageUrl, 'utf8'));
const packageInfo = packageModel.PackageInfo || (packageModel.PackageInfo = {});
if (packageInfo.Name !== '应用商城') throw new Error('应用商城官方包身份不正确。');
if (![sourcePackageVersion, targetPackageVersion].includes(String(packageInfo.Version || ''))) {
  throw new Error(
    `只允许从 ${sourcePackageVersion} 提升到 ${targetPackageVersion}，实际为 ${packageInfo.Version || '(空)'}`,
  );
}

const importer = (packageModel.SysApiEngines || []).find(
  engine => engine.ApiEngineKey === 'import-microi-store-package',
);
if (!importer) throw new Error('应用商城包缺少 import-microi-store-package。');
importer.ApiV8Code = importerSource;
importer.Version = importerVersion;
importer.UpdateTime = releaseTime;
importer.ChangeHistory = prependOnce(
  importer.ChangeHistory,
  `${releaseTime} ${importerVersion} 修复更新日志租户回填唯一键冲突并增加强回读`,
);

for (const fieldName of ['RequiredPlatformCapabilities', 'Capabilities']) {
  packageInfo[fieldName] = appendUnique(
    replaceVersionedCapability(
      packageInfo[fieldName],
      'ApiEngine:import-microi-store-package@',
      `ApiEngine:import-microi-store-package@${importerVersion}`,
    ),
    [capability],
  );
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
  packageInfo.ChangeHistory = prependOnce(
    packageInfo.ChangeHistory,
    `${releaseTime.substring(0, 10)} ${targetPackageVersion} ${content}`,
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

process.stdout.write(`${packageName}\t${packageInfo.Version}\t${importer.Version}\t${marker}\n`);
