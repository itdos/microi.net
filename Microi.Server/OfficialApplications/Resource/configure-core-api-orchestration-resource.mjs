import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeOfficialApiEnginePolicies} from './official-api-engine-notice.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(root, 'app.microi.saas-engine.json');
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
const definitions = [
  {key:'platform-sys-config', version:'v1.1.0'},
  {key:'platform-license-management-state', version:'v1.0.0', id:'b8b70c51-059c-47b0-a960-314309d09b1c',
    name:'平台授权只读状态', route:'/api/License/GetManagementState'},
  {key:'platform-license-server-nodes', version:'v1.0.0', id:'a9384917-39a9-40ab-aea7-43c85516dce0',
    name:'平台授权服务器节点', route:'/api/License/GetServerNodes'}
];
for (const d of definitions) {
  let engine = pkg.SysApiEngines.find(e => e.ApiEngineKey === d.key);
  if (!engine) {
    engine = {Id:d.id, ApiEngineKey:d.key, ApiName:d.name, IsDeleted:0, IsEnable:1,
      AllowAnonymous:0, ApiRole:'["$authenticated"]', StopHttp:0, EnableLog:0,
      ApiAddress:d.route, ApiRoutes:`/apiengine/${d.key}`, ResponseType:'JSON',
      Category:'平台核心', LimitMemory:2048, LimitRecursion:5000, Timeout:600, V8Limit:0};
    pkg.SysApiEngines.push(engine);
  }
  engine.Version = d.version;
  engine.ApiV8Code = fs.readFileSync(path.join(root, `${d.key}.js`), 'utf8').replace(/\r\n/g,'\n');
  pkg.ResourcePolicies.ApiEngines[d.key] = {Ownership:'Platform', UpgradePolicy:'Managed'};
}
const version = 'v8.4.37';
const content = '公开系统设置由 V8 编排读取、失败分类与响应，保留二进制滚动兼容；新增授权状态和服务器节点接口引擎，沿用旧 License 地址。授权验签及敏感主体读取仍受可信原子保护；不新增启动可选应用。';
if (!['v8.4.36',version].includes(pkg.PackageInfo.Version)) throw Error('SaaS 包版本已变化，请先合并当前发布版本。');
pkg.PackageInfo.Version = version;
pkg.PackageInfo.RequiredPlatformCapabilities = [...new Set([
  ...(pkg.PackageInfo.RequiredPlatformCapabilities || []),
  'V8.Method.ProjectPublicSysConfig', 'V8.Method.GetLoginEncryptionPublicKey', 'V8.Method.GetPlatformEdition',
  'V8.Method.ReadLicenseAccessScope', 'V8.Method.ReadLicenseVerification', 'V8.Method.ReadLicenseSubject',
  'V8.Method.ReadAiLicenseVerification', 'V8.Method.ReadLicenseServerNodes'
])];
pkg.PackageInfo.ChangeLog = {Version:version, Title:'核心接口编排与 License 旧地址迁移', ChangeType:'Update', Content:content, ReleaseTime:'2026-10-22 15:26:00'};
if (!pkg.PackageInfo.ChangeHistory.includes(`2026-10-22 ${version} `)) pkg.PackageInfo.ChangeHistory = `2026-10-22 ${version} ${content}\n` + pkg.PackageInfo.ChangeHistory;
pkg.PackageInfo.ApiEngineCount = pkg.SysApiEngines.length;
normalizeOfficialApiEnginePolicies(pkg, path.basename(file));
fs.writeFileSync(file, JSON.stringify(pkg,null,2)+'\n');
console.log(`${path.basename(file)} ${version}: ${definitions.map(d=>d.key).join(', ')}`);
