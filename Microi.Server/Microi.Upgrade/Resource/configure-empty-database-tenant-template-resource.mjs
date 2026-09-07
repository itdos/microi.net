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
const packageVersion = 'v8.2.3';
const previousPackageVersion = 'v8.2.2';
const engineVersion = 'v1.4.0';
const previousEngineVersion = 'v1.3.9';
const releaseTime = '2026-09-07 04:10:00';
const changeLogContent = '主库空数据库保留邮件与视觉能力的表结构，但清空邮件账户、邮件内容、同步日志、接口代码历史及视觉请求、主体、样本等运行数据；补齐导出前零残留门禁，避免将持续新增的业务与历史数据交付到新租户。官方可在同一发布租约下撤回固定的七种空库文件。';

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
  `${releaseTime} ${engineVersion} 清理邮件和运行历史并保留已校验的安装版本基线`,
);

const worker = engines.find(item => item.ApiEngineKey === 'admin_build_sanitized_empty_database');
if (!worker || !['v1.0.10', 'v1.1.0'].includes(worker.Version)) throw new Error('空库工作器版本不符合预期。');
const workerPath = path.resolve(directory, '../../../Microi-V8-Engine/Microi吾码 (api.itdos.com)/iTdos.Product.Internal/接口引擎/系统/[SaaS引擎]一键制作主库空数据库(admin_build_sanitized_empty_database).js');
worker.ApiV8Code = normalizeSource(fs.readFileSync(workerPath, 'utf8'));
if (!worker.ApiV8Code.includes('Version: v1.1.0')) throw new Error('空库工作器源码版本未更新。');
worker.Version = 'v1.1.0';
worker.UpdateTime = releaseTime;
worker.ChangeHistory = prependOnce(worker.ChangeHistory, `${releaseTime} v1.1.0 官方固定空库文件撤回与强租约验证`);

info.Version = packageVersion;
info.ChangeHistory = prependOnce(
  info.ChangeHistory,
  `2026-09-07 ${packageVersion} ${changeLogContent}`,
);
info.ChangeLog = {
  Version: packageVersion,
  Title: '空数据库邮件与运行历史脱敏',
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
