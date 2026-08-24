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
