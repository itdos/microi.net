import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDir, '..', '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(workspaceRoot, relativePath), 'utf8');
}

function normalizeSource(value) {
  return `${String(value || '').replace(/\r\n?/g, '\n').replace(/\n*$/g, '')}\n`;
}

test('official background task engine owns action routing and calls one trusted V8 primitive', () => {
  const source = read('Microi.Server/Microi.Upgrade/Resource/platform-background-task.js');
  for (const action of [
    'List', 'Detail', 'Status', 'WorkerStatus',
    'ClearCompleted', 'Remove', 'Cancel', 'RunApiEngine'
  ]) {
    assert.match(source, new RegExp(`\\b${action}\\b`));
  }
  assert.match(source, /V8\.Method\.ManageBackgroundTask\(V8\.Param\)/);
  assert.doesNotMatch(source, /V8\.Db\.(?:FromSql|FromSqlAsync)/);
});

test('application-store package delivers every startup endpoint and managed policy atomically', () => {
  const packageModel = JSON.parse(read('Microi.Server/Microi.Upgrade/Resource/app.microi.store.json'));
  const dependencies = [
    {
      key: 'platform-background-task',
      source: 'Microi.Server/Microi.Upgrade/Resource/platform-background-task.js',
      address: '/apiengine/platform-background-task',
      version: 'v1.1.0',
      capabilities: [
        'ServerFeature:V8.ManageBackgroundTask',
        'ApiEngine:platform-background-task@v1.1.0',
      ],
    },
    {
      key: 'platform-sys-menu',
      source: 'Microi.Server/Microi.Upgrade/Resource/platform-sys-menu.js',
      address: '/apiengine/platform-sys-menu',
      version: 'v1.0.1',
      capabilities: [
        'V8.Method.ManageSystemDirectory',
        'ApiEngine:platform-sys-menu@v1.0.1',
      ],
    },
  ];
  assert.equal(packageModel.PackageInfo.Version, 'v7.7.3');
  for (const dependency of dependencies) {
    const matches = packageModel.SysApiEngines.filter(
      item => item.ApiEngineKey === dependency.key,
    );
    assert.equal(matches.length, 1, dependency.key);
    const engine = matches[0];
    assert.equal(engine.ApiAddress, dependency.address);
    assert.equal(engine.Version, dependency.version);
    assert.equal(engine.IsEnable, 1);
    assert.equal(engine.StopHttp, 0);
    assert.equal(engine.AllowAnonymous, 0);
    assert.equal(engine.ApiV8Code, normalizeSource(read(dependency.source)));
    assert.deepEqual(packageModel.ResourcePolicies.ApiEngines[dependency.key], {
      Ownership: 'Platform',
      UpgradePolicy: 'Managed',
    });
    for (const capability of dependency.capabilities) {
      assert.ok(packageModel.PackageInfo.RequiredPlatformCapabilities.includes(capability));
    }
  }
  assert.equal(packageModel.PackageInfo.ApiEngineCount, packageModel.SysApiEngines.length);
});

test('application-store upgrade rejects packages or tenants missing any startup dependency', () => {
  const upgrade = read('Microi.Server/Microi.Upgrade/13-UpgradeAppStore.cs');
  assert.match(upgrade, /PlatformBackgroundTaskEngineKey\s*=\s*"platform-background-task"/);
  assert.match(upgrade, /PlatformSysMenuEngineKey\s*=\s*"platform-sys-menu"/);
  assert.match(upgrade, /平台后台任务接口缺失或版本过低/);
  assert.match(upgrade, /平台菜单启动接口缺失或版本过低/);
  assert.match(upgrade, /ValidateInstalledAppStoreRuntimeDependencies/);
  assert.match(upgrade, /应用商城运行时依赖回读失败/);
  assert.match(upgrade, /new System\.Version\(7, 5, 55\)/);
  assert.match(upgrade, /MARKETPLACE_LEGACY_IMPORTER_HDFS_BRIDGE_V1/);
});

test('platform clients no longer depend on BackgroundTaskController routes', () => {
  const files = [
    'Microi.Client/src/layout/components/BackgroundTaskCenter.vue',
    'Microi.Client/src/utils/diy.common.js',
    'Microi.Client/src/views/form-engine/diy-components/DiyImportDialog.vue',
    'microi.mcp/src/api-paths.ts',
    'AI-Project/microi/AI应用/microi-platform-service/src/Marketplace.vue',
    'AI-Project/microi/AI应用/microi-platform-service/src/OfflinePackageInstaller.vue',
    'AI-Project/microi/AI应用/microi-platform-service/src/CreateSaasTenant.vue'
  ];
  for (const file of files) {
    assert.doesNotMatch(read(file), /\/api\/BackgroundTask\//, file);
  }
});

test('background task runtime is exposed as a V8 primitive instead of an MVC controller', () => {
  const contract = read('Microi.Server/Microi.Core/Interface/IV8Method.cs');
  const implementation = read('Microi.Server/Microi.Core/V8Engine/Runtime/V8Method.cs');
  const workerRuntime = read('Microi.Server/Microi.Core/Runtime/BackgroundTaskWorkerRuntime.cs');
  assert.match(contract, /DosResult ManageBackgroundTask\(dynamic dynamicParam\)/);
  assert.match(implementation, /public DosResult ManageBackgroundTask\(dynamic dynamicParam\)/);
  assert.match(implementation, /V8TrustedExecutionContext\.CurrentUser/);
  assert.match(implementation, /GetAuthoritativeApiEngineModel/);
  assert.match(implementation, /ApiEngineRoleAuthorization\.Evaluate/);
  assert.match(implementation, /request\["TargetApiEngineKey"\]/);
  assert.match(workerRuntime, /public static class BackgroundTaskWorkerRuntime/);
  assert.equal(
    fs.existsSync(path.join(
      workspaceRoot,
      'Microi.Server/Microi.net.Api/Controllers/BackgroundTaskController.cs'
    )),
    false
  );
});
