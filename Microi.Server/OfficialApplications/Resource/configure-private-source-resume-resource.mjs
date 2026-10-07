import fs from 'node:fs';
import { advanceOfficialPackageVersion, validateOfficialPackageChangeLog } from './resource-sync-core.mjs';
import { bootstrapOutputs } from './build-bootstrap-package.mjs';

const source = fs.readFileSync(new URL('./import-package.js', import.meta.url), 'utf8');
if (!source.includes('Version: v3.0.9') || !source.includes('PRIVATE_SOURCE_RESUME_AFTER_SOURCE_V2'))
  throw Error('缺少已验证的源码/编译文件分片恢复修复');
const url = new URL('./app.microi.store.json', import.meta.url);
const pkg = JSON.parse(fs.readFileSync(url, 'utf8'));
if (!['v8.5.6', 'v8.5.7'].includes(pkg.PackageInfo.Version)) throw Error('商城包版本漂移，禁止覆盖其它发行成果');
const importer = pkg.SysApiEngines.find(e => e.ApiEngineKey === 'import-microi-store-package');
const policy = importer && pkg.ResourcePolicies.ApiEngines[importer.ApiEngineKey];
if (!importer || (typeof policy === 'string' ? policy : policy?.UpgradePolicy) !== 'Managed')
  throw Error('导入器必须继续由官方商城包托管');
importer.ApiV8Code = source;
importer.Version = 'v3.0.9';
for (const name of ['Capabilities', 'RequiredPlatformCapabilities']) {
  const values = (pkg.PackageInfo[name] || []).filter(v => !String(v).startsWith('ApiEngine:import-microi-store-package@'));
  for (const capability of ['ApiEngine:import-microi-store-package@v3.0.9', 'Importer:PrivateSourceResumeAfterSourceV2'])
    if (!values.includes(capability)) values.push(capability);
  pkg.PackageInfo[name] = values;
}
if (pkg.PackageInfo.Version === 'v8.5.6') {
  pkg.PackageInfo.ChangeLog.Title = '私有源码与编译文件分片恢复修复';
  pkg.PackageInfo.ChangeLog.ChangeType = 'Fix';
  pkg.PackageInfo.ChangeLog.Content = '安装器 v3.0.9 从 Build/BuildRepair 或后续应用检查点恢复时，复用已提交的规范私有源码前缀，避免重新消耗源码分片预算并退回 Source 游标。保持同一原任务、不可变包、源码清单摘要、精确路径、字节大小及租户权限校验；原任务成功、目标源码 ZIP 和业务验收分别回读，不把安装百分比视为商业交付。';
  advanceOfficialPackageVersion(pkg.PackageInfo, 'v8.5.7', '2026-10-07 12:32:00');
}
const output = JSON.stringify(pkg, null, 2) + '\n';
validateOfficialPackageChangeLog('app.microi.store.json', output);
fs.writeFileSync(url, output);
// 启动包只从完整官方包的显式清单投影，不能扩张成重复的可编辑事实源。
for (const [name, content] of bootstrapOutputs())
  fs.writeFileSync(new URL('../../Microi.Upgrade/Resource/' + name, import.meta.url), content);
console.log('应用商城 v8.5.7 / 导入器 v3.0.9，启动恢复资源已同步');
