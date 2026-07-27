import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { compareSemanticVersions } from "./application-store-replica-sync.mjs";

const source = await readFile(new URL("./import-package.js", import.meta.url), "utf8");
const publishSource = await readFile(new URL("./ai-app-publish-store.js", import.meta.url), "utf8");
const packageModel = JSON.parse(await readFile(new URL("./app.microi.store.json", import.meta.url), "utf8"));
const refreshSource = await readFile(new URL("./refresh-resources.mjs", import.meta.url), "utf8");
const upgradeSource = await readFile(new URL("../Upgrade.cs", import.meta.url), "utf8");
const appStoreUpgradeSource = await readFile(new URL("../13-UpgradeAppStore.cs", import.meta.url), "utf8");
const sysMenuLogicSource = await readFile(new URL("../../Microi.Core/Logic/SysMenuLogic.cs", import.meta.url), "utf8");
const microAppControllerSource = await readFile(new URL("../../Microi.net.Api/Controllers/MicroAppController.cs", import.meta.url), "utf8");
const apiProgramSource = await readFile(new URL("../../Microi.net.Api/Program.cs", import.meta.url), "utf8");
const functionSource = source.match(/var countPageTabs = function \(value\) \{[\s\S]*?\n\};/);

assert.ok(functionSource, "countPageTabs helper should exist");

const context = {};
vm.runInNewContext(`${functionSource[0]}\nresult = countPageTabs;`, context);
const countPageTabs = context.result;

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

test("application-store upgrade resources carry the canonical resumable importer", () => {
  const packageImporter = packageModel.SysApiEngines.find(
    engine => engine.ApiEngineKey === "import-microi-store-package"
  );
  assert.ok(packageImporter, "application-store package should contain its importer");
  assert.ok(
    compareSemanticVersions(packageModel.PackageInfo.Version, "v6.5.16") >= 0,
    "application-store package version must not fall below the resumable importer baseline",
  );
  const importerSourceVersion = `v${source.match(/Version:\s*v?(\d+\.\d+\.\d+)/)?.[1] || ""}`;
  assert.equal(packageImporter.Version, importerSourceVersion);
  assert.equal(packageImporter.ApiV8Code, source, "embedded importer must match the canonical source byte-for-byte");
  assert.ok(compareSemanticVersions(importerSourceVersion, "v1.6.6") >= 0);
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

  const csharpVersionGates = appStoreUpgradeSource.match(/importerVersion\s*<\s*new System\.Version\(1, 6, 6\)/g) || [];
  assert.equal(csharpVersionGates.length, 2, "runtime and downloaded-resource validation should share the v1.6.6 floor");
  assert.match(appStoreUpgradeSource, /SKIP_MOVE_FOR_REUSED_BUILD_V1/);
  assert.match(appStoreUpgradeSource, /MICRO_APP_PUBLIC_HDFS_PATH_V1/);
  assert.match(appStoreUpgradeSource, /DB_RUNTIME_BUILD_ASSETS_V1/);
  assert.match(appStoreUpgradeSource, /PRUNE_ASSET_IDS_WITH_DELFORM_V1/);
  assert.match(appStoreUpgradeSource, /publisherVersion\s*<\s*new System\.Version\(1, 4, 4\)/);
  assert.match(appStoreUpgradeSource, /packageVersion\s*<\s*new System\.Version\(6, 5, 16\)/);

  assert.match(refreshSource, /versionNumber\s*<\s*1_006_006/);
  assert.match(refreshSource, /SKIP_MOVE_FOR_REUSED_BUILD_V1/);
  assert.match(refreshSource, /MICRO_APP_PUBLIC_HDFS_PATH_V1/);
  assert.match(refreshSource, /DB_RUNTIME_BUILD_ASSETS_V1/);
  assert.match(refreshSource, /PRUNE_ASSET_IDS_WITH_DELFORM_V1/);
  assert.match(refreshSource, /versionNumber\s*<\s*1_004_004/);
  assert.match(refreshSource, /versionNumber\s*<\s*6_005_014/);
});

test("legacy databases receive application-store bootstrap columns before upgrade 13", () => {
  assert.match(upgradeSource, /EnsureApiEngineRuntimeColumns\(osClientSecret\)/);
  for (const columnName of ["StopHttp", "Timeout", "MaxStatements", "LimitMemory", "LimitRecursion", "Lock"]) {
    assert.match(upgradeSource, new RegExp(`\\["${columnName}"\\]\\s*=\\s*"int"`));
  }
  assert.match(upgradeSource, /EnsureColumn\(osClientSecret,\s*"diy_field",\s*"TableName",\s*"varchar\(50\)"\)/);
  assert.match(upgradeSource, /INNER JOIN `diy_table` dt ON dt\.`Id`=df\.`TableId`/);
  assert.match(apiProgramSource, /"MICROI_LICENSE_RESTORE_MAX_ATTEMPTS",[\s\S]*?"License:RestoreMaxAttempts",[\s\S]*?\b3\)\)/);
  assert.match(apiProgramSource, /"MICROI_LICENSE_RESTORE_RETRY_SECONDS",[\s\S]*?"License:RestoreRetrySeconds",[\s\S]*?\b10\)\)/);
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
    reportProgress() {},
    pruneApplicationAssets() {
      calls.prune++;
    }
  };

  vm.runInNewContext(buildStageSource[0], buildContext);

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
    reportProgress() {},
    pruneApplicationAssets() {}
  };

  vm.runInNewContext(buildStageSource[0], buildContext);

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
    reportProgress() {},
    pruneApplicationAssets() {}
  };

  vm.runInNewContext(buildStageSource[0], buildContext);

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
    reportProgress() {},
    pruneApplicationAssets() {}
  };

  vm.runInNewContext(buildStageSource[0], buildContext);

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
