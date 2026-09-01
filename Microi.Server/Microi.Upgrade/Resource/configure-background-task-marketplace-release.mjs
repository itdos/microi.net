import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  advanceOfficialPackageVersion,
  validateOfficialPackageChangeLog,
} from './resource-sync-core.mjs';

const packageUrl = new URL('./app.microi.store.json', import.meta.url);
const packageName = 'app.microi.store.json';
const targetVersion = 'v7.7.32';
const releaseTime = '2026-09-01 19:45:00';
const title = '后台任务隔离调度与安全发布';
const changeType = 'Performance';
const content = '导入器 v2.5.3 在后台任务依赖检查中补齐按租户、任务类型和运行时范围组织的领取索引，使应用安装与业务后台任务互不阻塞；导出器 v1.2.9 使用 FormEngine 事务围栏、发布后二阶段快照收口和最低版本元数据回读，避免发布半提交或安装拿到旧快照。';

function replaceCapability(values, prefix, nextValue) {
  const source = Array.isArray(values) ? values : [];
  return [
    ...source.filter(item => !String(item || '').startsWith(prefix)),
    nextValue,
  ];
}

function appendUnique(values, additions) {
  const result = Array.isArray(values) ? [...values] : [];
  for (const value of additions) {
    if (!result.includes(value)) result.push(value);
  }
  return result;
}

const packageModel = JSON.parse(await readFile(packageUrl, 'utf8'));
const packageInfo = packageModel.PackageInfo || {};
const engines = Array.isArray(packageModel.SysApiEngines) ? packageModel.SysApiEngines : [];
const importer = engines.find(item => item.ApiEngineKey === 'import-microi-store-package');
const exporter = engines.find(item => item.ApiEngineKey === 'export-microi-store-package');

if (String(importer?.Version || '') !== 'v2.5.3') {
  throw new Error(`应用商城内嵌导入器必须为 v2.5.3，实际为 ${importer?.Version || '(空)'}`);
}
if (String(exporter?.Version || '') !== 'v1.2.9') {
  throw new Error(`应用商城内嵌导出器必须为 v1.2.9，实际为 ${exporter?.Version || '(空)'}`);
}

for (const fieldName of ['RequiredPlatformCapabilities', 'Capabilities']) {
  let values = replaceCapability(
    packageInfo[fieldName],
    'ApiEngine:export-microi-store-package@',
    'ApiEngine:export-microi-store-package@v1.2.9',
  );
  values = replaceCapability(
    values,
    'ApiEngine:import-microi-store-package@',
    'ApiEngine:import-microi-store-package@v2.5.3',
  );
  packageInfo[fieldName] = appendUnique(values, [
    'Installer:BackgroundTaskLaneIndexReadinessV1',
    'Marketplace:StorePublishTransactionalFenceV2',
    'Marketplace:AsyncSnapshotFinalizeV1',
    'Marketplace:PublishedRuntimeMinimumMetadataV1',
  ]);
}

if (String(packageInfo.Version || '') === targetVersion) {
  packageInfo.ChangeLog = {
    Version: targetVersion,
    Title: title,
    ChangeType: changeType,
    Content: content,
    ReleaseTime: releaseTime,
  };
  if (Array.isArray(packageInfo.ChangeHistory)) {
    packageInfo.ChangeHistory = [
      { Version: targetVersion, Date: releaseTime.substring(0, 10), Description: content },
      ...packageInfo.ChangeHistory.filter(item => String(item?.Version || '') !== targetVersion),
    ];
  } else {
    const prior = String(packageInfo.ChangeHistory || '')
      .split(/\r?\n/)
      .filter(line => line && !line.includes(targetVersion));
    packageInfo.ChangeHistory = `${releaseTime.substring(0, 10)} ${targetVersion} ${content}\n${prior.join('\n')}${prior.length ? '\n' : ''}`;
  }
} else {
  if (String(packageInfo.Version || '') !== 'v7.7.31') {
    throw new Error(`只允许从 v7.7.31 提升到 ${targetVersion}，实际为 ${packageInfo.Version || '(空)'}`);
  }
  packageInfo.ChangeLog = {
    ...packageInfo.ChangeLog,
    Title: title,
    ChangeType: changeType,
    Content: content,
  };
  advanceOfficialPackageVersion(packageInfo, targetVersion, releaseTime);
}

const output = `${JSON.stringify(packageModel, null, 2)}\n`;
validateOfficialPackageChangeLog(packageName, output);
await writeFile(fileURLToPath(packageUrl), output, 'utf8');
process.stdout.write(`${packageName}\t${packageInfo.Version}\t${importer.Version}\t${exporter.Version}\n`);
