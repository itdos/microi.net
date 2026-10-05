import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const upgrade = path.join(root, 'Microi.Server/Microi.Upgrade');

test('启动和自动升级只消费最小商城恢复包', () => {
  const project = fs.readFileSync(path.join(upgrade, 'Microi.Upgrade.csproj'), 'utf8');
  const resources = [...project.matchAll(/EmbeddedResource Include="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(resources.sort(), ['Resource\\app.microi.bootstrap.json', 'Resource\\import-package.js']);
  const source = fs.readFileSync(path.join(upgrade, 'Upgrade.cs'), 'utf8');
  for (const number of [8,14,16,17,18,20,23,24,26,28,29,30,31,34,35]) {
    assert.doesNotMatch(source, new RegExp(`new Upgrade${number}\\(\\)\\.Run`));
  }
});

test('恢复包涵盖普通登录和商城安装更新，不携带可选应用', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(upgrade, 'Resource/app.microi.bootstrap.json')));
  const keys = pkg.SysApiEngines.map(x => x.ApiEngineKey);
  for (const key of ['platform-sys-user-session','platform-current-user','platform-sys-menu',
    'get-microi-store','get-microi-store-model','get-microi-store-versions',
    'import-microi-store-package','platform-background-task','platform-marketplace-source']) assert.ok(keys.includes(key), key);
  for (const key of keys) assert.doesNotMatch(key, /^(sso_|ai_app_|database-backup-|platform-(ocr|translate|ai-|message|reminder|wechat|workflow))/);
  assert.equal(pkg.PackageInfo.AppId, 'app.microi.bootstrap');
  assert.equal(pkg.ScheduleJobs?.length || 0, 0);
  assert.equal(pkg.ApplicationBundles.length, 1);
  assert.ok(pkg.SysMenus.some(x => x.ModuleEngineKey === 'sys_microistore'));
  assert.ok(!fs.existsSync(path.join(upgrade, 'Resource/OfficialApiSources')));
});

test('恢复文件由官方应用显式投影生成，冻结后不能漂移', async () => {
  const {bootstrapOutputs, bootstrapEngines, bootstrapTables} = await import('../../OfficialApplications/Resource/build-bootstrap-package.mjs');
  for (const [name, expected] of bootstrapOutputs()) assert.equal(fs.readFileSync(path.join(upgrade, 'Resource', name), 'utf8'), expected, name);
  const pkg = JSON.parse(bootstrapOutputs().get('app.microi.bootstrap.json'));
  assert.deepEqual(pkg.SysApiEngines.map(e => e.ApiEngineKey), bootstrapEngines);
  assert.deepEqual(pkg.DiyTables.map(t => t.Name.toLowerCase()).sort(), [...bootstrapTables].sort());
  assert.deepEqual(Object.keys(pkg.ResourcePolicies.ApiEngines).sort(), [...bootstrapEngines].sort());
  for (const engine of pkg.SysApiEngines) {
    assert.ok(engine.ApiV8Code && engine.Version);
    const policy = pkg.ResourcePolicies.ApiEngines[engine.ApiEngineKey];
    assert.ok(['Managed','CreateIfMissing'].includes(policy.UpgradePolicy));
  }
});

test('商城菜单祖先闭合且服务快照只启用商城页面', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(upgrade, 'Resource/app.microi.bootstrap.json')));
  const ids = new Set(pkg.SysMenus.map(menu => menu.Id));
  for (const menu of pkg.SysMenus) assert.ok(!menu.ParentId || /^0+$/.test(menu.ParentId.replaceAll('-', '')) || ids.has(menu.ParentId));
  for (const bundle of pkg.ApplicationBundles) {
    assert.deepEqual(bundle.Routes.map(route => route.RoutePath), ['/marketplace']);
    assert.deepEqual(JSON.parse(bundle.MicroService.RouteSnapshotJson).map(route => route.RoutePath), ['/marketplace']);
    assert.equal(bundle.MicroService.RouteCount, 1);
  }
  assert.equal(pkg.DataSets.length, 0, '自动恢复不得写入租户配置默认值或业务数据');
  assert.equal(pkg.ScheduleJobs.length, 0);
});

test('恢复元数据、物理列和建表声明保持闭合', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(upgrade, 'Resource/app.microi.bootstrap.json')));
  const tableIds = new Set(pkg.DiyTables.map(table => table.Id));
  for (const field of pkg.DiyFields) assert.ok(tableIds.has(field.TableId), field.Name);
  for (const ddl of pkg.DDLStatements) {
    if (!/^CREATE TABLE/i.test(ddl.DDL)) continue;
    const columns = new Set(pkg.PhysicalColumns.filter(c => c.TABLE_NAME.toLowerCase() === ddl.TableName.toLowerCase()).map(c => c.COLUMN_NAME.toLowerCase()));
    for (const [,name] of ddl.DDL.matchAll(/(?:^|[,\n(])\s*`([A-Za-z_][A-Za-z0-9_]*)`\s+[A-Za-z]/g)) assert.ok(columns.has(name.toLowerCase()), `${ddl.TableName}.${name}`);
  }
});

test('空旧库先创建声明表，再执行其索引，包括首个 DDL 分片', async () => {
  const {buildBootstrapPackage} = await import('../../OfficialApplications/Resource/build-bootstrap-package.mjs');
  const pkg = buildBootstrapPackage();
  const created = new Set();
  let indexes = 0;
  for (const statement of pkg.DDLStatements) {
    const table = statement.TableName.toLowerCase();
    if (/^\s*CREATE\s+TABLE\b/i.test(statement.DDL)) created.add(table);
    else if (/^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(statement.DDL)) {
      assert.ok(created.has(table), `空库尚未创建索引依赖表：${table}`);
      indexes++;
    }
  }
  assert.ok(created.has('mic_data_version'));
  assert.ok(indexes > 0);
});
