import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const readJson = name => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const versionParts = value => String(value || "").replace(/^v/i, "").split(".")
  .map(part => Number.parseInt(part, 10) || 0);
const versionAtLeast = (actual, minimum) => {
  const left = versionParts(actual);
  const right = versionParts(minimum);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if ((left[index] || 0) !== (right[index] || 0)) {
      return (left[index] || 0) > (right[index] || 0);
    }
  }
  return true;
};
const modulePackage = readJson("app.microi.module-engine.json");
const saasPackage = readJson("app.microi.saas-engine.json");
const taskServiceSource = fs.readFileSync(
  path.join(directory, "../../Microi.Core/Runtime/BackgroundTaskService.cs"),
  "utf8"
);
const maintenanceGeneratorSource = fs.readFileSync(
  path.join(directory, "configure-child-tenant-platform-app-maintenance-resource.mjs"),
  "utf8"
);

test("module package exposes the menu badge tooltip as a physical field", () => {
  assert.equal(modulePackage.PackageInfo.Version, "v7.6.1");
  assert.ok(modulePackage.PackageInfo.RequiredPlatformCapabilities.includes(
    "ServerField:SysMenu.MenuBadgeTooltip"
  ));
  assert.match(modulePackage.DDLStatements[0].DDL, /\bMenuBadgeTooltip\b/);
  const physical = modulePackage.PhysicalColumns.find(item => item.COLUMN_NAME === "MenuBadgeTooltip");
  assert.equal(physical?.COLUMN_TYPE, "varchar(500)");
  const field = modulePackage.DiyFields.find(item => item.Name === "MenuBadgeTooltip");
  assert.equal(field?.Component, "Text");
  assert.equal(field?.Visible, 1);
  assert.match(field?.Description || "", /鼠标移入.*数字角标/);
  assert.equal(modulePackage.PackageInfo.FieldCount, modulePackage.DiyFields.length);
  assert.equal(modulePackage.PackageInfo.PhysicalColumnCount, modulePackage.PhysicalColumns.length);
});

test("SaaS package owns the main-tenant fan-out engine and page button", () => {
  assert.ok(
    versionAtLeast(saasPackage.PackageInfo.Version, "v7.5.31"),
    `SaaS package must retain the child-tenant fan-out baseline, current=${saasPackage.PackageInfo.Version}`,
  );
  const key = "bulk-update-child-tenant-platform-apps";
  const engine = saasPackage.SysApiEngines.find(item => item.ApiEngineKey === key);
  assert.ok(engine);
  assert.equal(engine.StopHttp, 1);
  assert.match(engine.ApiV8Code, /GetChildTenantPlatformAppMaintenanceTargets/);
  assert.match(engine.ApiV8Code, /QueueChildTenantPlatformAppMaintenance/);
  assert.match(engine.ApiV8Code, /CHILD_PLATFORM_APP_BOOTSTRAP_V1/);
  assert.match(engine.ApiV8Code, /CHILD_TASK_TERMINAL_AGGREGATION_V1/);
  assert.match(engine.ApiV8Code, /CHILD_TASK_AGGREGATE_PROGRESS_V1/);
  assert.match(engine.ApiV8Code, /CHILD_TASK_MONITOR_CHECKPOINT_ONLY_V1/);
  assert.match(engine.ApiV8Code, /CHILD_TASK_PARTIAL_QUEUE_MONITOR_V1/);
  assert.match(engine.ApiV8Code, /CHILD_TASK_RUNTIME_RELOAD_FALLBACK_V1/);
  assert.match(engine.ApiV8Code, /discoverTargetsWithRuntimeRecovery/);
  assert.match(engine.ApiV8Code, /V8\.Method\.ReloadOsClient/);
  const recoveryHelperIndex = engine.ApiV8Code.indexOf(
    "function discoverTargetsWithRuntimeRecovery"
  );
  const queueGuardIndex = engine.ApiV8Code.indexOf("if (phase == 'Queue')");
  const targetDiscoveryIndex = engine.ApiV8Code.indexOf(
    "GetChildTenantPlatformAppMaintenanceTargets",
    recoveryHelperIndex
  );
  const queueRecoveryCallIndex = engine.ApiV8Code.indexOf(
    "discoverTargetsWithRuntimeRecovery(executionParam)",
    queueGuardIndex
  );
  assert.ok(recoveryHelperIndex >= 0 && targetDiscoveryIndex > recoveryHelperIndex);
  assert.ok(queueGuardIndex >= 0 && queueRecoveryCallIndex > queueGuardIndex);
  assert.equal(
    engine.ApiV8Code.indexOf("GetChildTenantPlatformAppMaintenanceTargets", targetDiscoveryIndex + 1),
    -1
  );
  assert.match(engine.ApiV8Code, /Current: normalizedProgress/);
  assert.match(engine.ApiV8Code, /Total: 100/);
  assert.match(engine.ApiV8Code, /Phase: 'Monitor'/);
  assert.match(engine.ApiV8Code, /Status == 'Failed' \|\| childStatus == 'Canceled'/);
  assert.match(engine.ApiV8Code, /MaxItemsPerChunk|batchSize = 20/);
  assert.match(engine.ApiV8Code, /queueFailureDetail/);
  assert.match(engine.ApiV8Code, /item\.Name \|\| item\.OsClient/);
  assert.equal(engine.Version, "v1.2.5");
  assert.match(engine.ApiV8Code, /CHILD_STARTUP_DEPENDENCY_INCIDENT_SCOPE_V1/);
  assert.match(engine.ApiV8Code, /CHILD_STARTUP_SCOPE_CHILD_PARAM_PATCH_V1/);
  assert.match(engine.ApiV8Code, /enforceStartupDependencyScope/);
  assert.match(engine.ApiV8Code, /childParam\.RequiredAppIds = \['app\.microi\.saas-engine'\]/);
  assert.match(engine.ApiV8Code, /Status='Pending' AND CancelRequested=0/);
  assert.match(engine.ApiV8Code, /cancelUnsafeChildTask/);
  assert.match(engine.ApiV8Code, /CHILD_STARTUP_BOOTSTRAP_REFRESH_V1/);
  assert.match(engine.ApiV8Code, /startup-api-runtime-flags-v4/);
  assert.match(engine.ApiV8Code, /phase = 'RefreshBootstrap'/);
  assert.match(engine.ApiV8Code, /CHILD_STARTUP_BOOTSTRAP_REVISION_RESTART_V1/);
  assert.match(engine.ApiV8Code, /checkpoint\.BootstrapRefreshRevision/);
  assert.match(engine.ApiV8Code, /checkpoint\.BootstrapRefreshIndex = 0/);
  assert.match(engine.ApiV8Code, /BootstrapRefreshRevision: startupBootstrapRevision/);
  assert.match(engine.ApiV8Code, /refreshedTaskId != text\(refreshTask\.TaskId\)/);
  assert.match(engine.ApiV8Code, /key == 'jhyxdkj'/);
  assert.match(engine.ApiV8Code, /key == 'lsg'/);
  assert.match(engine.ApiV8Code, /MaintenanceScope: maintenanceScope/);
  assert.ok(
    saasPackage.PackageInfo.RequiredPlatformCapabilities.includes(
      "BackgroundTask:StartupDependencyIncidentScope",
    ),
  );
  assert.ok(
    saasPackage.PackageInfo.RequiredPlatformCapabilities.includes(
      "BackgroundTask:StartupBootstrapRevisionReset",
    ),
  );
  assert.ok(
    saasPackage.PackageInfo.RequiredPlatformCapabilities.includes(
      "BackgroundTask:StartupBootstrapRuntimeFlagRefresh",
    ),
  );
  assert.equal(
    saasPackage.ResourcePolicies.ApiEngines[key]?.UpgradePolicy,
    "Managed"
  );

  const menu = saasPackage.SysMenus.find(item => item.Url === "/osclients");
  const buttons = JSON.parse(menu.PageBtns || "[]");
  const button = buttons.find(item => item.Id === "bulk-update-child-tenant-platform-apps-page-btn");
  assert.equal(button?.Name, "一键为所有子租户安装/更新所有平台应用");
  assert.match(button?.V8CodeShow || "", /IsMainTenant/);
  assert.match(button?.V8CodeShow || "", /Level/);
  assert.match(button?.V8Code || "", /RunBackground/);
  assert.match(button?.V8Code || "", /microi-background-task-started/);
  assert.equal(saasPackage.PackageInfo.ApiEngineCount, saasPackage.SysApiEngines.length);
});

test("child-tenant maintenance generator preserves newer package metadata", () => {
  assert.match(
    maintenanceGeneratorSource,
    /ensureMinimumPackageVersion\(saasPackage\.PackageInfo, "v7\.5\.31"\)/,
  );
  assert.doesNotMatch(
    maintenanceGeneratorSource,
    /saasPackage\.PackageInfo\.Version\s*=\s*"v7\.5\.31"/,
  );
  assert.doesNotMatch(maintenanceGeneratorSource, /PackageInfo\.ChangeLog\s*=/);
});

test("startup bootstrap refresh restarts the same idempotent round when its revision changes mid-slice", () => {
  const engine = saasPackage.SysApiEngines.find(
    item => item.ApiEngineKey === "bulk-update-child-tenant-platform-apps",
  );
  assert.ok(engine);
  const childTasks = [
    { OsClient: "tenant-00", TaskId: "task-00" },
    { OsClient: "Jhyxdkj", TaskId: "task-jhyx" },
    { OsClient: "tenant-01", TaskId: "task-01" },
    { OsClient: "lsg", TaskId: "task-lsg" },
    ...Array.from({ length: 21 }, (_, index) => ({
      OsClient: `tenant-${String(index + 2).padStart(2, "0")}`,
      TaskId: `task-${String(index + 2).padStart(2, "0")}`,
    })),
  ];
  const refreshed = [];
  const taskId = "parent-task";
  const V8 = {
    CurrentUser: { Id: "admin", Level: 9999 },
    Param: {
      _BackgroundTaskId: taskId,
      _BackgroundTask: { Id: taskId },
      _BackgroundTaskFencingToken: 9,
      _TrustedServerInvocation: true,
      _BackgroundTaskCheckpoint: {
        Version: 3,
        TaskId: taskId,
        Phase: "RefreshBootstrap",
        MaintenanceScope: "StartupDependencies",
        BootstrapRefreshIndex: 20,
        ChildTasks: childTasks,
        AttemptedTargets: [],
        Failures: [],
        BootstrapRefreshFailures: [],
      },
    },
    Method: {
      UpdateBackgroundTask() {},
      QueueChildTenantPlatformAppMaintenance(param) {
        const match = childTasks.find(
          item => item.OsClient.toLowerCase() === String(param.TargetOsClient).toLowerCase(),
        );
        refreshed.push(param.TargetOsClient);
        return { Code: 1, Data: { TaskId: match.TaskId } };
      },
    },
  };

  const result = new Function("V8", engine.ApiV8Code)(V8);
  assert.equal(result.Code, 1);
  assert.equal(result.Data.BackgroundTask.HasMore, true);
  assert.equal(result.Data.BackgroundTask.Checkpoint.BootstrapRefreshIndex, 20);
  assert.equal(
    result.Data.BackgroundTask.Checkpoint.BootstrapRefreshRevision,
    "startup-api-runtime-flags-v4",
  );
  assert.equal(refreshed.length, 20);
  assert.deepEqual(refreshed.slice(0, 2), ["Jhyxdkj", "lsg"]);
});

test("target tenant marker is stripped from public submissions and restored after continuations", () => {
  assert.match(taskServiceSource, /param\.Remove\(TargetExecutionOsClientParam\)/);
  assert.match(taskServiceSource, /StartApiEngineForTargetTenant/);
  assert.match(taskServiceSource, /TryGetCurrentExecutionContext/);
  assert.match(taskServiceSource, /nextParam\[TargetExecutionOsClientParam\] = executionOsClient/);
});
