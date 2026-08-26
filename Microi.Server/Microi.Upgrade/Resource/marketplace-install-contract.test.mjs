import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const resourceUrl = new URL("./", import.meta.url);
const packageModel = JSON.parse(await readFile(new URL("app.microi.store.json", resourceUrl), "utf8"));
const bulkSource = await readFile(new URL("bulk-import-packages.js", resourceUrl), "utf8");
const importerSource = await readFile(new URL("import-package.js", resourceUrl), "utf8");
const statSource = await readFile(new URL("official-marketplace-install-stat.js", resourceUrl), "utf8");
const apiEngineSource = await readFile(new URL("../../Microi.net/ApiEngine/ApiEngine.cs", resourceUrl), "utf8");

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
  const menu = packageModel.SysMenus.find((item) => item.Url === "/microi-store" && item.Display === 1);
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
  assert.match(bulk.V8Code, /\/apiengine\/platform-background-task/);
  assert.doesNotMatch(bulk.V8Code, /\/api\/BackgroundTask\/WorkerStatus/);
  assert.match(bulk.V8Code, /mci_background_task 表已升级/);
  assert.match(bulk.V8Code, /平台已保留普通任务执行槽/);
  assert.equal(bulk.Workload.ExpectedItems, 29);
  assert.equal(bulk.Workload.ExecutionMode, undefined);
});

test("official publishing database blocks every marketplace installer before V8 execution", () => {
  assert.match(apiEngineSource, /OfficialPlatformBlockedMarketplaceEngineKeys/);
  assert.match(apiEngineSource, /"import-microi-store-package"/);
  assert.match(apiEngineSource, /"bulk-import-microi-store-packages"/);
  const guardIndex = apiEngineSource.indexOf("OfficialPlatformBlockedMarketplaceEngineKeys.Contains(param.ApiEngineKey)");
  const executionIndex = apiEngineSource.indexOf("new V8Engine().Run", guardIndex);
  assert.ok(guardIndex >= 0, "official source guard is missing");
  assert.ok(executionIndex === -1 || executionIndex > guardIndex, "official source guard must execute before importer V8");
  assert.match(apiEngineSource, /不允许安装、更新、重新安装或批量安装商城应用/);
});

test("bulk install persists its plan in the shared background-task checkpoint", () => {
  assert.match(bulkSource, /BACKGROUND_TASK_CHECKPOINT_PLAN_V2/);
  assert.match(bulkSource, /BACKGROUND_TASK_TRUSTED_BOOTSTRAP_V1/);
  assert.match(bulkSource, /trustedInvocation[\s\S]*&& !!taskId[\s\S]*taskEnvelope\.Id[\s\S]*fencingToken/);
  assert.doesNotMatch(bulkSource, /\|\| \(text\(taskEnvelope\.Id\)/);
  assert.doesNotMatch(bulkSource, /mci_marketplace_bulk_install_item/);
  assert.match(bulkSource, /status != 'Uninstalled' && status != 'Outdated'/);
  assert.match(bulkSource, /InstallAction: status == 'Outdated'[\s\S]*?Reinstall/);
  assert.match(bulkSource, /BackgroundTask:\s*\{[\s\S]*?HasMore: true,[\s\S]*?Checkpoint:/);
  assert.match(bulkSource, /Plan: plan/);
  assert.match(bulkSource, /ChildCheckpoint/);
  assert.match(bulkSource, /UpdateBackgroundTask/);
  assert.match(bulkSource, /V8\.ApiEngine\.Run\('import-microi-store-package'/);
  assert.match(bulkSource, /BULK_CHILD_FAILURE_DETAIL_V1/);
  assert.match(bulkSource, /BULK_PLATFORM_ONLY_PLAN_V1/);
  assert.match(bulkSource, /BULK_BOUNDED_PACKAGE_SLICES_V1/);
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
  assert.match(bulkSource, /BulkAdaptiveSingleSlice: false/);
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

function startupRuntimeRow(key) {
  const rows = {
    "platform-sys-menu": {
      ApiEngineKey: "platform-sys-menu",
      ApiAddress: "/apiengine/platform-sys-menu",
      ApiV8Code: "V8.Method.ManageSystemDirectory({ Domain: 'SysMenu', Action: 'GetSysMenuStep' });",
      Version: "v1.0.0", IsEnable: 1, StopHttp: 0, AllowAnonymous: 0, IsDeleted: 0,
    },
    "platform-os-client-by-domain": {
      ApiEngineKey: "platform-os-client-by-domain",
      ApiAddress: "/apiengine/platform-os-client-by-domain",
      ApiV8Code: "V8.Method.ResolveOsClientByDomain();",
      Version: "v1.0.0", IsEnable: 1, StopHttp: 0, AllowAnonymous: 1, IsDeleted: 0,
    },
    "platform-sys-config": {
      ApiEngineKey: "platform-sys-config", ApiAddress: "/apiengine/platform-sys-config",
      ApiV8Code: "V8.Method.GetPublicSysConfig();",
      Version: "v1.0.0", IsEnable: 1, StopHttp: 0, AllowAnonymous: 1, IsDeleted: 0,
    },
    "platform-lang-bundle": {
      ApiEngineKey: "platform-lang-bundle", ApiAddress: "/apiengine/platform-lang-bundle",
      ApiV8Code: "V8.Method.GetLangBundle();",
      Version: "v1.0.0", IsEnable: 1, StopHttp: 0, AllowAnonymous: 1, IsDeleted: 0,
    },
    "platform-current-user": {
      ApiEngineKey: "platform-current-user", ApiAddress: "/apiengine/platform-current-user",
      ApiV8Code: "return { Code: 1, Data: V8.CurrentUser };",
      Version: "v1.0.0", IsEnable: 1, StopHttp: 0, AllowAnonymous: 0, IsDeleted: 0,
    },
    "platform-private-file-url": {
      ApiEngineKey: "platform-private-file-url", ApiAddress: "/apiengine/platform-private-file-url",
      ApiV8Code: "V8.Method.GetAuthorizedPrivateFileUrl();",
      Version: "v1.0.0", IsEnable: 1, StopHttp: 0, AllowAnonymous: 0, IsDeleted: 0,
    },
    "platform-sys-user-public-info": {
      ApiEngineKey: "platform-sys-user-public-info", ApiAddress: "/apiengine/platform-sys-user-public-info",
      ApiV8Code: "V8.FormEngine.GetTableData('sys_user', {});",
      Version: "v1.0.0", IsEnable: 1, StopHttp: 0, AllowAnonymous: 0, IsDeleted: 0,
    },
  };
  return rows[key] ? { ...rows[key] } : null;
}

function executeStartupClosureDiscovery({ missingKeys = [], storeStatuses = {} } = {}) {
  const taskId = "startup-resource-closure";
  const V8 = {
    CurrentUser: { Id: "admin", Level: 9999 },
    Param: {
      _BackgroundTaskId: taskId,
      _BackgroundTask: { Id: taskId },
      _BackgroundTaskFencingToken: 13,
      _TrustedServerInvocation: true,
      RequiredAppIds: ["app.microi.store", "app.microi.saas-engine"],
    },
    Method: { UpdateBackgroundTask() {} },
    SysConfig: {},
    Db: {
      FromSql(sql) {
        let key = "";
        return {
          AddInParameter(name, value) {
            if (name === "@p0") key = String(value || "");
            return this;
          },
          First() {
            assert.match(sql, /FROM sys_apiengine/);
            return missingKeys.includes(key) ? null : startupRuntimeRow(key);
          },
        };
      },
    },
    FormEngine: {
      GetTableData(tableName) {
        assert.equal(tableName, "sys_microistoreversion");
        return { Code: 1, Data: [] };
      },
    },
    Http: {
      Post(request) {
        assert.match(request.Url, /get-microi-store-list/);
        return {
          Code: 1,
          DataCount: 2,
          Data: [
            {
              StoreId: "store-app", AppId: "app.microi.store", AppName: "应用商城",
              AppVersion: "v7.6.10", StoreVersionId: "store-version",
              ApplicationType: "Platform", StoreInstallStatus: storeStatuses["app.microi.store"] || "Installed",
            },
            {
              StoreId: "saas-app", AppId: "app.microi.saas-engine", AppName: "SaaS引擎",
              AppVersion: "v7.6.15", StoreVersionId: "saas-version",
              ApplicationType: "Platform", StoreInstallStatus: storeStatuses["app.microi.saas-engine"] || "Installed",
            },
          ],
        };
      },
    },
  };
  return new Function("V8", bulkSource)(V8);
}

test("startup closure reinstalls an installed owner package when its physical API is missing", () => {
  const result = executeStartupClosureDiscovery({ missingKeys: ["platform-sys-menu"] });
  assert.equal(result.Code, 1);
  assert.equal(result.Data.BackgroundTask.Checkpoint.Phase, "Install");
  const plan = JSON.parse(JSON.stringify(result.Data.BackgroundTask.Checkpoint.Plan));
  assert.deepEqual(plan.map(item => [item.AppId, item.InstallAction]), [
    ["app.microi.store", "Reinstall"],
  ]);
});

test("startup closure is a true no-op only after every physical API is healthy", () => {
  const result = executeStartupClosureDiscovery();
  assert.equal(result.Code, 1);
  assert.equal(result.Data.Planned, 0);
});

test("startup closure fails closed when a missing resource has no safe marketplace plan", () => {
  const result = executeStartupClosureDiscovery({
    missingKeys: ["platform-sys-config"],
    storeStatuses: { "app.microi.saas-engine": "Abnormal" },
  });
  assert.equal(result.Code, 0);
  assert.equal(result.Data.FailureStage, "StartupDependencyClosure");
  assert.match(result.Msg, /app\.microi\.saas-engine/);
});

function executeBootstrapOnlyReadback({ missingKeys = [] } = {}) {
  const taskId = "startup-bootstrap-only";
  let importerCalls = 0;
  const requiredAppIds = ["app.microi.store", "app.microi.saas-engine"];
  const V8 = {
    CurrentUser: { Id: "admin", Level: 9999 },
    Param: {
      _BackgroundTaskId: taskId,
      _BackgroundTask: { Id: taskId },
      _BackgroundTaskFencingToken: 19,
      _TrustedServerInvocation: true,
      RequiredAppIds: requiredAppIds,
      StartupDependencyBootstrapOnly: true,
      _BackgroundTaskCheckpoint: {
        Version: 5,
        TaskId: taskId,
        Phase: "Install",
        CurrentIndex: 0,
        Installed: 0,
        Updated: 0,
        RequiredAppIds: requiredAppIds,
        StartupDependencyBootstrapOnly: true,
        StartupBootstrapRevision: "startup-complete-closure-preflight-v1",
        StartupBootstrapIndex: 2,
        Plan: [
          { StoreId: "store-app", AppId: "app.microi.store", AppName: "应用商城", AppVersion: "v7.6.12", StoreVersionId: "store-version", ApplicationType: "Platform", InstallAction: "Reinstall" },
          { StoreId: "saas-app", AppId: "app.microi.saas-engine", AppName: "SaaS引擎", AppVersion: "v7.6.17", StoreVersionId: "saas-version", ApplicationType: "Platform", InstallAction: "Reinstall" },
        ],
      },
    },
    Method: { UpdateBackgroundTask() {} },
    SysConfig: {},
    Db: {
      FromSql(sql) {
        let key = "";
        return {
          AddInParameter(name, value) {
            if (name === "@p0") key = String(value || "");
            return this;
          },
          First() {
            assert.match(sql, /FROM sys_apiengine/);
            return missingKeys.includes(key) ? null : startupRuntimeRow(key);
          },
        };
      },
    },
    ApiEngine: {
      Run() {
        importerCalls += 1;
        throw new Error("completed bootstrap-only readback must not enter full package installation");
      },
    },
  };
  const result = new Function("V8", bulkSource)(V8);
  return { result, importerCalls };
}

test("bootstrap-only startup recovery terminates after seven physical contracts pass", () => {
  const { result, importerCalls } = executeBootstrapOnlyReadback();
  assert.equal(result.Code, 1);
  assert.equal(result.Data.StartupDependencyBootstrapOnly, true);
  assert.equal(result.Data.StartupDependenciesVerified, 7);
  assert.equal(importerCalls, 0);
});

test("bootstrap-only startup recovery fails closed when physical readback is incomplete", () => {
  const { result, importerCalls } = executeBootstrapOnlyReadback({
    missingKeys: ["platform-sys-config"],
  });
  assert.equal(result.Code, 0);
  assert.equal(result.Data.FailureStage, "BootstrapOnlyReadback");
  assert.deepEqual(JSON.parse(JSON.stringify(result.Data.MissingApiEngineKeys)), ["platform-sys-config"]);
  assert.equal(importerCalls, 0);
});

test("every install action reports one stable operation to the authoritative counter", () => {
  assert.match(importerSource, /InstallOperationId/);
  assert.match(importerSource, /InstallAction: installAction/);
  assert.match(importerSource, /OperationId: installOperationId/);
  assert.match(importerSource, /official_marketplace_install_stat/);
  assert.match(importerSource, /MARKETPLACE_INSTALL_STAT_STRING_RESPONSE_V1/);
  assert.match(importerSource, /MARKETPLACE_INSTALL_STAT_NON_BLOCKING_V2/);
  assert.match(importerSource, /SKIP_INSTALL_COUNT_WITHOUT_MARKETPLACE_ID_V1/);
  assert.match(importerSource, /LEGACY_INSTALL_VERSION_IDENTITY_FALLBACK_V1/);
  assert.match(importerSource, /findInstallVersionRecord/);
  assert.match(importerSource, /\['AppName', '=', identity\.AppName\]/);
  assert.match(importerSource, /if \(!marketplaceInstallIdentity\)[\s\S]*install_count_skipped_no_identity[\s\S]*return;/);
  assert.match(importerSource, /typeof remoteStat == 'string'[\s\S]*remoteStatText[\s\S]*JSON\.parse\(remoteStatText\)/);
  assert.match(importerSource, /install_count_warning_remote/);
  assert.doesNotMatch(importerSource, /install_count_error_remote/);
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
  assert.equal(engine.Version, "v1.3.7");
  assert.match(bulkSource, /value\.标识 \|\| value\.Identifier/);
  assert.equal(engine.IsEnable, 1);
  assert.equal(engine.StopHttp, 0);
  assert.equal(engine.ApiV8Code, normalizeSource(bulkSource));
  assert.equal(packageModel.PackageInfo.ApiEngineCount, packageModel.SysApiEngines.length);
});

test("package importer fails closed when an API engine is not durably persisted", () => {
  assert.match(importerSource, /Version: v2\.4\.9/);
  assert.match(importerSource, /MARKETPLACE_CUSTOM_ENGINE_ROUTE_V2/);
  assert.match(importerSource, /storeApiBase \+ '\/apiengine\/'/);
  assert.doesNotMatch(importerSource, /\/api\/ApiEngine\/Run/);
  assert.match(importerSource, /marketplaceEngineParam\('get-microi-store-model'/);
  assert.match(bulkSource, /sourceApiBase \+ '\/apiengine\/get-microi-store/);
  assert.doesNotMatch(bulkSource, /\/api\/ApiEngine\/Run/);
  assert.match(importerSource, /PACKAGE_MENU_RUNTIME_PREFLIGHT_V1/);
  assert.match(importerSource, /REMOTE_ZIP_SINGLE_ASSET_SLICE_V1/);
  assert.match(importerSource, /ADMIN_MENU_PERMISSION_V1/);
  assert.match(importerSource, /ADMIN_MENU_PERMISSION_PHYSICAL_FALLBACK_V1/);
  assert.match(importerSource, /ADMIN_MENU_PERMISSION_DB_TIME_V1/);
  assert.match(importerSource, /BACKGROUND_TASK_PERSISTED_PROGRESS_FLOOR_V1/);
  assert.match(importerSource, /MYSQL_BIT_NUMERIC_COMPAT_V1/);
  assert.match(importerSource, /BACKGROUND_TASK_BOUNDED_PACKAGE_SLICES_V1/);
  assert.match(importerSource, /MYSQL_ROW_SIZE_OFFPAGE_FALLBACK_V1/);
  assert.match(importerSource, /MySqlOffpageTypeOverrides/);
  assert.match(importerSource, /isMysqlRowSizeTooLargeError/);
  assert.match(importerSource, /applyPackageColumnTypeOverride/);
  assert.match(importerSource, /ADD COLUMN触发MySQL 65535字节行宽上限/);
  assert.match(importerSource, /CREATE TABLE触发MySQL 65535字节行宽上限/);
  assert.match(importerSource, /isPackageColumnIndexed/);
  assert.match(importerSource, /bulk_adaptive_single_slice_ignored/);
  assert.doesNotMatch(importerSource, /backgroundChunkingEnabled\s*=\s*false/);
  assert.match(importerSource, /PACKAGE_API_ENGINE_READBACK_V1/);
  assert.match(importerSource, /assertPersistedApiEngine\(apiEngine, updatedEngine\)/);
  assert.match(importerSource, /assertPersistedApiEngine\(apiEngine, insertedEngine\)/);
  assert.match(importerSource, /throw new Error\('更新接口引擎失败：'/);
  assert.match(importerSource, /throw new Error\('新增接口引擎失败：'/);
  assert.match(importerSource, /actualCode !== expectedCode/);
  assert.match(importerSource, /API_ENGINE_RESOURCE_BASELINE_V1/);
  assert.match(importerSource, /UpgradePolicy == 'CreateIfMissing'/);
  assert.match(importerSource, /TENANT_CREATE_IF_MISSING_TOMBSTONE_V1/);
  assert.match(
    importerSource,
    /SELECT \* FROM sys_apiengine WHERE LOWER\(ApiEngineKey\)=LOWER\(@p0\)/,
  );
  assert.match(importerSource, /含软删除状态/);
  assert.match(importerSource, /TRUSTED_OFFICIAL_PLATFORM_PACKAGE_V1/);
  assert.match(importerSource, /OFFICIAL_MANAGED_OVERWRITE_V1/);
  assert.match(importerSource, /GENERATED_ENTITY_PHYSICAL_BOOTSTRAP_V1/);
  assert.match(importerSource, /GENERATED_ENTITY_PHYSICAL_BOOTSTRAP_BATCH_V1/);
  assert.match(importerSource, /GENERATED_ENTITY_PHYSICAL_BOOTSTRAP_CHECKPOINT_V1/);
  assert.match(importerSource, /ApplyOfficialManagedOverwrite/);
  assert.match(importerSource, /DATABASE_ONLY_BUILD_ASSETS_V1/);
  assert.match(importerSource, /OBJECT_STORAGE_FORBIDDEN/);
  assert.match(importerSource, /BACKGROUND_TASK_MONOTONIC_PROGRESS_V1/);
  assert.match(importerSource, /POST_SCHEMA_MICROSERVICE_BINDING_RESTORE_V1/);
  assert.match(
    importerSource,
    /backgroundCheckpointPhase != 'PostSchema'[\s\S]*?getApplicationRow\('sys_microiservice'[\s\S]*?getApplicationRow\('sys_microiservice_page'/,
  );
  assert.match(
    importerSource,
    /restoreApplicationMenuBindingsFromPackage\(\);[\s\S]*?migrateLegacyMenus\(binding, 'Url'/,
  );
  assert.match(importerSource, /managedDecision == 'PreserveNewer'/);
  assert.match(importerSource, /接口引擎升级冲突/);
  assert.match(importerSource, /STARTUP_DEPENDENCY_API_FAST_BOOTSTRAP_V1/);
  assert.match(importerSource, /STARTUP_DEPENDENCY_PREINSTALL_BOOTSTRAP_V1/);
  assert.match(importerSource, /StartupDependencyBootstrapOnly/);
  assert.match(importerSource, /trustedOfficialPlatformPackage/);
  assert.match(importerSource, /StartupApiBootstrapDone/);
  assert.match(importerSource, /StartupApiBootstrapRevision/);
  assert.match(importerSource, /STARTUP_API_RUNTIME_FLAG_PHYSICAL_RECONCILIATION_V1/);
  assert.match(importerSource, /MySQL BIT\(1\)/);
  assert.match(importerSource, /UPDATE sys_apiengine SET IsEnable=' \+ normalizeStartupFlag/);
  assert.doesNotMatch(importerSource, /UPDATE sys_apiengine SET IsEnable=@p0/);
  assert.match(importerSource, /SELECT \* FROM sys_apiengine WHERE LOWER\(' \+ fieldName/);
  assert.match(importerSource, /platform-os-client-by-domain/);
  assert.match(importerSource, /platform-sys-config/);
  assert.match(importerSource, /platform-lang-bundle/);
  assert.match(importerSource, /platform-current-user/);
  assert.match(importerSource, /platform-private-file-url/);
  assert.match(importerSource, /platform-sys-user-public-info/);
  assert.match(importerSource, /已有不同源码或处于软删除状态/);
  assert.match(bulkSource, /STARTUP_DEPENDENCY_RESOURCE_CLOSURE_V2/);
  assert.match(bulkSource, /STARTUP_DEPENDENCY_PREINSTALL_BOOTSTRAP_V1/);
  assert.match(bulkSource, /STARTUP_DEPENDENCY_BOOTSTRAP_ONLY_V1/);
  assert.match(bulkSource, /StartupDependencyBootstrapOnly: true/);
  assert.match(bulkSource, /missingStartupDependencyRequirements/);
  assert.match(bulkSource, /StartupDependenciesVerified: startupDependencyRequirements\.length/);
  assert.match(bulkSource, /startupDependencyRecovery[\s\S]*app\.microi\.store[\s\S]*app\.microi\.saas-engine/);
  assert.match(bulkSource, /status == 'Installed' \? 'Reinstall'/);
  assert.match(bulkSource, /StartupDependencyRecovery: startupDependencyRecovery/);

  const embeddedImporter = packageModel.SysApiEngines.find(
    (item) => item.ApiEngineKey === "import-microi-store-package",
  );
  assert.ok(embeddedImporter, "embedded package importer is missing");
  assert.equal(embeddedImporter.Version, "v2.4.9");
  assert.ok(packageModel.PackageInfo.RequiredPlatformCapabilities.includes(
    "Installer:StartupDependencyPreinstallBootstrapV1",
  ));
  assert.ok(packageModel.PackageInfo.RequiredPlatformCapabilities.includes(
    "Installer:StartupApiRuntimeFlagReconciliation",
  ));
  assert.match(importerSource, /MOVE_OBJECT_UNAVAILABLE_RESUME_V1/);
  assert.match(importerSource, /PrivateSource\+PublicBuildMoveFallback/);
  assert.equal(embeddedImporter.ApiV8Code, normalizeSource(importerSource));
});
