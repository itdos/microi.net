import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("./import-package.js", import.meta.url), "utf8");
const publishSource = await readFile(new URL("./ai-app-publish-store.js", import.meta.url), "utf8");
const packageModel = JSON.parse(await readFile(new URL("./app.microi.store.json", import.meta.url), "utf8"));
const refreshSource = await readFile(new URL("./refresh-resources.mjs", import.meta.url), "utf8");
const upgradeSource = await readFile(new URL("../Upgrade.cs", import.meta.url), "utf8");
const appStoreUpgradeSource = await readFile(new URL("../13-UpgradeAppStore.cs", import.meta.url), "utf8");
const sysMenuLogicSource = await readFile(new URL("../../Microi.Core/Logic/SysMenuLogic.cs", import.meta.url), "utf8");
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
  assert.equal(packageModel.PackageInfo.Version, "v6.5.8");
  assert.equal(packageImporter.Version, "v1.6.3");
  assert.equal(packageImporter.ApiV8Code, source, "embedded importer must match the canonical source byte-for-byte");
  assert.match(source, /Version:\s*v1\.6\.3/);
  assert.match(source, /SKIP_MOVE_FOR_REUSED_BUILD_V1/);
  assert.match(source, /PRUNE_ASSET_IDS_WITH_DELFORM_V1/);

  const csharpVersionGates = appStoreUpgradeSource.match(/importerVersion\s*<\s*new System\.Version\(1, 6, 3\)/g) || [];
  assert.equal(csharpVersionGates.length, 2, "runtime and downloaded-resource validation should share the v1.6.3 floor");
  assert.match(appStoreUpgradeSource, /SKIP_MOVE_FOR_REUSED_BUILD_V1/);
  assert.match(appStoreUpgradeSource, /PRUNE_ASSET_IDS_WITH_DELFORM_V1/);
  assert.match(appStoreUpgradeSource, /publisherVersion\s*<\s*new System\.Version\(1, 4, 4\)/);
  assert.match(appStoreUpgradeSource, /packageVersion\s*<\s*new System\.Version\(6, 5, 8\)/);

  assert.match(refreshSource, /versionNumber\s*<\s*1_006_003/);
  assert.match(refreshSource, /SKIP_MOVE_FOR_REUSED_BUILD_V1/);
  assert.match(refreshSource, /PRUNE_ASSET_IDS_WITH_DELFORM_V1/);
  assert.match(refreshSource, /versionNumber\s*<\s*1_004_004/);
  assert.match(refreshSource, /versionNumber\s*<\s*6_005_008/);
});

test("application-store package embeds the canonical v1.4.4 publisher", () => {
  const packagePublisher = packageModel.SysApiEngines.find(
    engine => engine.ApiEngineKey === "ai_app_publish_store"
  );
  assert.ok(packagePublisher);
  assert.equal(packagePublisher.Version, "v1.4.4");
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

test("updating an existing menu preserves customer desktop and mobile visibility", () => {
  assert.match(source, /GetFormData\('sys_menu',[\s\S]*?_SelectFields:\s*\['Display', 'AppDisplay'\]/);
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
