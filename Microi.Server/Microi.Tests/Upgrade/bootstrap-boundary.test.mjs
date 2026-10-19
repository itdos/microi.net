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
    'import-microi-store-package','platform-background-task','platform-marketplace-source','platform-tenant-system-settings']) assert.ok(keys.includes(key), key);
  const settings = pkg.SysApiEngines.find(x => x.ApiEngineKey === 'platform-tenant-system-settings');
  for (const route of ['/api/TenantSystemSettings/List', '/api/TenantSystemSettings/Save']) assert.ok(settings.ApiRoutes.split(';').includes(route), `商城来源设置依赖：${route}`);
  for (const engine of pkg.SysApiEngines) {
    for (const [, dependency] of engine.ApiV8Code.matchAll(/V8\.ApiEngine\.Run\(\s*['"]([^'"]+)['"]/g))
      assert.ok(keys.includes(dependency), `${engine.ApiEngineKey} 缺少直接依赖 ${dependency}`);
  }
  for (const key of keys) assert.doesNotMatch(key, /^(sso_|ai_app_|database-backup-|platform-(ocr|translate|ai-|message|reminder|wechat|workflow))/);
  assert.equal(pkg.PackageInfo.AppId, 'app.microi.bootstrap');
  assert.equal(pkg.ScheduleJobs?.length || 0, 0);
  assert.equal(pkg.ApplicationBundles.length, 1);
  assert.ok(pkg.SysMenus.some(x => x.ModuleEngineKey === 'sys_microistore'));
  assert.ok(!fs.existsSync(path.join(upgrade, 'Resource/OfficialApiSources')));
});

test('冷启动接受登录前复用最小商城恢复，不能先开放空菜单', () => {
  const source = fs.readFileSync(path.join(upgrade, 'Upgrade.cs'), 'utf8');
  const gate = source.slice(source.indexOf('public async Task<DosResult> EnsureStartupDependenciesAsync('), source.indexOf('public Task<DosResultList<MicroiUpgradeResult>> Upgrade('));
  assert.match(gate, /enginesReady && metadataReady && marketplaceReason == null/);
  assert.match(gate, /await UpgradeCore\(currentVersion, osClientSecret, forceMarketplaceRecovery: true\)/);
  assert.match(gate, /首次登录前商城入口仍未就绪/);
  assert.doesNotMatch(gate, /MaintainPlatformApplications|bulk-import-microi-store-packages\(/);
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

test('启动包保留 SaaS 物理兼容但不安装可选功能的配置界面', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(upgrade, 'Resource/app.microi.bootstrap.json')));
  const table = pkg.DiyTables.find(row => row.Name.toLowerCase() === 'sys_osclients');
  assert.ok(table);
  const byName = new Map(pkg.DiyFields.filter(field => field.TableId === table.Id).map(field => [field.Name, field]));
  assert.equal(byName.size, 0, '完整 SaaS 管理界面由用户手动安装 SaaS 包获得');
  assert.deepEqual(Object.keys(table).sort(), ['Description', 'Id', 'Name']);
  for (const name of ['MqttEnable', 'TcpIngressEnable', 'TcpIngressPort', 'TcpIngressRulesJson', 'AuthSecret', 'DbConn']) {
    assert.ok(pkg.PhysicalColumns.some(column => column.TABLE_NAME.toLowerCase() === 'sys_osclients' && column.COLUMN_NAME === name));
  }
  assert.equal(pkg.DataSets.length, 0);
  assert.equal(pkg.DiyFieldRetirements?.length || 0, 0, '缩小恢复范围不能卸载既有应用的字段');
});

test('启动字段压缩保留当前控件、共享设置、未知扩展与显式空值', async () => {
  const {projectBootstrapField} = await import('../../OfficialApplications/Resource/build-bootstrap-package.mjs');
  const original = {Name:'Caption', Component:'Text', Config:JSON.stringify({
    TextShowPassword:true, ImgUpload:{Multiple:true}, NumberTextStep:3,
    SelectSaveFormat:'Text', Unique:{Type:'Alone'}, CustomExtension:{enabled:false}, MapVendorExtension:'preserve',
    Data:[], DataSource:'', DefaultValue:null, V8Code:'preserve()', Textarea:{DefaultRows:5}
  })};
  const before = structuredClone(original);
  const projected = JSON.parse(projectBootstrapField(original).Config);
  assert.deepEqual(projected, {TextShowPassword:true, SelectSaveFormat:'Text', Unique:{Type:'Alone'},
    CustomExtension:{enabled:false}, MapVendorExtension:'preserve', Data:[], DataSource:'', DefaultValue:null, V8Code:'preserve()'});
  assert.deepEqual(original, before, '不能修改官方完整应用包正文');
  const composite = {...original, Component:'JsonTable'};
  assert.deepEqual(projectBootstrapField(composite), composite);
  const legacy = {...original, Config:'{"V8Code":"line1\nline2"}'};
  assert.deepEqual(projectBootstrapField(legacy), legacy);
  const numeric = {...original, Component:'NumberText'};
  assert.equal(JSON.parse(projectBootstrapField(numeric).Config).NumberTextStep, 3);
  assert.equal(Object.hasOwn(JSON.parse(projectBootstrapField(numeric).Config), 'TextShowPassword'), false);
});

test('默认恢复资源有明确容量预算，可选应用增长不能自动扩大启动面', () => {
  const raw = fs.readFileSync(path.join(upgrade, 'Resource/app.microi.bootstrap.json'));
  const pkg = JSON.parse(raw);
  assert.ok(raw.length < 4 * 1024 * 1024, `启动包超出 4 MiB 预算：${raw.length}`);
  assert.ok(pkg.DiyFields.length <= 800, `启动字段超出 800 条预算：${pkg.DiyFields.length}`);
  assert.ok(pkg.SysApiEngines.length <= 26, '新增接口必须先证明属于登录或商城依赖');
  assert.equal(pkg.ApplicationBundles.length, 1);
  assert.equal(pkg.DataSets.length, 0);
  assert.equal(pkg.ScheduleJobs.length, 0);
  for (const ddl of pkg.DDLStatements.filter(row => /^CREATE\s+(?:UNIQUE\s+)?INDEX/i.test(row.DDL))) {
    assert.equal(ddl.TableName.toLowerCase(), 'sys_microistore_package', '启动不得创建推广、邀请等可选功能索引');
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
