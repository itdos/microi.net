import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { compareSemanticVersions } from "./application-store-replica-sync.mjs";

const readCanonicalText = async url => (
  await readFile(url, "utf8")
).replace(/\r\n/g, "\n");

const source = await readCanonicalText(new URL("./import-package.js", import.meta.url));
const publishSource = await readCanonicalText(new URL("./ai-app-publish-store.js", import.meta.url));
const packageModel = JSON.parse(await readFile(new URL("./app.microi.store.json", import.meta.url), "utf8"));
const refreshSource = await readCanonicalText(new URL("./refresh-resources.mjs", import.meta.url));
const upgradeSource = await readCanonicalText(new URL("../Upgrade.cs", import.meta.url));
const appStoreUpgradeSource = await readCanonicalText(new URL("../13-UpgradeAppStore.cs", import.meta.url));
const sysMenuLogicSource = await readCanonicalText(new URL("../../Microi.Core/Logic/SysMenuLogic.cs", import.meta.url));
const microAppControllerSource = await readCanonicalText(new URL("../../Microi.net.Api/Controllers/MicroAppController.cs", import.meta.url));
const apiProgramSource = await readCanonicalText(new URL("../../Microi.net.Api/Program.cs", import.meta.url));
const tableActionsSource = await readCanonicalText(new URL("../../../Microi.Client/src/views/form-engine/mixins/diy-table-actions.mixin.js", import.meta.url));
const functionSource = source.match(/var countPageTabs = function \(value\) \{[\s\S]*?\n\};/);
const physicalNotNullBackfillSource = source.match(
  /var prepareNotNullColumnData = function \(tableName, columnName, sourceColumn, targetColumn\) \{[\s\S]*?\n    \};/
);
const mysqlOffpageHelpersSource = source.match(
  /var isMysqlRowSizeTooLargeError = function \(error\) \{[\s\S]*?(?=\n    var applyPersistedMysqlOffpageOverrides)/
);

assert.ok(functionSource, "countPageTabs helper should exist");
assert.ok(physicalNotNullBackfillSource, "NOT NULL physical-column backfill helper should exist");
assert.ok(mysqlOffpageHelpersSource, "MySQL row-size fallback helpers should exist");

const context = {};
vm.runInNewContext(`${functionSource[0]}\nresult = countPageTabs;`, context);
const countPageTabs = context.result;
const dataSetImportSource = source.match(
  /\/\/ DATASET_INSERT_IF_MISSING_V1[\s\S]*?(?=\n    var hasInstallErrorsBeforeVersion)/
);

assert.ok(dataSetImportSource, "InsertIfMissing dataset importer should be extractable");

function runPhysicalNotNullBackfillFixture(sourceColumn, options = {}) {
  const calls = [];
  const fixtureContext = {
    isSafeIdentifier(value) {
      return !!value && /^[A-Za-z0-9_]+$/.test(String(value));
    },
    normalizeSqlType(value) {
      return String(value || "").toLowerCase().replace(/\s+/g, "");
    },
    getPhysicalValue(row, names) {
      for (const name of names) {
        if (row[name] !== undefined && row[name] !== null) return row[name];
      }
      return null;
    },
    getScalarCount(row, names) {
      const name = names.find(candidate => row[candidate] !== undefined && row[candidate] !== null);
      const value = name ? Number.parseInt(row[name], 10) : 0;
      return Number.isNaN(value) ? 0 : value;
    },
    V8: {
      Db: {
        FromSql(sql) {
          const call = { sql, parameters: [], executed: false };
          calls.push(call);
          const command = {
            AddInParameter(name, value) {
              call.parameters.push([name, value]);
              return command;
            },
            ToArray() {
              return [{ NullCount: options.nullCount ?? 3 }];
            },
            ExecuteNonQuery() {
              call.executed = true;
              return options.nullCount ?? 3;
            },
          };
          return command;
        },
      },
    },
  };
  vm.runInNewContext(
    `${physicalNotNullBackfillSource[0]}\nresult = prepareNotNullColumnData;`,
    fixtureContext
  );
  const count = fixtureContext.result(
    "mci_ai_app_version",
    sourceColumn.COLUMN_NAME,
    sourceColumn,
    { IS_NULLABLE: options.targetNullable || "YES" }
  );
  return { calls, count };
}

function runMysqlOffpageFallbackFixture() {
  const packageFixture = {
    DiyFields: [
      { TableName: "sys_osclients", TableId: "table-1", Name: "LongSetting", Type: "varchar(2000)" },
      { TableName: "sys_osclients", TableId: "table-1", Name: "IndexedSetting", Type: "varchar(500)" },
    ],
    PhysicalColumns: [],
    DDLStatements: [{
      TableName: "sys_osclients",
      TableId: "table-1",
      DDL: "CREATE TABLE `sys_osclients` (`Id` varchar(36) NOT NULL PRIMARY KEY, `LongSetting` varchar(2000) NULL, `IndexedSetting` varchar(500) NULL, KEY `ix_setting` (`IndexedSetting`))",
    }],
  };
  const fixtureContext = {
    Package: packageFixture,
    debugLog: {},
    mysqlOffpageTypeOverrides: {},
    isSafeIdentifier(value) {
      return !!value && /^[A-Za-z0-9_]+$/.test(String(value));
    },
    getPhysicalValue(row, names) {
      for (const name of names) {
        if (row[name] !== undefined && row[name] !== null) return row[name];
      }
      return null;
    },
  };
  vm.runInNewContext(
    `${mysqlOffpageHelpersSource[0]}\nresult = { isMysqlRowSizeTooLargeError, applyPackageColumnTypeOverride };`,
    fixtureContext
  );
  return { fixtureContext, packageFixture, helpers: fixtureContext.result };
}

function runDataSetImportFixture(options = {}) {
  const noData = { Code: 2, Data: null, Msg: "NoExistData" };
  const idResults = options.idResults || [noData];
  const conflictResults = options.conflictResults || [noData];
  let idReadIndex = 0;
  let conflictReadIndex = 0;
  const calls = { add: [], update: [], conflictWhere: [] };
  const row = {
    Id: "01KXZSKQYCB2N9QGWEACYT20ZS",
    JobName: "microiDatabaseBackupScheduler",
    JobParam: "{\"Enabled\":false}",
    Status: "暂停",
    CreateTime: "2026-08-01 00:00:00",
    UpdateTime: "2026-08-01 00:00:00",
    UserId: "source-user",
    UserName: "source-admin",
    OsClient: "iTdos",
    ...(options.row || {}),
  };
  const dataSet = {
    TableName: "diy_schedule_job",
    ConflictPolicy: options.conflictPolicy || "InsertIfMissing",
    ConflictFields: options.conflictFields || ["JobName"],
    Rows: [row],
  };
  const fixtureContext = {
    Package: { DataSets: [dataSet] },
    V8: {
      OsClient: "target-tenant",
      FormEngine: {
        GetFormData(tableName, query) {
          if (tableName === "diy_table") return { Code: 1, Data: { Id: "table-id", Name: "diy_schedule_job" } };
          if (query && query.Id) {
            const selected = idResults[Math.min(idReadIndex, idResults.length - 1)];
            idReadIndex++;
            return selected;
          }
          calls.conflictWhere.push(JSON.parse(JSON.stringify(query?._Where || [])));
          const selected = conflictResults[Math.min(conflictReadIndex, conflictResults.length - 1)];
          conflictReadIndex++;
          return selected;
        },
        AddFormData(_tableName, targetRow) {
          calls.add.push(JSON.parse(JSON.stringify(targetRow)));
          return options.addResult || { Code: 1, Data: { Id: targetRow.Id } };
        },
        UptFormData(_tableName, targetRow) {
          calls.update.push(JSON.parse(JSON.stringify(targetRow)));
          return options.updateResult || { Code: 1, Data: { Id: targetRow.Id } };
        },
      },
    },
    stats: { DataSetCount: 0, DataInserted: 0, DataUpdated: 0, DataSkipped: 0 },
    debugLog: {},
    reportProgress() {},
    JSON,
    Object,
    String,
  };
  vm.runInNewContext(`(function () { ${dataSetImportSource[0]} }).call(this);`, fixtureContext);
  return { calls, stats: fixtureContext.stats, debugLog: fixtureContext.debugLog };
}

test("PageTabs only preserves a real multi-tab target", () => {
  const cases = [
    [null, 0],
    [undefined, 0],
    ["", 0],
    ["[]", 0],
    ["{}", 0],
    ["invalid-json", 0],
    ["[{}]", 1],
    ["[{},{}]", 2],
    [[], 0],
    [[{}], 1],
    [[{}, {}], 2]
  ];

  for (const [value, expected] of cases) {
    assert.equal(countPageTabs(value), expected, `unexpected count for ${JSON.stringify(value)}`);
  }
  assert.match(source, /existingPageTabsCount\s*>\s*1/);
});

test("physical schema sync backfills all legacy application publish NULLs before NOT NULL", () => {
  const expectedDefaults = new Map([
    ["PublishProtocolVersion", "2"],
    ["PublishState", "LegacyUnverified"],
    ["FencingToken", "0"],
    ["RowVersion", "0"],
    ["RecoveryEpoch", "0"],
  ]);
  // These columns belong to the AI application package, not the application-store package.
  // Keep the importer regression fixture local so resource ownership changes cannot silently
  // remove the NOT NULL backfill coverage.
  const columns = Array.from(expectedDefaults, ([COLUMN_NAME, COLUMN_DEFAULT]) => ({
    TABLE_NAME: "mci_ai_app_version",
    COLUMN_NAME,
    COLUMN_TYPE: COLUMN_NAME === "PublishState" ? "varchar(50)" : "bigint",
    IS_NULLABLE: "NO",
    COLUMN_DEFAULT,
  }));

  assert.equal(columns.length, expectedDefaults.size);
  for (const column of columns) {
    assert.equal(column.IS_NULLABLE, "NO", column.COLUMN_NAME);
    assert.equal(String(column.COLUMN_DEFAULT), expectedDefaults.get(column.COLUMN_NAME), column.COLUMN_NAME);
    const result = runPhysicalNotNullBackfillFixture(column);
    assert.equal(result.count, 3, column.COLUMN_NAME);
    assert.equal(result.calls.length, 2, column.COLUMN_NAME);
    assert.match(result.calls[0].sql, /SELECT COUNT\(1\).*IS NULL/);
    assert.match(result.calls[1].sql, /UPDATE `mci_ai_app_version` SET `[A-Za-z0-9_]+` = @p0.*IS NULL/);
    assert.deepEqual(result.calls[1].parameters, [["@p0", column.COLUMN_DEFAULT]]);
    assert.equal(result.calls[1].executed, true);
  }

  assert.match(
    source,
    /prepareNumericColumnData\([\s\S]*?prepareNotNullColumnData\([\s\S]*?ALTER TABLE `[\s\S]*?` MODIFY COLUMN/
  );
});

test("physical NOT NULL backfill is idempotent and fails closed without a declared default", () => {
  const baseColumn = {
    TABLE_NAME: "mci_ai_app_version",
    COLUMN_NAME: "PublishState",
    COLUMN_TYPE: "varchar(50)",
    IS_NULLABLE: "NO",
    COLUMN_DEFAULT: "LegacyUnverified",
  };
  const noNulls = runPhysicalNotNullBackfillFixture(baseColumn, { nullCount: 0 });
  assert.equal(noNulls.count, 0);
  assert.equal(noNulls.calls.length, 1, "repeat install should only verify that no NULL rows remain");

  assert.throws(
    () => runPhysicalNotNullBackfillFixture({ ...baseColumn, COLUMN_DEFAULT: null }),
    /存在3条NULL数据.*未声明可回填的默认值/
  );
});

test("MySQL row-size fallback promotes only non-indexed varchar columns and persists the override", () => {
  const { fixtureContext, packageFixture, helpers } = runMysqlOffpageFallbackFixture();
  assert.equal(
    helpers.isMysqlRowSizeTooLargeError(new Error("Row size too large. The maximum row size is 65535")),
    true
  );
  assert.equal(helpers.isMysqlRowSizeTooLargeError(new Error("Duplicate column name")), false);

  assert.equal(
    helpers.applyPackageColumnTypeOverride(
      "sys_osclients",
      "table-1",
      "LongSetting",
      "mediumtext",
      "test"
    ),
    true
  );
  assert.equal(packageFixture.DiyFields[0].Type, "mediumtext");
  assert.match(packageFixture.DDLStatements[0].DDL, /`LongSetting` mediumtext NULL/);
  assert.equal(
    fixtureContext.mysqlOffpageTypeOverrides["sys_osclients.longsetting"],
    "mediumtext"
  );

  assert.equal(
    helpers.applyPackageColumnTypeOverride(
      "sys_osclients",
      "table-1",
      "IndexedSetting",
      "mediumtext",
      "test"
    ),
    false
  );
  assert.equal(packageFixture.DiyFields[1].Type, "varchar(500)");
  assert.match(packageFixture.DDLStatements[0].DDL, /KEY `ix_setting` \(`IndexedSetting`\)/);
  assert.match(source, /checkpoint\.MySqlOffpageTypeOverrides = offpageSnapshot/);
});

test("InsertIfMissing never overwrites a configured row with the same Id", () => {
  const result = runDataSetImportFixture({
    idResults: [{ Code: 1, Data: { Id: "01KXZSKQYCB2N9QGWEACYT20ZS", JobParam: "{\"Enabled\":true}" } }],
  });
  assert.equal(result.calls.add.length, 0);
  assert.equal(result.calls.update.length, 0);
  assert.equal(result.stats.DataSkipped, 1);
  assert.equal(result.stats.DataInserted, 0);
  assert.equal(result.stats.DataUpdated, 0);
});

test("InsertIfMissing also preserves a legacy row matched by JobName", () => {
  const result = runDataSetImportFixture({
    idResults: [{ Code: 2, Data: null, Msg: "NoExistData" }],
    conflictResults: [{ Code: 1, Data: { Id: "legacy-id" } }],
  });
  assert.deepEqual(result.calls.conflictWhere, [[
    ["JobName", "=", "microiDatabaseBackupScheduler"],
  ]]);
  assert.equal(result.calls.add.length, 0);
  assert.equal(result.calls.update.length, 0);
  assert.equal(result.stats.DataSkipped, 1);
});

test("InsertIfMissing inserts a portable row and strips source audit identity", () => {
  const result = runDataSetImportFixture();
  assert.equal(result.calls.add.length, 1);
  assert.equal(result.calls.update.length, 0);
  assert.equal(result.stats.DataInserted, 1);
  assert.equal(result.calls.add[0].OsClient, "target-tenant");
  for (const field of ["CreateTime", "UpdateTime", "UserId", "UserName"]) {
    assert.equal(Object.hasOwn(result.calls.add[0], field), false, `${field} must not cross tenants`);
  }
});

test("InsertIfMissing treats a concurrent deterministic-Id insert as idempotent success", () => {
  const result = runDataSetImportFixture({
    idResults: [
      { Code: 2, Data: null, Msg: "NoExistData" },
      { Code: 1, Data: { Id: "01KXZSKQYCB2N9QGWEACYT20ZS" } },
    ],
    conflictResults: [{ Code: 2, Data: null, Msg: "NoExistData" }],
    addResult: { Code: 0, Msg: "duplicate primary key" },
  });
  assert.equal(result.calls.add.length, 1);
  assert.equal(result.calls.update.length, 0);
  assert.equal(result.stats.DataInserted, 0);
  assert.equal(result.stats.DataSkipped, 1);
});

test("self-contained offline applications prefer embedded files over public ZIP URLs", () => {
  assert.match(source, /embeddedSourceFiles[\s\S]*?embeddedSourceFiles\.length[\s\S]*?downloadApplicationZip\(packageAssets\.SourceZip/);
  assert.match(source, /embeddedBuildAssets[\s\S]*?embeddedBuildAssets\.length[\s\S]*?downloadApplicationZip\(packageAssets\.BuildZip/);
});

test("installed application HTML receives the target tenant runtime without URL parameters", () => {
  assert.match(source, /rewriteApplicationRuntimeContext/);
  assert.match(source, /V8\.SysConfig\s*&&\s*V8\.SysConfig\.ApiBase/);
  assert.match(source, /OsClient:\s*String\(V8\.OsClient/);
  assert.match(source, /data-microi-runtime-context=["']true["']/);
  assert.match(source, /base64\s*=\s*rewriteApplicationRuntimeContext\(rootPath, relativePath, base64\)/);
  assert.doesNotMatch(source, /MICROI_API_BASE\s*=\s*["']https:\/\/api\.itdos\.com/);
});

test("application-store PackageOnly output is a self-contained offline package", () => {
  assert.match(publishSource, /isOfflineAction\s*=\s*action\s*===\s*'OfflinePackage'[\s\S]*?action\s*===\s*'PackageOnly'/);
  assert.match(publishSource, /ApplicationBundle\.BuildAssets\s*=\s*buildAssets/);
  assert.match(publishSource, /ApplicationBundle\.SourceFiles\s*=\s*sourceFiles/);
  assert.match(publishSource, /ReturnPackageModel/);
  assert.match(publishSource, /if\s*\(returnPackageModel\)\s*offlineResult\.Package\s*=\s*packageModel/);
  assert.doesNotMatch(publishSource, /return ok\(\{\s*Package:\s*packageModel,[\s\S]*?FileByteBase64/);
});

test("microservice installation preserves source-server native menus and migrates target placeholders", () => {
  assert.match(source, /LegacyMenuUrls[\s\S]*?LegacyComponentPaths/);
  assert.match(source, /normalizeRouteMeta[\s\S]*?RouteMetaJson:\s*JSON\.stringify\(routeMeta\)/);
  assert.match(source, /PreserveExistingNativeMenus:\s*preserveExistingNativeMenus/);
  assert.match(source, /isExistingNativeComponent[\s\S]*?MicroServiceMenusPreserved\+\+/);
  assert.match(source, /OpenType:\s*'MicroService'/);
  assert.match(source, /recoverBoundMicroserviceMenus/);
  assert.match(source, /stableMenuUrl[\s\S]*?preservedLegacyUrl[\s\S]*?Url:\s*preservedLegacyUrl/);
  assert.match(source, /ComponentPath:\s*'\/micro-app\/host'/);
  assert.match(source, /MicroServicePageId:\s*binding\.PageId/);
  assert.match(source, /MicroServiceRoutePath:\s*binding\.RoutePath/);
});

test("source-inclusive packages fail closed and verify imported private source", () => {
  assert.match(publishSource, /IncludeSource:\s*includeSource/);
  assert.match(publishSource, /同时发布源码[\s\S]*?没有可打包的私有源码/);
  assert.match(source, /sourceExpected[\s\S]*?源码文件为空/);
  assert.match(source, /installedSources[\s\S]*?私有源码写入后回读为空/);
  assert.match(source, /validationSourceExpected[\s\S]*?声明包含源码但没有源码文件/);
  assert.match(source, /emptySourceContent[\s\S]*?源码文件缺少内嵌内容/);
});

test("large application installs resume uploaded assets instead of restarting the ZIP copy", () => {
  assert.match(source, /resumeInstall[\s\S]*?V8\.Param\.ResumeInstall/);
  assert.match(source, /loadExistingApplicationAssets[\s\S]*?existingApplicationAssets/);
  assert.match(source, /reuseApplicationAsset[\s\S]*?ContentHash/);
  assert.match(source, /ApplicationSourceFilesReused/);
  assert.match(source, /ApplicationBuildAssetsReused/);
  assert.match(source, /pruneApplicationAssets[\s\S]*?DelFormData\('mci_ai_app_file', \{ Ids: staleIds \}\)/);
  assert.match(source, /PRUNE_ASSET_IDS_WITH_DELFORM_V1/);
  assert.match(source, /AssetRowsPruned/);
  assert.doesNotMatch(source, /if \(sourceFiles && sourceFiles\.length\) \{[\s\S]{0,500}DelFormDataByWhere\('mci_ai_app_file'/);
});

test("background application assets are committed in bounded resumable slices", () => {
  assert.match(source, /APPLICATION_ASSET_BACKGROUND_CHUNKS_V1/);
  assert.match(source, /ApplicationAssetChunkMaxFiles \|\| 8/);
  assert.match(source, /ApplicationAssetChunkMaxBase64Chars \|\| \(32 \* 1024 \* 1024\)/);
  assert.match(source, /HasMore:\s*true[\s\S]*?Checkpoint:/);
  assert.match(source, /shouldContinueApplicationAssets\(sourceFile\)/);
  assert.match(source, /shouldContinueApplicationAssets\(buildFile\)/);
  assert.match(source, /ASSET_METADATA_WITHOUT_SECOND_DECODE_V1/);
  assert.doesNotThrow(() => new Function(source), "canonical importer must remain valid function-body JavaScript");

  const chunkHelpers = source.match(
    /var backgroundTaskId = [\s\S]*?(?=var installUser =)/
  );
  assert.ok(chunkHelpers, "background asset chunk helpers should be extractable");
  const context = {
    V8: {
      Param: {
        _BackgroundTaskId: "task-1",
        _TrustedServerInvocation: true,
        ApplicationAssetChunkMaxFiles: 2,
        ApplicationAssetChunkMaxBase64Chars: 1024 * 1024
      }
    }
  };
  vm.runInNewContext(
    `${chunkHelpers[0]}\nresult = { shouldContinueApplicationAssets, markApplicationAssetUploaded, buildApplicationAssetContinuation };`,
    context
  );

  context.result.markApplicationAssetUploaded({ FileByteBase64: "a" });
  assert.equal(context.result.shouldContinueApplicationAssets({ FileByteBase64: "b" }), false);
  context.result.markApplicationAssetUploaded({ FileByteBase64: "b" });
  assert.equal(context.result.shouldContinueApplicationAssets({ FileByteBase64: "c" }), true);
  const continuation = context.result.buildApplicationAssetContinuation(1, "Build", 2, 10);
  assert.equal(continuation.Code, 1);
  assert.equal(continuation.Data.BackgroundTask.HasMore, true);
  assert.equal(continuation.Data.BackgroundTask.Checkpoint.BundleIndex, 1);
  assert.equal(continuation.Data.BackgroundTask.Checkpoint.AssetKind, "Build");
});

test("schema import uses durable bounded phases before application assets", () => {
  assert.match(source, /SCHEMA_BACKGROUND_CHUNKS_V1/);
  assert.match(source, /SchemaDdlChunkSize \|\| 1/);
  assert.match(source, /SchemaTableChunkSize \|\| 2/);
  assert.match(source, /SchemaFieldPlanChunkSize \|\| 32/);
  assert.match(source, /SchemaFieldChunkSize \|\| 8/);
  assert.match(source, /SchemaPhysicalTableChunkSize \|\| 1/);
  assert.match(source, /nextDdlPhase[\s\S]*?'Tables'/);
  assert.match(source, /nextTablePhase[\s\S]*?'PlanFields'/);
  assert.match(source, /nextFieldPlanPhase[\s\S]*?'Fields'/);
  assert.match(source, /nextFieldPhase[\s\S]*?'Physical'/);
  assert.match(source, /nextPhysicalPhase[\s\S]*?'ApplicationAssets'/);
  assert.match(source, /'PostSchema'[\s\S]*?菜单、流程、接口和随包数据/);
  assert.match(source, /backgroundCheckpointPhase == 'ApplicationAssets'/);
  assert.match(source, /PostSchema:\s*true/);
  assert.match(source, /assertSchemaChunkSucceeded\('字段定义'\)/);
  assert.match(source, /TaskId:\s*String\(backgroundTaskId/);
  assert.match(source, /Checkpoint:\s*buildPersistentCheckpoint\('ApplicationAssets'/);
  assert.match(source, /PACKAGE_REPLAY_VERSION_GUARD_V1/);
  assert.match(source, /checkpoint\.PackageVersion\s*=\s*checkpointPackageVersion/);
  assert.match(source, /应用包版本在后台分片期间发生变化/);
  assert.match(source, /snapshotPersistentSchemaStats/);
  assert.match(source, /checkpoint\.SchemaStats\s*=\s*schemaStats/);
  assert.match(source, /checkpoint\.IdMapsPlanned\s*=\s*true/);
  assert.match(source, /rebuildLegacyCheckpointIdMaps/);
});

test("field conflict maps survive retries without process memory", () => {
  const mappingHelpers = source.match(
    /var normalizeId = function \(id\) \{[\s\S]*?restorePersistentIdMaps\(\);/
  );
  assert.ok(mappingHelpers, "field mapping helpers should be extractable");

  const runPlanning = (checkpoint, failOnNewId = false) => {
    const planningContext = {
      Package: {
        DiyFields: [
          { Id: "field-a", TableId: "target-table", Name: "A" },
          { Id: "field-b", TableId: "target-table", Name: "B" }
        ],
        SysMenus: [],
        DDLStatements: []
      },
      V8: {
        Db: {
          FromSql(sql) {
            const values = {};
            return {
              AddInParameter(name, value) { values[name] = value; return this; },
              First() {
                if (sql.includes("TableId = @p0") && values["@p1"] === "A") {
                  return { Id: "existing-a", TableId: "target-table", Name: "A" };
                }
                if (sql.includes("TableId = @p0") && values["@p1"] === "B") return null;
                if (sql.includes("WHERE Id = @p0") && values["@p0"] === "field-b") {
                  return { Id: "field-b", TableId: "other-table", Name: "Other" };
                }
                return null;
              }
            };
          }
        },
        Method: {
          NewUlid() {
            if (failOnNewId) throw new Error("retry must reuse the persisted field id");
            return "generated-b";
          },
          NewGuid() { return "generated-guid"; }
        }
      },
      idMaps: { Table: {}, Field: {}, Menu: {} },
      stats: { TableIdRemapped: 0, FieldIdRemapped: 0, MenuIdRemapped: 0 },
      debugLog: {},
      menuJsonFields: [],
      fieldJsonFields: [],
      backgroundChunkingEnabled: true,
      backgroundCheckpoint: checkpoint,
      backgroundTaskId: "task-1",
      copyPersistentIdMaps(sourceMaps) {
        return JSON.parse(JSON.stringify(sourceMaps || { Table: {}, Field: {} }));
      }
    };
    vm.runInNewContext(
      `${mappingHelpers[0]}\nplanPackageFieldIdMaps(0, 2); result = snapshotPersistentIdMaps();`,
      planningContext
    );
    return planningContext.result;
  };

  const firstMaps = runPlanning({ TaskId: "task-1", IdMaps: { Table: {}, Field: {} } });
  assert.equal(firstMaps.Field["field-a"], "existing-a");
  assert.equal(firstMaps.Field["field-b"], "generated-b");

  const retryMaps = runPlanning({ TaskId: "task-1", IdMaps: firstMaps }, true);
  assert.equal(retryMaps.Field["field-b"], "generated-b");
});

test("only worker-owned checkpoints can skip schema phases", () => {
  const chunkHelpers = source.match(/var backgroundTaskId = [\s\S]*?(?=var installUser =)/);
  assert.ok(chunkHelpers);
  const readPhase = checkpoint => {
    const phaseContext = {
      V8: {
        Param: {
          _BackgroundTaskId: "task-1",
          _TrustedServerInvocation: true,
          _BackgroundTaskCheckpoint: checkpoint
        }
      }
    };
    vm.runInNewContext(`${chunkHelpers[0]}\nresult = backgroundCheckpointPhase;`, phaseContext);
    return phaseContext.result;
  };

  assert.equal(readPhase({ Phase: "PostSchema" }), "Ddl", "caller-supplied phase must be ignored");
  assert.equal(
    readPhase({ Phase: "ApplicationAssets", AssetKind: "Build", ApplicationAssetUploaded: 8 }),
    "ApplicationAssets",
    "v1.8.0 asset checkpoints remain resumable during a rolling importer upgrade"
  );
  assert.equal(readPhase({ TaskId: "task-1", Phase: "Fields", Index: 16 }), "Fields");
  assert.equal(readPhase({ TaskId: "another-task", Phase: "Fields", Index: 16 }), "Ddl");
});

test("online marketplace background tasks persist identifiers instead of the full package row", () => {
  assert.match(tableActionsSource, /STORE_INSTALL_IDENTIFIER_ONLY_V1/);
  const builder = tableActionsSource.match(
    /BuildMicroiStoreInstallParam\(btn, row\) \{[\s\S]*?\n        \},\n        IsBackgroundTaskBootstrapPackage/
  );
  assert.ok(builder, "marketplace install parameter builder should be extractable");
  assert.match(builder[0], /StoreId:\s*row\.StoreId \|\| row\.Id/);
  assert.match(builder[0], /ResumeInstall:\s*true/);
  assert.doesNotMatch(builder[0], /param\.Form|param\.Row|AppPakcet\s*:|Object\.keys\(row\)/);
});

test("application-store upgrade resources carry the canonical resumable importer", () => {
  const packageImporter = packageModel.SysApiEngines.find(
    engine => engine.ApiEngineKey === "import-microi-store-package"
  );
  assert.ok(packageImporter, "application-store package should contain its importer");
  assert.ok(
    compareSemanticVersions(packageModel.PackageInfo.Version, "v7.0.13") >= 0,
    "application-store package version must not fall below the resumable importer baseline",
  );
  const importerSourceVersion = `v${source.match(/Version:\s*v?(\d+\.\d+\.\d+)/)?.[1] || ""}`;
  assert.equal(packageImporter.Version, importerSourceVersion);
  assert.equal(packageImporter.ApiV8Code, source, "embedded importer must match the canonical normalized source");
  assert.equal(packageImporter.LimitMemory, 3072, "trusted app-store importer needs the reviewed cumulative-allocation budget");
  assert.equal(packageImporter.Timeout, 3600, "background-capable imports must not inherit the generic ten-minute HTTP budget");
  assert.ok(compareSemanticVersions(importerSourceVersion, "v1.9.2") >= 0);
  assert.match(source, /API_ENGINE_RESOURCE_BASELINE_V1/);
  assert.match(source, /TENANT_API_ENGINE_POLICY_IMMUTABLE_V1/);
  assert.match(source, /previousState\.UpgradePolicy[\s\S]*?CreateIfMissing/);
  assert.match(source, /接口引擎稳定Id冲突/);
  assert.match(source, /接口引擎稳定Key冲突/);
  assert.match(source, /_OrderBy:\s*'InstallTime'[\s\S]*?_OrderByType:\s*'DESC'/);
  assert.match(source, /SCHEMA_BACKGROUND_CHUNKS_V1/);
  assert.match(source, /APPLICATION_ASSET_BACKGROUND_CHUNKS_V1/);
  assert.match(source, /ASSET_METADATA_WITHOUT_SECOND_DECODE_V1/);
  assert.match(source, /DATASET_INSERT_IF_MISSING_V1/);
  assert.match(source, /MYSQL_ROW_SIZE_OFFPAGE_FALLBACK_V1/);
  assert.match(source, /SKIP_MOVE_FOR_REUSED_BUILD_V1/);
  assert.match(source, /MICRO_APP_PUBLIC_HDFS_PATH_V1/);
  assert.match(source, /DB_RUNTIME_BUILD_ASSETS_V1/);
  assert.match(source, /PRUNE_ASSET_IDS_WITH_DELFORM_V1/);
  assert.match(source, /var latestCacheJson = JSON\.stringify\(latest\)/);
  assert.equal(
    (source.match(/FormData:sys_apiengine:[^`]+`, latestCacheJson\)/g) || []).length,
    3,
    "all shared interface-engine cache aliases must store JSON text for v3/v6 compatibility"
  );
  assert.doesNotMatch(
    source,
    /FormData:sys_apiengine:[^`]+`, latest\)/,
    "never pass a Jint object to the string-only V8 cache API"
  );
  assert.match(source, /var classifyDdlStatement = function/);
  assert.match(source, /INFORMATION_SCHEMA\.STATISTICS/);
  assert.match(source, /ddl_race_skip_/);
  assert.match(source, /ddlInfo\.Kind == 'index' \|\| ddlTablesChecked\[ddlTableKey\]/);
  assert.match(source, /BACKGROUND_TASK_BOOTSTRAP_READINESS_V1/);
  assert.match(source, /var legacyMenuDiyConfigFields = \[/);
  assert.match(source, /syncLegacyMenuDiyConfig\([\s\S]*?existingMenuVisibility \? existingMenuVisibility\.DiyConfig/);
  assert.match(source, /_SelectFields:\s*\['Display', 'AppDisplay', 'DiyConfig'\]/);

  const appStoreMenu = packageModel.SysMenus.find(
    menu => menu.Id === "61b7faee-35b2-4571-add2-5231a355f368"
  );
  assert.ok(appStoreMenu, "application-store menu should exist");
  const legacyMenuConfig = JSON.parse(appStoreMenu.DiyConfig);
  assert.equal(legacyMenuConfig.SelectApi, appStoreMenu.SelectApi);
  assert.equal(legacyMenuConfig.HiddenIndex, appStoreMenu.HiddenIndex);
  assert.equal(legacyMenuConfig.GeneralSeaarch, appStoreMenu.GeneralSeaarch);

  const csharpVersionGates = appStoreUpgradeSource.match(/importerVersion\s*<\s*new System\.Version\(1, 9, 2\)/g) || [];
  assert.equal(csharpVersionGates.length, 2, "runtime and downloaded-resource validation should share the v1.9.2 floor");
  assert.match(appStoreUpgradeSource, /embeddedImporterVersion\s*<\s*new System\.Version\(1, 9, 2\)/);
  assert.match(appStoreUpgradeSource, /packageVersion\s*<\s*new System\.Version\(7, 0, 13\)/);
  assert.equal(
    (appStoreUpgradeSource.match(/MYSQL_ROW_SIZE_OFFPAGE_FALLBACK_V1/g) || []).length,
    3,
    "runtime, downloaded importer, and embedded package validation must all require the row-size fallback",
  );
  assert.match(appStoreUpgradeSource, /SKIP_MOVE_FOR_REUSED_BUILD_V1/);
  assert.match(appStoreUpgradeSource, /MICRO_APP_PUBLIC_HDFS_PATH_V1/);
  assert.match(appStoreUpgradeSource, /DB_RUNTIME_BUILD_ASSETS_V1/);
  assert.match(appStoreUpgradeSource, /PRUNE_ASSET_IDS_WITH_DELFORM_V1/);
  assert.match(appStoreUpgradeSource, /BACKGROUND_TASK_BOOTSTRAP_READINESS_V1/);
  assert.match(appStoreUpgradeSource, /APPLICATION_ASSET_BACKGROUND_CHUNKS_V1/);
  assert.match(appStoreUpgradeSource, /ASSET_METADATA_WITHOUT_SECOND_DECODE_V1/);
  assert.match(appStoreUpgradeSource, /DATASET_INSERT_IF_MISSING_V1/);
  assert.match(appStoreUpgradeSource, /publisherVersion\s*<\s*new System\.Version\(1, 6, 0\)/);

  assert.match(refreshSource, /versionNumber\s*<\s*1_009_002/);
  assert.match(refreshSource, /SKIP_MOVE_FOR_REUSED_BUILD_V1/);
  assert.match(refreshSource, /MICRO_APP_PUBLIC_HDFS_PATH_V1/);
  assert.match(refreshSource, /DB_RUNTIME_BUILD_ASSETS_V1/);
  assert.match(refreshSource, /PRUNE_ASSET_IDS_WITH_DELFORM_V1/);
  assert.match(refreshSource, /BACKGROUND_TASK_BOOTSTRAP_READINESS_V1/);
  assert.match(refreshSource, /SCHEMA_BACKGROUND_CHUNKS_V1/);
  assert.match(refreshSource, /APPLICATION_ASSET_BACKGROUND_CHUNKS_V1/);
  assert.match(refreshSource, /ASSET_METADATA_WITHOUT_SECOND_DECODE_V1/);
  assert.match(refreshSource, /DATASET_INSERT_IF_MISSING_V1/);
  assert.match(refreshSource, /versionNumber\s*<\s*1_006_000/);
  assert.match(refreshSource, /versionNumber\s*<\s*7_000_013/);
  assert.match(refreshSource, /importerVersionNumber\s*<\s*1_009_002/);
  assert.match(refreshSource, /API_ENGINE_RESOURCE_BASELINE_V1/);
  assert.match(refreshSource, /TENANT_API_ENGINE_POLICY_IMMUTABLE_V1/);
});

test("reinstall DDL classifies existing indexes for idempotent skipping", () => {
  const classifierSource = source.match(
    /var classifyDdlStatement = function \(ddl, fallbackTableName\) \{[\s\S]*?\n    \};/
  );
  assert.ok(classifierSource, "DDL classifier should be extractable");
  const context = {};
  vm.runInNewContext(`${classifierSource[0]}; result = classifyDdlStatement;`, context);
  const classify = context.result;

  assert.deepEqual(
    JSON.parse(JSON.stringify(classify(
      "CREATE TABLE IF NOT EXISTS `mci_background_task` (`Id` varchar(36))",
      "mci_background_task",
    ))),
    { Kind: "table", TableName: "mci_background_task", IndexName: "" },
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(classify(
      "CREATE INDEX `ix_mci_background_task_concurrency` ON `mci_background_task` (`OsClient`)",
      "mci_background_task",
    ))),
    {
      Kind: "index",
      TableName: "mci_background_task",
      IndexName: "ix_mci_background_task_concurrency",
    },
  );
});

test("background-task bootstrap is verified from physical columns and indexes before success", () => {
  const requiredColumns = [
    "Id", "OsClient", "UserKey", "Title", "ApiEngineKey", "Status", "Progress",
    "WorkCurrent", "WorkTotal", "EstimatedEndTime", "IdempotencyKey", "ConcurrencyKey",
    "LeaseOwner", "LeaseExpiresAt", "FencingToken", "CheckpointJson", "BusinessEtaField",
    "RuntimeOsClientType", "RuntimeOsClientNetwork",
  ];
  const requiredIndexes = [
    "ux_mci_bg_task_runtime_idem",
    "ix_mci_bg_task_runtime_claim",
    "ix_mci_background_task_user",
    "ix_mci_background_task_concurrency",
  ];

  assert.match(source, /var validateBackgroundTaskBootstrapReadiness = function/);
  assert.match(source, /getTargetPhysicalColumns\(tableName\)/);
  for (const column of requiredColumns) assert.match(source, new RegExp(`'${column}'`));
  for (const index of requiredIndexes) assert.match(source, new RegExp(`'${index}'`));
  assert.match(source, /candidateNames = \[requiredIndex\.Name\]\.concat\(requiredIndex\.Aliases \|\| \[\]\)/);
  assert.ok(
    source.indexOf("validateBackgroundTaskBootstrapReadiness()")
      < source.indexOf("正在写入应用安装版本记录"),
    "physical readiness must fail the transaction before recording an installed version",
  );
});

test("reinstall skips unchanged diy_field definitions before FormEngine update", () => {
  const helperSource = source.match(
    /var comparableFieldValue = function \(value\) \{[\s\S]*?var fieldDefinitionNeedsUpdate = function \(oldField, fieldCopy\) \{[\s\S]*?\n    \};/
  );
  assert.ok(helperSource, "field comparison helpers should be extractable");
  const context = { JSON, Object, String };
  vm.runInNewContext(`${helperSource[0]}; result = fieldDefinitionNeedsUpdate;`, context);
  const needsUpdate = context.result;

  const current = { Id: "f1", Name: "Status", Label: "状态", Visible: 1, UpdateTime: "old" };
  assert.equal(needsUpdate(current, { Id: "f1", Name: "Status", Label: "状态", Visible: 1 }), false);
  assert.equal(needsUpdate(current, { Id: "f1", Name: "Status", Label: "任务状态", Visible: 1 }), true);
  assert.match(source, /!fieldDefinitionNeedsUpdate\(oldFieldResult\.Data, fieldCopy\)/);
  assert.match(source, /stats\.FieldSkipped\+\+/);
});

test("legacy databases receive application-store bootstrap columns before upgrade 13", () => {
  assert.match(upgradeSource, /EnsureApiEngineRuntimeColumns\(osClientSecret\)/);
  for (const columnName of ["StopHttp", "Timeout", "MaxStatements", "LimitMemory", "LimitRecursion", "Lock"]) {
    assert.match(upgradeSource, new RegExp(`\\["${columnName}"\\]\\s*=\\s*"int"`));
  }
  assert.match(upgradeSource, /EnsureColumn\(osClientSecret,\s*"diy_field",\s*"TableName",\s*"varchar\(50\)"\)/);
  assert.match(upgradeSource, /INNER JOIN `diy_table` dt ON dt\.`Id`=df\.`TableId`/);
  assert.match(apiProgramSource, /const int maxAttempts = 3;/);
  assert.match(apiProgramSource, /const int retrySeconds = 10;/);
  assert.doesNotMatch(apiProgramSource, /License:RestoreMaxAttempts|License:RestoreRetrySeconds/);
  assert.doesNotMatch(apiProgramSource, /MICROI_LICENSE_RESTORE_/);
});

test("database runtime mode embeds compiled files while retaining the HDFS manifest", () => {
  assert.match(source, /runtimeStorageMode[\s\S]*?\^\(db\|database\)\$/);
  assert.match(source, /DB_RUNTIME_BUILD_ASSETS_V1/);
  assert.match(source, /runtimeDbAssets\.push\(\{[\s\S]*?ContentBase64:\s*runtimeBuildBase64/);
  assert.match(source, /AssetsJson:\s*JSON\.stringify\(inlineRuntimeBuild \? runtimeDbAssets : uploadedBuild\)/);
  assert.match(source, /AssetManifestJson:\s*JSON\.stringify\(\{[\s\S]*?Assets:\s*uploadedBuild/);
  assert.match(source, /if \(inlineRuntimeBuild\) runtimeStorageMode = 'db'/);
});

test("application-store package embeds the canonical publisher", () => {
  const packagePublisher = packageModel.SysApiEngines.find(
    engine => engine.ApiEngineKey === "ai_app_publish_store"
  );
  assert.ok(packagePublisher);
  const publisherSourceVersion = `v${publishSource.match(/Version:\s*v?(\d+\.\d+\.\d+)/)?.[1] || ""}`;
  assert.equal(packagePublisher.Version, publisherSourceVersion);
  assert.equal(packagePublisher.ApiV8Code.replace(/\r\n/g, "\n"), publishSource.replace(/\r\n/g, "\n"));
  assert.match(publishSource, /latestVersion \? text\(latestVersion\.BuildLog\)/);
  assert.match(publishSource, /Path: 'index\.html'/);
});

test("stale application files use the Jint-safe DelFormData Ids contract", () => {
  const functionSource = source.match(
    /var pruneApplicationAssets = function \(appId, expectedPaths\) \{[\s\S]*?\n    \};/
  );
  assert.ok(functionSource, "prune function should be extractable");
  const calls = [];
  const context = {
    resumeInstall: true,
    stats: { AssetRowsPruned: 0 },
    loadExistingApplicationAssets() {
      return {
        "app.vue": { Id: "keep" },
        "source/old.vue": { Id: "old-source" },
        "build/old.js": { Id: "old-build" }
      };
    },
    V8: {
      FormEngine: {
        DelFormData(tableName, param) {
          calls.push({ tableName, param });
          return { Code: 1 };
        },
        DelTableData() {
          throw new Error("DelTableData overload must not be used from Jint");
        }
      }
    }
  };
  vm.runInNewContext(`${functionSource[0]}; pruneApplicationAssets("app-1", { "app.vue": true });`, context);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{
    tableName: "mci_ai_app_file",
    param: { Ids: ["old-source", "old-build"] }
  }]);
  assert.equal(context.stats.AssetRowsPruned, 2);
});

test("fully reused build assets skip object moves and reach stale-row pruning", () => {
  const buildStageSource = source.match(
    /var uploadedBuild = \[\];[\s\S]*?pruneApplicationAssets\(appId, expectedApplicationPaths\);/
  );
  assert.ok(buildStageSource, "build asset stage should be extractable");

  const calls = { move: 0, upload: 0, upsert: 0, prune: 0 };
  const buildContext = {
    appId: "app-1",
    appKey: "resume-app",
    appType: "UniApp",
    inlineRuntimeBuild: false,
    buildRoot: "ai-app-publish/resume-app/versions/v1.0.0",
    buildAssets: [
      { Path: "index.html", Size: 128, Sha256: "hash-index" },
      { Path: "assets/app.js", Size: 256, Sha256: "hash-script" }
    ],
    existingApplicationAssets: {},
    expectedApplicationPaths: {},
    stats: { ApplicationBuildAssets: 0, ApplicationBuildAssetsReused: 0 },
    V8: {
      OsClient: "lsg",
      Method: {
        MoveObject() {
          calls.move++;
          return { Code: 1 };
        }
      }
    },
    normalizeApplicationPath(value) {
      return String(value || "").replace(/\\/g, "/").replace(/^\/+/, "");
    },
    reuseApplicationAsset(_existing, metadataPath, file) {
      return {
        Path: metadataPath,
        HdfsPath: `lsg/ai-app-publish/resume-app/${metadataPath.replace(/^dist\//, "")}`,
        Size: file.Size,
        Hash: file.Sha256,
        Reused: true
      };
    },
    uploadApplicationAsset() {
      calls.upload++;
      throw new Error("reused assets must not be uploaded again");
    },
    upsertApplicationRow() {
      calls.upsert++;
      return { Code: 1 };
    },
    applicationFileName(value) {
      return String(value || "").split("/").pop();
    },
    applicationFileType() {
      return "text/plain";
    },
    shouldContinueApplicationAssets() { return false; },
    markApplicationAssetUploaded() {},
    reportProgress() {},
    pruneApplicationAssets() {
      calls.prune++;
    }
  };

  vm.runInNewContext(
    `(function () { ${buildStageSource[0]}; this.uploadedBuild = uploadedBuild; }).call(this);`,
    buildContext
  );

  assert.equal(calls.upload, 0, "reused build assets should not upload again");
  assert.equal(calls.move, 0, "reused build assets should not move again");
  assert.equal(calls.upsert, 0, "reused build metadata should not upsert again");
  assert.equal(calls.prune, 1, "a fully reused build should proceed to stale-row pruning");
  assert.equal(buildContext.stats.ApplicationBuildAssetsReused, 2);
});

test("fresh microservice build moves to a tenant-prefixed stable public HDFS key", () => {
  const buildStageSource = source.match(
    /var uploadedBuild = \[\];[\s\S]*?pruneApplicationAssets\(appId, expectedApplicationPaths\);/
  );
  assert.ok(buildStageSource, "build asset stage should be extractable");

  const calls = { move: [], rows: [] };
  const buildContext = {
    appId: "app-1",
    appKey: "demo-service",
    appName: "Demo Service",
    appType: "MicroService",
    inlineRuntimeBuild: false,
    buildRoot: "micro-app/demo-service/v1.0.0",
    buildAssets: [{ Path: "index.html", Size: 128, Sha256: "hash-index" }],
    existingApplicationAssets: {},
    expectedApplicationPaths: {},
    stats: { ApplicationBuildAssets: 0, ApplicationBuildAssetsReused: 0 },
    V8: {
      OsClient: "Loctek-LowCode",
      Method: {
        MoveObject(param) {
          calls.move.push(param);
          return { Code: 1 };
        }
      }
    },
    normalizeApplicationPath(value) {
      return String(value || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    },
    firstTextParam(values) {
      return values.find(value => value !== null && value !== undefined && String(value).trim() !== "") || "";
    },
    reuseApplicationAsset() { return null; },
    uploadApplicationAsset() {
      return {
        Path: "index.html",
        HdfsPath: "/loctek-lowcode/temp/index-123.html",
        FilePathName: "/loctek-lowcode/temp/index-123.html",
        Size: 128,
        Hash: "hash-index"
      };
    },
    upsertApplicationRow(_table, _where, row) {
      calls.rows.push({ ...row });
      return { Code: 1 };
    },
    applicationFileName(value) { return String(value || "").split("/").pop(); },
    applicationFileType() { return "html"; },
    shouldContinueApplicationAssets() { return false; },
    markApplicationAssetUploaded() {},
    reportProgress() {},
    pruneApplicationAssets() {}
  };

  vm.runInNewContext(
    `(function () { ${buildStageSource[0]}; this.uploadedBuild = uploadedBuild; }).call(this);`,
    buildContext
  );

  const stablePath = "loctek-lowcode/micro-app/demo-service/v1.0.0/index.html";
  assert.equal(calls.move.length, 1);
  assert.equal(calls.move[0].Path, stablePath);
  assert.equal(calls.rows.length, 1);
  assert.equal(calls.rows[0].HdfsPath, stablePath);
  assert.equal(buildContext.uploadedBuild[0].FilePathName, stablePath);
  assert.equal(buildContext.uploadedBuild[0].PublishHdfsPath, stablePath);
});

test("database runtime build keeps the HDFS copy and embeds the package bytes", () => {
  const buildStageSource = source.match(
    /var uploadedBuild = \[\];[\s\S]*?pruneApplicationAssets\(appId, expectedApplicationPaths\);/
  );
  assert.ok(buildStageSource, "build asset stage should be extractable");

  const calls = { upload: 0, move: 0, rows: [] };
  const buildContext = {
    appId: "app-db",
    appKey: "db-service",
    appName: "DB Service",
    appType: "MicroService",
    inlineRuntimeBuild: true,
    buildRoot: "micro-app/db-service/v1.0.0",
    buildAssets: [{
      Path: "index.html",
      FileName: "index.html",
      ContentType: "text/html",
      FileByteBase64: "PGgxPk9LPC9oMT4=",
      Size: 11,
      Sha256: "hash-index",
      IsEntry: true
    }],
    existingApplicationAssets: {},
    expectedApplicationPaths: {},
    stats: { ApplicationBuildAssets: 0, ApplicationBuildAssetsReused: 0 },
    V8: {
      OsClient: "tenant-a",
      Base64: { StringToBase64(value) { return Buffer.from(value).toString("base64"); } },
      Method: {
        MoveObject() {
          calls.move++;
          return { Code: 1 };
        }
      }
    },
    normalizeApplicationPath(value) {
      return String(value || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    },
    firstTextParam(values) {
      return values.find(value => value !== null && value !== undefined && String(value).trim() !== "") || "";
    },
    reuseApplicationAsset() { return null; },
    uploadApplicationAsset() {
      calls.upload++;
      return {
        Path: "index.html",
        HdfsPath: "tenant-a/temp/index.html",
        FilePathName: "tenant-a/temp/index.html",
        Size: 11,
        Hash: "hash-index"
      };
    },
    upsertApplicationRow(_table, _where, row) {
      calls.rows.push({ ...row });
      return { Code: 1 };
    },
    applicationFileName(value) { return String(value || "").split("/").pop(); },
    applicationFileType() { return "html"; },
    shouldContinueApplicationAssets() { return false; },
    markApplicationAssetUploaded() {},
    reportProgress() {},
    pruneApplicationAssets() {}
  };

  vm.runInNewContext(
    `(function () { ${buildStageSource[0]}; this.uploadedBuild = uploadedBuild; this.runtimeDbAssets = runtimeDbAssets; }).call(this);`,
    buildContext
  );

  assert.equal(calls.upload, 1, "DB runtime must still upload the HDFS build asset");
  assert.equal(calls.move, 1, "DB runtime must still move the HDFS build asset to its stable key");
  assert.equal(calls.rows.length, 1, "DB runtime must still persist HDFS build metadata");
  assert.deepEqual(JSON.parse(JSON.stringify(buildContext.runtimeDbAssets)), [{
    Path: "index.html",
    FileName: "index.html",
    ContentType: "text/html",
    ContentBase64: "PGgxPk9LPC9oMT4=",
    Size: 11,
    Hash: "hash-index",
    IsEntry: true
  }]);
});

test("legacy reused microservice build with a broken key is reuploaded and repaired", () => {
  const buildStageSource = source.match(
    /var uploadedBuild = \[\];[\s\S]*?pruneApplicationAssets\(appId, expectedApplicationPaths\);/
  );
  assert.ok(buildStageSource, "build asset stage should be extractable");

  const calls = { move: [], upload: 0, rows: [] };
  const buildContext = {
    appId: "app-1",
    appKey: "demo-service",
    appName: "Demo Service",
    appType: "MicroService",
    inlineRuntimeBuild: false,
    buildRoot: "micro-app/demo-service/v1.0.0",
    buildAssets: [{ Path: "index.html", Size: 128, Sha256: "hash-index" }],
    existingApplicationAssets: {
      "dist/index.html": {
        Id: "old-build",
        HdfsPath: "micro-app/demo-service/v1.0.0/index.html",
        ContentHash: "hash-index",
        Size: 128
      }
    },
    expectedApplicationPaths: {},
    stats: { ApplicationBuildAssets: 0, ApplicationBuildAssetsReused: 0 },
    V8: {
      OsClient: "Loctek-LowCode",
      Method: {
        MoveObject(param) {
          calls.move.push(param);
          return { Code: calls.move.length === 1 ? 0 : 1 };
        }
      }
    },
    normalizeApplicationPath(value) {
      return String(value || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    },
    reuseApplicationAsset(_existing, metadataPath, file) {
      return {
        Path: metadataPath,
        HdfsPath: "micro-app/demo-service/v1.0.0/index.html",
        FilePathName: "micro-app/demo-service/v1.0.0/index.html",
        Size: file.Size,
        Hash: file.Sha256,
        Reused: true
      };
    },
    uploadApplicationAsset() {
      calls.upload++;
      return {
        Path: "index.html",
        HdfsPath: "/loctek-lowcode/temp/index-456.html",
        FilePathName: "/loctek-lowcode/temp/index-456.html",
        Size: 128,
        Hash: "hash-index"
      };
    },
    upsertApplicationRow(_table, _where, row) {
      calls.rows.push({ ...row });
      return { Code: 1 };
    },
    applicationFileName(value) { return String(value || "").split("/").pop(); },
    applicationFileType() { return "html"; },
    shouldContinueApplicationAssets() { return false; },
    markApplicationAssetUploaded() {},
    reportProgress() {},
    pruneApplicationAssets() {}
  };

  vm.runInNewContext(
    `(function () { ${buildStageSource[0]}; this.uploadedBuild = uploadedBuild; }).call(this);`,
    buildContext
  );

  const stablePath = "loctek-lowcode/micro-app/demo-service/v1.0.0/index.html";
  assert.equal(calls.move.length, 2, "broken legacy object should retry after reupload");
  assert.equal(calls.upload, 1);
  assert.equal(calls.rows.length, 1);
  assert.equal(calls.rows[0].HdfsPath, stablePath);
  assert.equal(buildContext.stats.ApplicationBuildAssetsReused, 0);
  assert.equal(buildContext.stats.ApplicationBuildAssets, 1);
});

test("managed micro-app assets proxy stable HDFS paths instead of cross-origin redirects", () => {
  assert.match(microAppControllerSource, /GetText\(asset, "hdfsPath", "HdfsPath"\)/);
  assert.match(microAppControllerSource, /GetText\(asset, "publishHdfsPath", "PublishHdfsPath"\)/);
  assert.match(microAppControllerSource, /HasFileAssetManifest[\s\S]*?"HdfsPath"[\s\S]*?"PublishHdfsPath"/);
  assert.match(microAppControllerSource, /directFileUrl[\s\S]*?IsTrustedPublicFileUrl\(osClient, directFileUrl\)[\s\S]*?DownloadPublicFileAssetBytes\(directFileUrl\)/);
  assert.match(microAppControllerSource, /assetUri\.Host\.Equals\(fileServerUri\.Host[\s\S]*?assetUri\.Port == fileServerUri\.Port/);
  assert.match(microAppControllerSource, /MicroApp file asset could not be read from managed storage/);
  assert.doesNotMatch(microAppControllerSource, /return Redirect\(redirectUrl\);/);
});

test("updating an existing menu preserves customer desktop and mobile visibility", () => {
    assert.match(source, /GetFormData\('sys_menu',[\s\S]*?_SelectFields:\s*\['Display', 'AppDisplay', 'DiyConfig'\]/);
  assert.match(source, /existingMenuVisibility\.Display[\s\S]*?modelCopy\.Display/);
  assert.match(source, /existingMenuVisibility\.AppDisplay[\s\S]*?modelCopy\.AppDisplay/);
  assert.match(source, /preserve_existing_menu_visibility_/);
});

test("server upgrade snapshots and restores existing AppDisplay values", () => {
  assert.match(upgradeSource, /EnsureMobileVisibilityColumns\(osClientSecret\)/);
  assert.match(upgradeSource, /CaptureMenuAppDisplaySnapshot\(osClientSecret\)/);
  assert.match(upgradeSource, /RestoreMenuAppDisplaySnapshotAsync\(osClientSecret, menuAppDisplaySnapshot\)/);
  assert.match(upgradeSource, /SET \{quoteOpen\}AppDisplay\{quoteClose\}=@p0/);
});

test("legacy sys_menu partial updates preserve omitted visibility fields", () => {
  assert.match(sysMenuLogicSource, /MapNotNull<object, SysMenu>\(param, model\)/);
  assert.match(sysMenuLogicSource, /model\.AppDisplay\s*=\s*param\.AppDisplay\s*\?\?\s*1/);
  assert.doesNotMatch(sysMenuLogicSource, /model\s*=\s*MapperHelper\.MapNotNull<object, SysMenu>\(param\);/);
});
