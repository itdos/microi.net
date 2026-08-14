import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const resourceUrl = new URL("./", import.meta.url);
const packageModel = JSON.parse(await readFile(new URL("app.microi.store.json", resourceUrl), "utf8"));
const bulkSource = await readFile(new URL("bulk-import-packages.js", resourceUrl), "utf8");
const importerSource = await readFile(new URL("import-package.js", resourceUrl), "utf8");
const statSource = await readFile(new URL("official-marketplace-install-stat.js", resourceUrl), "utf8");

function normalizeSource(value) {
  return `${String(value || "").replace(/\r\n?/g, "\n").replace(/\n*$/g, "")}\n`;
}

function parseButtons(value) {
  return value ? JSON.parse(value) : [];
}

function extractNamedFunction(sourceText, name) {
  const start = sourceText.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const brace = sourceText.indexOf("{", start);
  let depth = 0;
  for (let index = brace; index < sourceText.length; index += 1) {
    if (sourceText[index] === "{") depth += 1;
    if (sourceText[index] === "}" && --depth === 0) return sourceText.slice(start, index + 1);
  }
  assert.fail(`unterminated function ${name}`);
}

function compareSemver(actual, minimum) {
  const parse = (value) => String(value || "")
    .replace(/^v/i, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10));
  const left = parse(actual);
  const right = parse(minimum);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const delta = (left[index] || 0) - (right[index] || 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

test("application-store package hides every install mutation on the official platform", () => {
  assert.ok(
    compareSemver(packageModel.PackageInfo.Version, "v7.1.3") >= 0,
    `application-store package must be at least v7.1.3, got ${packageModel.PackageInfo.Version}`
  );
  const menu = packageModel.SysMenus.find((item) => item.Url === "/microi-store");
  assert.ok(menu, "application-store menu is missing");

  const rowButtons = parseButtons(menu.MoreBtns);
  for (const [name, action] of [["安装", "Install"], ["更新", "Update"], ["重新安装", "Reinstall"]]) {
    const button = rowButtons.find((item) => item.Name === name);
    assert.ok(button, `${name} button is missing`);
    assert.match(button.V8CodeShow, /IsOfficialPlatform === true/);
    assert.equal(button.InstallAction, action);
    assert.equal(button.ApiEngineKey, "import-microi-store-package");
    assert.equal(button.RunBackground, true);
  }

  const pageButtons = parseButtons(menu.PageBtns);
  const offline = pageButtons.find((item) => item.Name === "安装离线包");
  const bulk = pageButtons.find((item) => item.Name === "全部安装/更新");
  assert.match(offline.V8CodeShow, /IsOfficialPlatform === true/);
  assert.match(bulk.V8CodeShow, /IsOfficialPlatform === true/);
  assert.match(bulk.V8CodeShow, /Level/);
  assert.match(bulk.V8Code, /RunBackground\('bulk-import-microi-store-packages'/);
  assert.match(bulk.V8Code, /已是最新版的应用不会重新安装/);
  assert.match(bulk.V8Code, /ApplicationType: 'Platform'/);
  assert.match(bulk.V8Code, /官方平台应用/);
  assert.match(bulk.V8Code, /BULK_QUEUE_PREFLIGHT_DIAGNOSTICS_V1/);
  assert.match(bulk.V8Code, /BackgroundTask\/WorkerStatus/);
  assert.match(bulk.V8Code, /mci_background_task 表已升级/);
  assert.match(bulk.V8Code, /平台已保留普通任务执行槽/);
  assert.equal(bulk.Workload.ExpectedItems, 29);
  assert.equal(bulk.Workload.ExecutionMode, undefined);
});

test("bulk install persists its plan in the shared background-task checkpoint", () => {
  assert.match(bulkSource, /BACKGROUND_TASK_CHECKPOINT_PLAN_V2/);
  assert.match(bulkSource, /BACKGROUND_TASK_TRUSTED_BOOTSTRAP_V1/);
  assert.match(bulkSource, /trustedInvocation[\s\S]*&& !!taskId[\s\S]*taskEnvelope\.Id[\s\S]*fencingToken/);
  assert.doesNotMatch(bulkSource, /\|\| \(text\(taskEnvelope\.Id\)/);
  assert.doesNotMatch(bulkSource, /mci_marketplace_bulk_install_item/);
  assert.match(bulkSource, /status != 'Uninstalled' && status != 'Outdated'/);
  assert.match(bulkSource, /InstallAction: status == 'Outdated' \? 'Update' : 'Install'/);
  assert.match(bulkSource, /BackgroundTask:\s*\{[\s\S]*?HasMore: true,[\s\S]*?Checkpoint:/);
  assert.match(bulkSource, /Plan: plan/);
  assert.match(bulkSource, /ChildCheckpoint/);
  assert.match(bulkSource, /UpdateBackgroundTask/);
  assert.match(bulkSource, /V8\.ApiEngine\.Run\('import-microi-store-package'/);
  assert.match(bulkSource, /BULK_CHILD_FAILURE_DETAIL_V1/);
  assert.match(bulkSource, /BULK_PLATFORM_ONLY_PLAN_V1/);
  assert.match(bulkSource, /BULK_ADAPTIVE_SINGLE_SLICE_V1/);
  assert.match(bulkSource, /BULK_FAILURE_RECOVERY_DIAGNOSTICS_V1/);
  assert.match(bulkSource, /BULK_STORAGE_FAILURE_RECOVERY_V1/);
  assert.match(bulkSource, /BULK_MONOTONIC_CHILD_PROGRESS_V1/);
  assert.match(bulkSource, /resumedChildProgress = childCheckpointProgress\(childCheckpoint\)/);
  assert.match(bulkSource, /currentIndex \+ resumedChildProgress \/ 100/);
  assert.match(bulkSource, /object_storage_forbidden/i);
  assert.match(bulkSource, /RecoveryHint/);
  assert.match(bulkSource, /FailureStage/);
  assert.match(bulkSource, /ApplicationType: bulkApplicationType/);
  assert.match(bulkSource, /trim\(row\.ApplicationType \|\| row\.AppType\) != bulkApplicationType/);
  assert.match(bulkSource, /checkpointVersion[\s\S]*checkpointVersion < 3[\s\S]*phase = 'Discover'/);
  assert.match(bulkSource, /BulkAdaptiveSingleSlice: true/);
  assert.match(bulkSource, /childFailureDetail\(childResult\)/);
  assert.match(bulkSource, /ChildData:/);
  assert.doesNotMatch(bulkSource, /localStorage|sessionStorage|static\s+/i);

  const fixture = {
    text: value => value === null || value === undefined ? "" : String(value),
    toInt: (value, fallback) => Number.isNaN(Number.parseInt(value, 10)) ? fallback : Number.parseInt(value, 10),
  };
  vm.runInNewContext(
    `${extractNamedFunction(bulkSource, "childCheckpointProgress")}\nresult = childCheckpointProgress;`,
    fixture,
  );
  assert.equal(fixture.result({ Phase: "Physical", Index: 4 }), 55);
  assert.equal(fixture.result({ Phase: "PostSchema" }), 70);
  assert.equal(fixture.result({ Phase: "Physical", Progress: 58 }), 58);
});

test("every install action reports one stable operation to the authoritative counter", () => {
  assert.match(importerSource, /InstallOperationId/);
  assert.match(importerSource, /InstallAction: installAction/);
  assert.match(importerSource, /OperationId: installOperationId/);
  assert.match(importerSource, /official_marketplace_install_stat/);
  assert.match(importerSource, /MARKETPLACE_INSTALL_STAT_STRING_RESPONSE_V1/);
  assert.match(importerSource, /SKIP_INSTALL_COUNT_WITHOUT_MARKETPLACE_ID_V1/);
  assert.match(importerSource, /LEGACY_INSTALL_VERSION_IDENTITY_FALLBACK_V1/);
  assert.match(importerSource, /findInstallVersionRecord/);
  assert.match(importerSource, /\['AppName', '=', identity\.AppName\]/);
  assert.match(importerSource, /if \(!marketplaceInstallIdentity\)[\s\S]*install_count_skipped_no_identity[\s\S]*return;/);
  assert.match(importerSource, /typeof remoteStat == 'string'[\s\S]*JSON\.parse\(remoteStat\)[\s\S]*remoteStat\.Code == 1/);
  assert.doesNotMatch(importerSource, /UPDATE\s+`?sys_microistore`?\s+SET\s+`?InstallCount`?/i);

  assert.match(statSource, /mci_marketplace_install_event/);
  assert.match(statSource, /INSERT IGNORE INTO `mci_marketplace_install_event`/);
  assert.match(statSource, /OperationId不能为空/);
  assert.match(statSource, /InstallAction仅支持Install、Update或Reinstall/);
  assert.match(statSource, /InstallCount`=COALESCE\(`InstallCount`,0\)\+1/);
  assert.match(statSource, /RedisCompatibility/);
});

test("the embedded bulk engine exactly matches its maintained source", () => {
  const engine = packageModel.SysApiEngines.find(
    (item) => item.ApiEngineKey === "bulk-import-microi-store-packages",
  );
  assert.ok(engine, "embedded bulk engine is missing");
  assert.equal(engine.Version, "v1.1.6");
  assert.equal(engine.IsEnable, 1);
  assert.equal(engine.StopHttp, 0);
  assert.equal(engine.ApiV8Code, normalizeSource(bulkSource));
  assert.equal(packageModel.PackageInfo.ApiEngineCount, packageModel.SysApiEngines.length);
});

test("package importer fails closed when an API engine is not durably persisted", () => {
  assert.match(importerSource, /Version: v2\.0\.0/);
  assert.match(importerSource, /REMOTE_ZIP_SINGLE_ASSET_SLICE_V1/);
  assert.match(importerSource, /ADMIN_MENU_PERMISSION_V1/);
  assert.match(importerSource, /ADMIN_MENU_PERMISSION_PHYSICAL_FALLBACK_V1/);
  assert.match(importerSource, /ADMIN_MENU_PERMISSION_DB_TIME_V1/);
  assert.match(importerSource, /BACKGROUND_TASK_PERSISTED_PROGRESS_FLOOR_V1/);
  assert.match(importerSource, /MYSQL_BIT_NUMERIC_COMPAT_V1/);
  assert.match(importerSource, /BULK_SMALL_PACKAGE_SINGLE_SLICE_V1/);
  assert.match(importerSource, /MYSQL_ROW_SIZE_OFFPAGE_FALLBACK_V1/);
  assert.match(importerSource, /MySqlOffpageTypeOverrides/);
  assert.match(importerSource, /isMysqlRowSizeTooLargeError/);
  assert.match(importerSource, /applyPackageColumnTypeOverride/);
  assert.match(importerSource, /ADD COLUMN触发MySQL 65535字节行宽上限/);
  assert.match(importerSource, /CREATE TABLE触发MySQL 65535字节行宽上限/);
  assert.match(importerSource, /isPackageColumnIndexed/);
  assert.match(importerSource, /trustedBulkAdaptiveInvocation/);
  assert.match(importerSource, /fieldCount <= 160/);
  assert.match(importerSource, /assetContentChars <= 8 \* 1024 \* 1024/);
  assert.match(importerSource, /PACKAGE_API_ENGINE_READBACK_V1/);
  assert.match(importerSource, /assertPersistedApiEngine\(apiEngine, updatedEngine\)/);
  assert.match(importerSource, /assertPersistedApiEngine\(apiEngine, insertedEngine\)/);
  assert.match(importerSource, /throw new Error\('更新接口引擎失败：'/);
  assert.match(importerSource, /throw new Error\('新增接口引擎失败：'/);
  assert.match(importerSource, /actualCode !== expectedCode/);
  assert.match(importerSource, /API_ENGINE_RESOURCE_BASELINE_V1/);
  assert.match(importerSource, /UpgradePolicy == 'CreateIfMissing'/);
  assert.match(importerSource, /TRUSTED_OFFICIAL_PLATFORM_PACKAGE_V1/);
  assert.match(importerSource, /PLATFORM_API_ENGINE_PRESERVE_NEWER_V1/);
  assert.match(importerSource, /DATABASE_ONLY_BUILD_ASSETS_V1/);
  assert.match(importerSource, /OBJECT_STORAGE_FORBIDDEN/);
  assert.match(importerSource, /BACKGROUND_TASK_MONOTONIC_PROGRESS_V1/);
  assert.match(importerSource, /managedDecision == 'PreserveNewer'/);
  assert.match(importerSource, /接口引擎升级冲突/);

  const embeddedImporter = packageModel.SysApiEngines.find(
    (item) => item.ApiEngineKey === "import-microi-store-package",
  );
  assert.ok(embeddedImporter, "embedded package importer is missing");
  assert.equal(embeddedImporter.Version, "v2.0.0");
  assert.equal(embeddedImporter.ApiV8Code, normalizeSource(importerSource));
});
