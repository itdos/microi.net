import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const resourceDir = path.dirname(fileURLToPath(import.meta.url));
const packageNames = ['app.microi.saas-engine.json', 'app.microi.store.json'];
const packagePaths = packageNames.map(name => path.join(resourceDir, name));
if (process.argv.includes('--sync-base')) {
  packagePaths.push(...packageNames.map(name => path.join(resourceDir, '.resource-sync-base', name)));
}

const engineKey = 'platform-user-update-preferences';
const engineSource = fs.readFileSync(path.join(resourceDir, `${engineKey}.js`), 'utf8').replaceAll('\r\n', '\n');
const engineDefinition = {
  IsDeleted: 0,
  UserName: '管理员',
  UserId: 'c74d669c-a3d4-11e5-b60d-b870f43edd03',
  CreateTime: '2026-08-22 00:00:00',
  Id: '97e9cc2f-a544-468c-b885-000000000012',
  ChangeHistory: '2026-08-22 00:00:00 v1.0.0 创建当前用户跨设备界面偏好白名单保存接口。\n',
  Version: 'v1.0.0',
  LimitRecursion: 10000,
  LimitMemory: 2048,
  MaxStatements: 100000000,
  Timeout: 600,
  StopHttp: 0,
  EnableLog: 0,
  Category: '平台内置',
  Files: '[]',
  AllowAnonymous: 0,
  ApiAddress: `/apiengine/${engineKey}`,
  Lock: 0,
  ApiV8Code: engineSource,
  ApiRole: '[]',
  IsEnable: 1,
  ApiEngineKey: engineKey,
  ApiName: '保存当前用户界面偏好',
};

for (const packagePath of packagePaths) {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const engines = Array.isArray(pkg.SysApiEngines) ? pkg.SysApiEngines : (pkg.SysApiEngines = []);
  const existingIndex = engines.findIndex(item => item.ApiEngineKey === engineKey);
  if (existingIndex >= 0) engines[existingIndex] = { ...engines[existingIndex], ...engineDefinition };
  else engines.push({ ...engineDefinition });

  const policies = pkg.ResourcePolicies && !Array.isArray(pkg.ResourcePolicies)
    ? pkg.ResourcePolicies
    : (pkg.ResourcePolicies = {});
  policies.SchemaVersion = 1;
  policies.ApiEngines = policies.ApiEngines && !Array.isArray(policies.ApiEngines)
    ? policies.ApiEngines
    : {};
  policies.ApiEngines[engineKey] = { Ownership: 'Platform', UpgradePolicy: 'Managed' };

  const info = pkg.PackageInfo || (pkg.PackageInfo = {});
  info.RequiredPlatformCapabilities = [...new Set([
    ...(info.RequiredPlatformCapabilities || []).filter(value => value !== 'Api:SysUser.UpdateMyPreferences'),
    `ApiEngine:${engineKey}`,
  ])];
  info.ApiEngineCount = engines.length;

  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    packagePath,
    packageVersion: info.Version,
    engineKey,
    apiEngineCount: info.ApiEngineCount,
    upgradePolicy: policies.ApiEngines[engineKey],
  }, null, 2));
}
