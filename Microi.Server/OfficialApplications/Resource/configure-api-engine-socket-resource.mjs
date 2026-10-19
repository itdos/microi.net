import fs from 'node:fs';
import assert from 'node:assert/strict';
import { advanceOfficialPackageVersion } from './resource-sync-core.mjs';

// 母版先通过官方 MCP 写入并回读；本脚本只投影这一字段，不改其它租户资源。
const masterPath = process.argv[process.argv.indexOf('--master') + 1];
assert.ok(process.argv.includes('--write') && process.argv.includes('--master') && masterPath);
const field = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
assert.equal(field.Id, 'a0dcefb5-e695-4e1f-915d-035f6660b70c');
assert.equal(field.Name, 'ResponseType');
assert.deepEqual(JSON.parse(field.Data), ['JSON','String','File','HTML','Stream','HTTP','SignalR']);
for (const relative of ['app.microi.saas-engine.json', '../../Microi.Upgrade/Resource/app.microi.bootstrap.json']) {
  const file = new URL(relative, import.meta.url);
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  const target = pkg.DiyFields.find(row => row.Id === field.Id && row.TableId === field.TableId);
  assert.ok(target, '响应类型必须已经属于此包');
  for (const key of ['Data','Description','V8TmpEngineTable']) target[key] = field[key];
  if (relative === 'app.microi.saas-engine.json' && !pkg.PackageInfo.ChangeLog?.Content?.includes('API_ENGINE_SOCKET_V1')) {
    const current = pkg.PackageInfo.Version;
    const parts = current.replace(/^v/, '').split('.').map(Number);
    parts[2]++;
    pkg.PackageInfo.ChangeLog = {...pkg.PackageInfo.ChangeLog, Version:current, Title:'接口引擎双向实时连接', ChangeType:'Feature',
      Content:'API_ENGINE_SOCKET_V1：响应类型新增 SignalR，使用 /api-engine-socket 建立双向实时连接，复用接口引擎鉴权、事务和 Redis 跨节点推送。支持多控制端、执行回执与撤销授权；需配套后端 8.6.1 或更高版本。'};
    advanceOfficialPackageVersion(pkg.PackageInfo, 'v'+parts.join('.'), '2026-10-19 18:43:00');
  }
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2)+'\n');
  console.log(relative+' '+pkg.PackageInfo?.Version);
}
