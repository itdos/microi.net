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
const sourcePackageVersion = 'v7.9.22';
const targetPackageVersion = 'v7.9.23';
const importerVersion = 'v2.7.4';
const releaseTime = '2026-09-04 13:45:00';
const title = 'SQL Server 字段变更方言兼容修复';
const content = '导入器 v2.7.4 在 v2.7.3 物理结构方言映射基础上，补齐 SQL Server 字段重命名、类型变更及仅标签变化的安全处理；修复 MySQL CHANGE/MODIFY COLUMN 语法进入 SQL Server 导致官方应用包升级回滚。';
const capability = 'Importer:SqlServerPhysicalSchemaV1';

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
    || !importerSource.includes('runtimeIsSqlServer')
    || !importerSource.includes('readTargetPhysicalColumns')
    || !importerSource.includes('SQLSERVER_PHYSICAL_FIELD_CHANGE_V1')) {
  throw new Error(`import-package.js 必须先升级到 ${importerVersion} 并包含 SQL Server 方言合同。`);
}

let packageModel = JSON.parse(await readFile(packageUrl, 'utf8'));
const packageInfo = packageModel.PackageInfo || (packageModel.PackageInfo = {});
if (packageInfo.Name !== '应用商城') throw new Error('应用商城官方包身份不正确。');
if (![sourcePackageVersion, targetPackageVersion].includes(String(packageInfo.Version || ''))) {
  throw new Error(`只允许从 ${sourcePackageVersion} 提升到 ${targetPackageVersion}，实际为 ${packageInfo.Version || '(空)'}`);
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
  `${releaseTime} ${importerVersion} 增加 SQL Server 字段重命名、类型变更与元数据标签安全处理`,
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

packageInfo.ChangeLog = {
  Version: String(packageInfo.Version),
  Title: title,
  ChangeType: 'Fix',
  Content: content,
  ReleaseTime: releaseTime,
};
if (String(packageInfo.Version) === sourcePackageVersion) {
  advanceOfficialPackageVersion(packageInfo, targetPackageVersion, releaseTime);
}

packageInfo.ApiEngineCount = (packageModel.SysApiEngines || []).length;
packageModel = JSON.parse(normalizeOfficialPackageExecutionLimits(
  packageName,
  JSON.stringify(packageModel),
));
const output = `${JSON.stringify(packageModel, null, 2)}\n`;
validateOfficialPackageChangeLog(packageName, output);
await writeFile(fileURLToPath(packageUrl), output, 'utf8');

process.stdout.write(`${packageName}\t${packageInfo.Version}\t${importer.Version}\t${capability}\n`);
