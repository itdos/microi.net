import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("./import-package.js", import.meta.url), "utf8");
const publishSource = await readFile(new URL("./ai-app-publish-store.js", import.meta.url), "utf8");
const upgradeSource = await readFile(new URL("../Upgrade.cs", import.meta.url), "utf8");
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
});

test("microservice installation preserves source-server native menus and migrates target placeholders", () => {
  assert.match(source, /LegacyMenuUrls[\s\S]*?LegacyComponentPaths/);
  assert.match(source, /PreserveExistingNativeMenus:\s*preserveExistingNativeMenus/);
  assert.match(source, /isExistingNativeComponent[\s\S]*?MicroServiceMenusPreserved\+\+/);
  assert.match(source, /OpenType:\s*'MicroService'/);
  assert.match(source, /stableMenuUrl[\s\S]*?Url:\s*stableMenuUrl/);
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
