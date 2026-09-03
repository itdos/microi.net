import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeOfficialPackageExecutionLimits } from './resource-sync-core.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(directory, 'app.microi.saas-engine.json');
const canonicalSourcePath = path.resolve(
  directory,
  '../../../Microi-V8-Engine/Microi吾码 (api.itdos.com)/iTdos.Product.Internal/接口引擎/系统/[SaaS引擎]主库空数据库脱敏SQL(admin_get_empty_database_sanitization_sql).js',
);
const packageVersion = 'v7.8.14';
const previousPackageVersion = 'v7.8.13';
const engineVersion = 'v1.3.6';
const previousEngineVersion = 'v1.3.5';
const releaseTime = '2026-09-03 16:20:00';
const changeLogContent = '空数据库只保留唯一 iTdos/Product/Internal 主租户模板，并新增后端零残留门禁；一键安装器仅对官方空库原位认领模板并停用旧版包遗留空模板，自定义恢复库的子租户保持不变。';

function normalizeSource(value) {
  return String(value || '').replace(/\r\n?/g, '\n').replace(/\n*$/, '\n');
}

function prependOnce(value, line) {
  const current = String(value || '');
  return current.split(/\r?\n/).includes(line) ? current : `${line}\n${current}`;
}

function sha256(value) {
  return createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

let packageModel = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const info = packageModel.PackageInfo || (packageModel.PackageInfo = {});
if (info.Name !== 'SaaS引擎') throw new Error('SaaS引擎官方包身份不正确。');
if (![previousPackageVersion, packageVersion].includes(String(info.Version || ''))) {
  throw new Error(`SaaS引擎当前版本为 ${info.Version || '(空)'}，只允许从 ${previousPackageVersion} 幂等生成 ${packageVersion}。`);
}

const engines = Array.isArray(packageModel.SysApiEngines) ? packageModel.SysApiEngines : [];
const engine = engines.find(item => item.ApiEngineKey === 'admin_get_empty_database_sanitization_sql');
if (!engine) throw new Error('SaaS引擎包缺少空数据库脱敏接口。');
if (![previousEngineVersion, engineVersion].includes(String(engine.Version || ''))) {
  throw new Error(`空数据库脱敏接口当前版本为 ${engine.Version || '(空)'}，无法安全升级。`);
}

const canonicalSource = normalizeSource(fs.readFileSync(canonicalSourcePath, 'utf8'));
if (!canonicalSource.includes(`Version: ${engineVersion}`)
    || !canonicalSource.includes('EMPTY_DATABASE_CANONICAL_TENANT_TEMPLATE_V1')) {
  throw new Error(`空数据库脱敏独立源码尚未同步到 ${engineVersion}。`);
}

packageModel.ResourcePolicies ||= { SchemaVersion: 1 };
packageModel.ResourcePolicies.ApiEngines ||= {};
const policy = packageModel.ResourcePolicies.ApiEngines[engine.ApiEngineKey]
  || (packageModel.ResourcePolicies.ApiEngines[engine.ApiEngineKey] = {
    Ownership: 'Platform',
    UpgradePolicy: 'Managed',
  });
if (policy.Ownership !== 'Platform' || policy.UpgradePolicy !== 'Managed') {
  throw new Error('空数据库脱敏接口必须保持 Platform/Managed。');
}

if (String(engine.Version || '') === previousEngineVersion) {
  const previousSourceHash = sha256(normalizeSource(engine.ApiV8Code));
  const compatible = [policy.BaseHash, ...(policy.CompatibleBaseHashes || [])]
    .map(value => String(value || '').toLowerCase())
    .filter(value => /^[a-f0-9]{64}$/.test(value) && value !== previousSourceHash);
  policy.BaseHash = previousSourceHash;
  policy.CompatibleBaseHashes = Array.from(new Set(compatible));
}

engine.ApiV8Code = canonicalSource;
engine.Version = engineVersion;
engine.UpdateTime = releaseTime;
engine.ChangeHistory = prependOnce(
  engine.ChangeHistory,
  `${releaseTime} ${engineVersion} 只保留唯一 Product/Internal 主租户模板并纳入后端零残留门禁`,
);

info.Version = packageVersion;
info.ChangeHistory = prependOnce(
  info.ChangeHistory,
  `2026-09-03 ${packageVersion} ${changeLogContent}`,
);
info.ChangeLog = {
  Version: packageVersion,
  Title: '空数据库主租户模板闭环修复',
  ChangeType: 'Fix',
  Content: changeLogContent,
  ReleaseTime: releaseTime,
};
info.RequiredPlatformCapabilities = Array.from(new Set([
  ...(Array.isArray(info.RequiredPlatformCapabilities) ? info.RequiredPlatformCapabilities : []),
  'EmptyDatabase:CanonicalTenantTemplateV1',
]));
info.ApiEngineCount = engines.length;

packageModel = JSON.parse(normalizeOfficialPackageExecutionLimits(
  path.basename(packagePath),
  JSON.stringify(packageModel),
));
fs.writeFileSync(packagePath, `${JSON.stringify(packageModel, null, 2)}\n`, 'utf8');

process.stdout.write(`${path.basename(packagePath)}\t${packageVersion}\t${engineVersion}\t${sha256(canonicalSource)}\n`);
