import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const resourceDir = path.dirname(fileURLToPath(import.meta.url));
const paths = [path.join(resourceDir, 'app.microi.store.json')];
if (process.argv.includes('--sync-base')) {
  paths.push(path.join(resourceDir, '.resource-sync-base', 'app.microi.store.json'));
}

function compareVersion(left, right) {
  const a = String(left || '').replace(/^v/i, '').split('.').map(Number);
  const b = String(right || '').replace(/^v/i, '').split('.').map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] || 0) > (b[index] || 0)) return 1;
    if ((a[index] || 0) < (b[index] || 0)) return -1;
  }
  return 0;
}

for (const filePath of paths) {
  const packageData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const importer = (packageData.SysApiEngines || []).find((item) =>
    item.ApiEngineKey === 'import-microi-store-package');
  if (!importer) throw new Error(`${filePath}: import-microi-store-package missing`);
  if (!String(importer.ApiV8Code || '').includes('API_ENGINE_CHANGE_HISTORY_TABLECHILD_MIGRATION_V1')) {
    throw new Error(`${filePath}: embedded importer does not contain history migration`);
  }
  if (!String(importer.ApiV8Code || '').includes('Version: v2.2.2')) {
    throw new Error(`${filePath}: embedded importer version is not v2.2.2`);
  }

  importer.Version = 'v2.2.2';
  const info = packageData.PackageInfo || (packageData.PackageInfo = {});
  if (compareVersion(info.Version, 'v7.5.6') < 0) info.Version = 'v7.5.6';
  const releaseLine = '2026-08-21 v7.5.6 安装表单引擎包后将接口引擎旧 ChangeHistory 按非空行幂等迁移到 TableChild 子表，保留旧文本并在安装结果中返回迁移统计。';
  const history = String(info.ChangeHistory || '').split('\n').filter(Boolean);
  info.ChangeHistory = `${[releaseLine, ...history.filter((line) => line !== releaseLine)].join('\n')}\n`;
  info.Description = '应用商城基础资源。可信官方平台应用支持 Application-owned Managed 覆盖升级，并在目标资源建表后执行幂等兼容数据迁移。';
  info.RequiredPlatformCapabilities = [...new Set([
    ...(info.RequiredPlatformCapabilities || []),
    'InstallerFeature:OfficialManagedOverwrite',
    'InstallerMigration:ApiEngineChangeHistoryTableChild',
  ])];
  fs.writeFileSync(filePath, `${JSON.stringify(packageData, null, 2)}\n`, 'utf8');
}

console.log(`Configured API engine history importer metadata in ${paths.length} resource(s).`);
