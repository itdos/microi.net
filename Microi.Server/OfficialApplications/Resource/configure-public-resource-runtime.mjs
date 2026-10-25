import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export const publicResourceRuntimeEngines = ['mci-file-resource-runtime', 'mci-file-resource-public-url'];
export function configurePublicResourceRuntime(input) {
  const pkg = structuredClone(input);
  assert.equal(pkg.PackageInfo.AppId, 'app.microi.sys-log');
  for (const key of publicResourceRuntimeEngines) {
    const code = fs.readFileSync(new URL(`../PlatformService/engines/${key}.js`, import.meta.url), 'utf8');
    const anonymous = key === 'mci-file-resource-public-url';
    const index = pkg.SysApiEngines.findIndex(row => row.ApiEngineKey === key);
    const prior = index >= 0 ? pkg.SysApiEngines[index] : null;
    const engine = { Id: prior?.Id || crypto.createHash('sha256').update('public-resource-offload/2|' + key).digest('hex').slice(0, 32),
      ApiEngineKey: key, ApiName: anonymous ? '公开热点下载地址选择' : '热点公开资源采集复制与分流', ApiAddress: '/apiengine/' + key,
      ApiV8Code: code, Version: code.match(/Version:\s*(v\d+\.\d+\.\d+)/)?.[1] || 'v1.0.0', IsEnable: 1, StopHttp: 0, AllowAnonymous: anonymous ? 1 : 0,
      V8Unlimited: 1, V8Limit: 0, EnableLog: 0, IsDeleted: 0, ResponseType: 'JSON', Category: '系统日志/监控/CDN', ApiRole: '[]',
      Lock: 0, Timeout: anonymous ? 15 : 60, LimitRecursion: 200, LimitMemory: 128, MaxStatements: 5000000 };
    if (index >= 0) pkg.SysApiEngines[index] = engine; else pkg.SysApiEngines.push(engine);
    pkg.ResourcePolicies ||= {}; pkg.ResourcePolicies.ApiEngines ||= {};
    pkg.ResourcePolicies.ApiEngines[key] = { Ownership: 'Application', UpgradePolicy: 'Managed' };
  }
  pkg.PackageInfo.ApiEngineCount = pkg.SysApiEngines.length;
  return pkg;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert(process.argv.includes('--write'), '仅显式 --write 更新本地母版；不修改官网或发行候选');
  const file = new URL('system-observability-package-source.json', import.meta.url);
  const before = fs.readFileSync(file, 'utf8'), after = JSON.stringify(configurePublicResourceRuntime(JSON.parse(before)), null, 2) + '\n';
  assert.equal(fs.readFileSync(file, 'utf8'), before, '母版并发变化');
  if (after !== before) fs.writeFileSync(file, after);
  console.log(JSON.stringify({ localMasterOnly: true, engines: publicResourceRuntimeEngines }));
}
