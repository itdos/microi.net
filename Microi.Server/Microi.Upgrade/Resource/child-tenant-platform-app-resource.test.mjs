import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const readJson = name => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const modulePackage = readJson("app.microi.module-engine.json");
const saasPackage = readJson("app.microi.saas-engine.json");
const taskServiceSource = fs.readFileSync(
  path.join(directory, "../../Microi.Core/Runtime/BackgroundTaskService.cs"),
  "utf8"
);

test("module package exposes the menu badge tooltip as a physical field", () => {
  assert.equal(modulePackage.PackageInfo.Version, "v7.5.4");
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
  assert.equal(saasPackage.PackageInfo.Version, "v7.5.15");
  const key = "bulk-update-child-tenant-platform-apps";
  const engine = saasPackage.SysApiEngines.find(item => item.ApiEngineKey === key);
  assert.ok(engine);
  assert.equal(engine.StopHttp, 1);
  assert.match(engine.ApiV8Code, /GetChildTenantPlatformAppMaintenanceTargets/);
  assert.match(engine.ApiV8Code, /QueueChildTenantPlatformAppMaintenance/);
  assert.match(engine.ApiV8Code, /CHILD_PLATFORM_APP_BOOTSTRAP_V1/);
  assert.match(engine.ApiV8Code, /CHILD_TASK_TERMINAL_AGGREGATION_V1/);
  assert.match(engine.ApiV8Code, /CHILD_TASK_AGGREGATE_PROGRESS_V1/);
  assert.match(engine.ApiV8Code, /Current: normalizedProgress/);
  assert.match(engine.ApiV8Code, /Total: 100/);
  assert.match(engine.ApiV8Code, /Phase: 'Monitor'/);
  assert.match(engine.ApiV8Code, /Status == 'Failed' \|\| childStatus == 'Canceled'/);
  assert.match(engine.ApiV8Code, /MaxItemsPerChunk|batchSize = 20/);
  assert.match(engine.ApiV8Code, /queueFailureDetail/);
  assert.match(engine.ApiV8Code, /item\.Name \|\| item\.OsClient/);
  assert.equal(engine.Version, "v1.1.2");
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

test("target tenant marker is stripped from public submissions and restored after continuations", () => {
  assert.match(taskServiceSource, /param\.Remove\(TargetExecutionOsClientParam\)/);
  assert.match(taskServiceSource, /StartApiEngineForTargetTenant/);
  assert.match(taskServiceSource, /TryGetCurrentExecutionContext/);
  assert.match(taskServiceSource, /nextParam\[TargetExecutionOsClientParam\] = executionOsClient/);
});
