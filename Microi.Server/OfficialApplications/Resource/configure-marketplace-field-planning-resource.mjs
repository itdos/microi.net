import { readFile, writeFile } from 'node:fs/promises';
import { advanceOfficialPackageVersion, validateOfficialPackageChangeLog } from './resource-sync-core.mjs';

const packageUrl = new URL('./app.microi.store.json', import.meta.url);
const packageName = 'app.microi.store.json';
const previousVersion = 'v8.2.4';
const targetVersion = 'v8.2.5';
const importerVersion = 'v2.8.4';
const releaseTime = '2026-09-07 03:00:00';
const title = '批量租户字段映射规划查询优化';
const content = '导入器 v2.8.4 将当前字段映射分片的自然键和主键读取合并为两次有界参数化查询；重复自然键与超限结果回退原有单条校验，保留软删除、主键冲突、检查点复用和租户隔离，减少所有子租户安装平台应用时的重复查询。';
const source = (await readFile(new URL('./import-package.js', import.meta.url), 'utf8')).replace(/\r\n?/g, '\n').replace(/\n*$/, '\n');
if (!source.includes(`Version: ${importerVersion}`) || !source.includes('FIELD_ID_PLAN_BOUNDED_READ_BATCH_V1')) throw Error('Importer contract missing');
const model = JSON.parse(await readFile(packageUrl, 'utf8'));
const info = model.PackageInfo;
if (!info || info.Name !== '应用商城' || ![previousVersion, targetVersion].includes(info.Version)) throw Error('Unexpected marketplace package identity/version');
const importer = model.SysApiEngines.find(row => row.ApiEngineKey === 'import-microi-store-package');
if (!importer) throw Error('Marketplace importer missing');
importer.ApiV8Code = source;
importer.Version = importerVersion;
importer.UpdateTime = releaseTime;
const engineHistory = `${releaseTime.substring(0, 10)} ${importerVersion} ${content}`;
importer.ChangeHistory = [engineHistory, ...String(importer.ChangeHistory || '').split(/\r?\n/).filter(line => line && line !== engineHistory)].join('\n');
for (const key of ['RequiredPlatformCapabilities', 'Capabilities']) {
  info[key] = [...(Array.isArray(info[key]) ? info[key] : []).filter(value => !String(value).startsWith('ApiEngine:import-microi-store-package@')),
    `ApiEngine:import-microi-store-package@${importerVersion}`];
}
if (info.Version === previousVersion) {
  info.ChangeLog = { ...info.ChangeLog, Title: title, ChangeType: 'Fix', Content: content };
  advanceOfficialPackageVersion(info, targetVersion, releaseTime);
} else {
  info.ChangeLog = { Version: targetVersion, Title: title, ChangeType: 'Fix', Content: content, ReleaseTime: releaseTime };
}
validateOfficialPackageChangeLog(info, packageName);
await writeFile(packageUrl, JSON.stringify(model, null, 2) + '\n', 'utf8');
console.log(`${packageName}: ${info.Version}; importer ${importerVersion}`);
