import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const resourceDir = path.dirname(fileURLToPath(import.meta.url));
const read = name => fs.readFileSync(path.join(resourceDir, name), 'utf8');
const packageModel = JSON.parse(read('app.microi.saas-engine.json'));
const storePackage = JSON.parse(read('app.microi.store.json'));
const engineSource = read('admin-upgrade-saas-tenant-database.js').replaceAll('\r\n', '\n');
const execute = new Function('V8', engineSource);
const engines = new Map((packageModel.SysApiEngines || []).map(item => [item.ApiEngineKey, item]));

function buttons(value) {
  return typeof value === 'string' ? JSON.parse(value || '[]') : (value || []);
}

test('official package owns the automatic and manual tenant upgrade lifecycle', () => {
  assert.equal(packageModel.PackageInfo.Version, 'v7.8.12');
  assert.equal(packageModel.PackageInfo.ChangeLog.Version, packageModel.PackageInfo.Version);
  assert.equal(storePackage.PackageInfo.Version, 'v7.9.8');
  assert.equal(storePackage.PackageInfo.ChangeLog.Version, storePackage.PackageInfo.Version);

  assert.equal(engines.get('admin_create_empty_saas_tenant')?.Version, 'v1.0.5');
  assert.equal(engines.get('official_create_tenant_worker')?.Version, 'v1.1.4');
  assert.equal(engines.get('admin_upgrade_saas_tenant_database')?.Version, 'v1.0.8');
  assert.equal(engines.get('admin_upgrade_saas_tenant_database')?.StopHttp, 1);
  assert.equal(engines.get('admin_upgrade_saas_tenant_database')?.EnableLog, 0);
  assert.equal(
    packageModel.ResourcePolicies.ApiEngines.admin_upgrade_saas_tenant_database.UpgradePolicy,
    'Managed',
  );
  assert.equal(engines.get('admin_upgrade_saas_tenant_database')?.ApiV8Code, engineSource);

  const createSource = engines.get('admin_create_empty_saas_tenant')?.ApiV8Code || '';
  const workerSource = engines.get('official_create_tenant_worker')?.ApiV8Code || '';
  assert.match(createSource, /ProvisionAdminTenant/);
  assert.match(createSource, /_BackgroundTaskFencingToken:\s*backgroundTaskFencingToken/);
  assert.match(workerSource, /Upgrade:\s*atomicData\.Upgrade/);
  assert.match(workerSource, /done\('upgrade'/);
  assert.match(workerSource, /_BackgroundTaskFencingToken:\s*backgroundTaskFencingToken/);

  const menu = packageModel.SysMenus.find(item => item.Id === '42078414-512a-4840-9843-9b75ab79ba79');
  const moreButton = buttons(menu.MoreBtns)
    .find(item => item.Id === 'admin-upgrade-saas-tenant-database-row-btn');
  assert.ok(moreButton);
  assert.match(moreButton.V8Code, /RoutePath:\s*'\/tenant-database-upgrade'/);
  assert.match(moreButton.V8Code, /TenantId:\s*V8\.Form\.Id/);
  assert.match(moreButton.V8CodeShow, /9999/);

  const backupButton = buttons(menu.PageBtns)
    .find(item => item.Id === 'database-backup-page-btn');
  assert.equal((backupButton.V8Code.match(/BodyHeight/g) || []).length, 1);
});

test('manual engine accepts only a durable task and forwards safe tenant locators', () => {
  assert.match(engineSource, /^\/\* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1/);
  assert.doesNotThrow(() => new Function('V8', engineSource));
  assert.doesNotMatch(engineSource, /DbConn|DbReadConn|ExpectedDatabaseName|Password\s*:/);

  let hostRequest;
  const progress = [];
  const result = execute({
    Param: {
      TenantId: 'tenant-row-id',
      TenantKey: 'jisu1',
      OsClientType: 'Product',
      OsClientNetwork: 'Internal',
      _BackgroundTaskId: 'task-id',
      _BackgroundTaskFencingToken: 7,
      ApiEngineKey: 'admin_upgrade_saas_tenant_database',
      OsClient: 'iTdos',
      _RequireApiRoleAuthorization: true,
      _TraceParent: '00-daa279013d1e7446c25bab27f05118d6-c015ba856c2e9d69-00',
      _BackgroundTaskTitle: '租户数据库升级',
      _BackgroundTaskIdempotencyKey: 'upgrade:test-tenant:v1',
      _BackgroundTaskAttempt: 1,
      _TrustedServerInvocation: true,
      _BackgroundTask: { Id: 'task-id', FencingToken: 7 },
      _InvokeType: 'Client',
    },
    Method: {
      UpdateBackgroundTask(value) { progress.push(value); },
      UpgradeAdminTenantDatabase(value) {
        hostRequest = value;
        return {
          Code: 1,
          Data: { BeforeVersion: '7.8.5', TargetVersion: '7.8.6', AfterVersion: '7.8.6' },
          Msg: '完成',
        };
      },
    },
  });

  assert.equal(result.Code, 1);
  assert.deepEqual(hostRequest, {
    TenantId: 'tenant-row-id',
    TenantKey: 'jisu1',
    OsClientType: 'Product',
    OsClientNetwork: 'Internal',
    _BackgroundTaskId: 'task-id',
    _BackgroundTaskFencingToken: 7,
  });
  assert.equal(progress.at(0).Progress, 1);
  assert.equal(progress.at(-1).Progress, 100);
  assert.doesNotMatch(JSON.stringify(hostRequest), /Password|DbConn/);
});

test('manual engine fails closed without the task fence or trusted host atom', () => {
  const base = {
    TenantId: 'tenant-row-id', TenantKey: 'jisu1',
    OsClientType: 'Product', OsClientNetwork: 'Internal',
    _BackgroundTaskId: 'task-id', _BackgroundTaskFencingToken: 7,
    _TrustedServerInvocation: true, _InvokeType: 'Client',
  };
  assert.equal(execute({ Param: { ...base, _BackgroundTaskFencingToken: 0 }, Method: {} }).Code, 0);
  assert.equal(execute({ Param: base, Method: { UpdateBackgroundTask() {} } }).Code, 0);
  assert.equal(execute({ Param: { ...base, Password: 'must-not-enter-logs' }, Method: {} }).Code, 0);
  assert.match(
    execute({ Param: { ...base, UnexpectedTransportField: 'secret-value' }, Method: {} }).Msg,
    /UnexpectedTransportField/,
  );
  assert.doesNotMatch(
    execute({ Param: { ...base, UnexpectedTransportField: 'secret-value' }, Method: {} }).Msg,
    /secret-value/,
  );
  assert.equal(execute({ Param: { ...base, _RequireApiRoleAuthorization: false }, Method: {} }).Code, 0);
  assert.equal(execute({ Param: { ...base, _TrustedServerInvocation: false }, Method: {} }).Code, 0);
  assert.equal(execute({ Param: { ...base, _TrustedServerInvocation: undefined }, Method: {} }).Code, 0);
  assert.equal(execute({ Param: { ...base, _InvokeType: 'Server' }, Method: {} }).Code, 0);
  assert.equal(execute({ Param: { ...base, _BackgroundTaskAttempt: -1 }, Method: {} }).Code, 0);
  assert.equal(execute({ Param: { ...base, _TraceParent: 'invalid' }, Method: {} }).Code, 0);
});

test('both embedded platform-service bundles contain the progress route and same runtime', () => {
  const findBundle = model => model.ApplicationBundles
    .find(item => item.Application?.AppKey === 'microi-platform-service');
  const saasBundle = findBundle(packageModel);
  const storeBundle = findBundle(storePackage);
  for (const bundle of [saasBundle, storeBundle]) {
    assert.equal(bundle.VersionNo, 'v1.9.12');
    assert.equal(bundle.Application.CurrentVersion, 54);
    assert.ok(bundle.Routes.some(route => route.RoutePath === '/tenant-database-upgrade'));
  }
  assert.equal(saasBundle.MicroService.DistHash, storeBundle.MicroService.DistHash);
});
