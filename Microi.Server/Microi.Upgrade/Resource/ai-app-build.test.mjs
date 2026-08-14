import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("./ai-app-build.js", import.meta.url), "utf8");
const packageModel = JSON.parse(await readFile(new URL("./app.microi.store.json", import.meta.url), "utf8"));
const upgradeSource = await readFile(new URL("../13-UpgradeAppStore.cs", import.meta.url), "utf8");
const projectSource = await readFile(new URL("../Microi.Upgrade.csproj", import.meta.url), "utf8");

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

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`unterminated function ${name}`);
}

function createInjector(apiBase = "https://tenant-api.example.com/", osClient = "tenant_demo") {
  const context = {
    V8: { SysConfig: { ApiBase: apiBase }, OsClient: osClient },
    JSON,
    Object,
    String,
  };
  vm.runInNewContext(`
    function text(value, fallback) { return value === null || value === undefined ? (fallback || "") : String(value); }
    function isBlank(value) { return text(value).replace(/^\\s+|\\s+$/g, "") === ""; }
    ${extractFunction("runtimeContextJson")}
    ${extractFunction("injectRuntimeContext")}
    result = injectRuntimeContext;
  `, context);
  return context.result;
}

function createUniAppShellHelpers() {
  const context = {
    JSON,
    String,
    escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
    },
  };
  vm.runInNewContext(`
    function text(value, fallback) { return value === null || value === undefined ? (fallback || "") : String(value); }
    ${extractFunction("applicationTypeOf")}
    ${extractFunction("isUniAppApplication")}
    ${extractFunction("hasUniAppPreviewShell")}
    ${extractFunction("createUniAppPreviewShell")}
    result = { applicationTypeOf, isUniAppApplication, hasUniAppPreviewShell, createUniAppPreviewShell };
  `, context);
  return context.result;
}

test("published entry injects the current tenant runtime context before application scripts", () => {
  const inject = createInjector();
  const html = inject("<!doctype html><html><head><script src=\"app.js\"></script></head><body></body></html>");
  assert.match(html, /data-microi-runtime-context="true"/);
  assert.match(html, /https:\/\/tenant-api\.example\.com/);
  assert.match(html, /tenant_demo/);
  assert.ok(html.indexOf("data-microi-runtime-context") < html.indexOf("app.js"));
  assert.equal((html.match(/data-microi-runtime-context/g) || []).length, 1);
  assert.equal(inject(html), html, "runtime context injection must be idempotent");
});

test("runtime context is XSS-safe and never hardcodes the official API", () => {
  const inject = createInjector("https://tenant.example.com/</script><script>alert(1)</script>", "tenant_x");
  const html = inject("<html><body>ok</body></html>");
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /\\u003c\/script>/);
  assert.doesNotMatch(source, /https:\/\/api\.itdos\.com/);
  assert.match(source, /V8\.SysConfig\s*&&\s*V8\.SysConfig\.ApiBase/);
});

test("compiled wrapper, nested app HTML, and legacy paths all receive fresh runtime context", () => {
  assert.match(source, /var roots = \["build\/", "dist\/", "unpackage\/dist\/build\/h5\/"\]/);
  assert.match(source, /isBlank\(versionNo\) \? "\/latest" : "\/versions\/"/);
  assert.match(source, /ai-app-publish\/" \+ text\(appKey\) \+ "\/latest\/index\.html"/);
  assert.match(source, /ALIYUN_CDN_STABLE_ASSET_REFRESH_V1/);
  assert.match(source, /Action:\s*"RefreshObjectCaches"/);
  assert.match(source, /ObjectType:\s*"File"/);
  assert.match(source, /HMACSHA1/);
  assert.match(source, /refreshStableCdnPaths\(stableAssetPaths\)/);
  assert.match(source, /requestedAction\s*===\s*"RefreshStableCdn"/);
  assert.match(source, /LEGACY_MICRO_APP_REDIRECT_PUBLISH_V1/);
  assert.match(source, /requestedAction\s*===\s*"PublishLegacyMicroAppRedirects"/);
  assert.match(source, /function immutableRuntimeBaseUrl\(/);
  assert.match(source, /\^\[a-f0-9\]\{64\}\\\/assets\$/i);
  assert.match(source, /redirectVersionNo \+ "\/unity\/index\.html"/);
  assert.match(source, /redirectEntries = \[/);
  assert.match(source, /movePublicObject\(redirectUploadedPath, redirectTargetPath\)/);
  assert.match(source, /refreshStableCdnPaths\(redirectRefreshPaths, true\)/);
  assert.match(source, /LEGACY_MICRO_APP_CDN_REFRESH_V1/);
  assert.match(source, /requestedAction\s*===\s*"RefreshLegacyMicroAppCdn"/);
  assert.match(source, /legacyRefreshRoot\s*=\s*text\(V8\.OsClient\)\.toLowerCase\(\)\s*\+\s*"\/micro-app\/"/);
  assert.match(source, /legacyRefreshPaths\.length > 100/);
  assert.match(source, /refreshStableCdnPaths\(scopedLegacyRefreshPaths, true\)/);
  assert.match(source, /RESUMABLE_PUBLIC_DOWNLOAD_REGISTRATION_V1/);
  assert.match(source, /requestedAction\s*===\s*"RegisterResumablePublicDownload"/);
  assert.match(source, /requestedAction\s*===\s*"PromoteResumablePublicDownload"/);
  assert.match(source, /StorageScope", "=", "ApplicationAssetMultipartSession"/);
  assert.match(source, /text\(downloadState\.Status\) !== "Succeeded"/);
  assert.match(source, /text\(downloadState\.ExpectedSha256\)\.toLowerCase\(\) !== downloadExpectedSha256/);
  assert.match(source, /downloadTargetPath\s*=\s*downloadSourcePath/);
  assert.doesNotMatch(source, /movePublicObject\(downloadSourcePath, downloadTargetPath\)/);
  assert.match(source, /DownloadRegisteredAt/);
  assert.match(source, /DownloadRegisteredAt\s*=\s*now\(\)/);
  assert.match(source, /DownloadPublicPath = downloadTargetPath/);
  assert.match(source, /requestedAction\s*===\s*"PromoteStableAssetsBatch"/);
  assert.match(source, /function promoteStableStoreAssets\(/);
  assert.match(source, /function publishBase64ToExactPublicPath\(/);
  assert.match(source, /STABLE_ASSET_HOTFIX_V1/);
  assert.match(source, /snapshotVersionNo/);
  assert.match(source, /RootFilePathName:\s*rootPath/);
  assert.match(source, /stablePaths\.push\(rootPath\)/);
  assert.match(source, /explicitRefreshPaths\.length > 100/);
  assert.match(source, /refreshStableCdnPaths\(manualRefreshPaths, explicitRefreshPaths\.length > 0\)/);
  assert.match(source, /requestedAction\s*===\s*"PromoteStoreAssetsBatch"/);
  assert.match(source, /requestedAction\s*===\s*"FinalizeStoreAssets"/);
  assert.match(source, /source\.sourceFileId\s*\|\|\s*source\.SourceFileId/);
  assert.match(source, /requireEntry !== false/);
  assert.match(source, /var isEntry\s*=\s*relativePath\.toLowerCase\(\)\s*===\s*"index\.html"/);
  assert.match(source, /var isHtml\s*=\s*\/\\\.html\$\/i\.test\(relativePath\)/);
  assert.match(source, /var versionSegment\s*=.*"\/versions\/"/);
  assert.match(source, /var latestPublishRoot\s*=\s*"ai-app-publish\/"\s*\+\s*appKey/);
  assert.match(source, /StableFilePathName:\s*latestPath/);
  assert.match(source, /VersionEntryPath:\s*versionEntryPath/);
  assert.match(source, /for \(var pass = 0; pass < 2; pass\+\+\)/);
  assert.match(source, /publishCompiledFiles\(files, buildRoot, app\.Data, appKey, versionNo\)/);
  assert.doesNotMatch(source, /text\(files\[i\]\.PublishHdfsPath\)/);
  assert.match(source, /injectRuntimeContext\(htmlContent\.Data\)/);
  assert.match(source, /entryPath\s*=\s*latestPath/);
  assert.match(source, /previewHtml\s*=\s*injectRuntimeContext\(compilePreviewHtml\(files, app\.Data\)\)/);
  assert.match(source, /requestedAction\s*===\s*"RepairStableLatest"/);
  assert.match(source, /requestedAction\s*===\s*"PromoteStoreAssets"/);
  assert.match(source, /JSON\.parse\(text\(V8\.Param\.AssetsJson\)\)/);
  assert.match(source, /promoteStoreAssets\(app\.Data, promotedAppKey, promotedVersionNo, promotedAssets\)/);
  assert.match(source, /提升编译资产到固定路径失败/);
  assert.match(source, /存储错误=.*moveResult && moveResult\.Msg/);
  assert.match(source, /source\.fileByteBase64\s*\|\|\s*source\.FileByteBase64/);
  assert.match(source, /parseInt\(storagePayload\.Code\)\s*===\s*0/);
  assert.match(source, /优先以当前完整 dist\/build 目录为事实源/);
  assert.match(source, /if \(!isBlank\(repairBuildRoot\)\)/);
  assert.match(source, /repairHasEntry && repairVersionAssets\.length/);
  assert.match(source, /当前应用没有可修复的完整编译产物/);
});

test("UniApp runtime type takes ApplicationType over historical AppType", () => {
  const helpers = createUniAppShellHelpers();
  assert.equal(helpers.applicationTypeOf({ ApplicationType: "UniApp", AppType: "AI应用" }), "UniApp");
  assert.equal(helpers.isUniAppApplication({ ApplicationType: "UniApp", AppType: "Web" }), true);
  assert.equal(helpers.isUniAppApplication({ ApplicationType: "Web", AppType: "UniApp" }), false);
  assert.equal(helpers.applicationTypeOf({ AppType: "Official" }), "Web");
  assert.equal(helpers.applicationTypeOf({ AppType: "Community" }), "Web");
  assert.equal(helpers.applicationTypeOf({ AppType: "UniApp" }), "UniApp");
});

test("generated UniApp entry shows a phone shell on PC and removes it on mobile", () => {
  const helpers = createUniAppShellHelpers();
  const html = helpers.createUniAppPreviewShell("smart-business-card", "智能资讯名片", "v1.0.8");
  assert.match(html, /Microi UniApp H5 Preview/);
  assert.match(html, /data-microi-preview-shell="true"/);
  assert.match(html, /new URL\("\.\/app\.html",current\)/);
  assert.match(html, /\(pointer:coarse\) and \(max-width:1024px\)/);
  assert.match(html, /\.preview-status\{display:none\}/);
  assert.equal(helpers.hasUniAppPreviewShell(html), true);
  assert.equal(helpers.hasUniAppPreviewShell('<p>Microi UniApp H5 Preview 使用说明</p>'), false);
  assert.equal(helpers.hasUniAppPreviewShell('<main data-microi-preview-shell="true"></main>'), true);
});

test("all compiled and marketplace promotion paths wrap raw UniApp entries only", () => {
  assert.match(source, /function publishCompiledFiles\(files, buildRoot, app, appKey, versionNo\)/);
  assert.match(source, /isEntry && isUniAppApplication\(app\) && !hasUniAppPreviewShell\(publishedHtml\)/);
  assert.match(source, /isEntry && isUniAppApplication\(app\) && !hasUniAppPreviewShell\(html\)/);
  assert.match(source, /publishTextAsset\([^\n]+"app\.html"/);
  assert.match(source, /applicationTypeOf\(app\.Data\)\.toLowerCase\(\) === "microservice"/);
  assert.match(source, /UNIFIED_UNIAPP_PREVIEW_SHELL_V1/);
});

test("application-store package and server upgrade both carry the fixed builder", () => {
  const packaged = packageModel.SysApiEngines.find(item => item.ApiEngineKey === "ai_app_build");
  assert.ok(packaged);
  assert.equal(packaged.Version, "v1.6.4");
  assert.equal(packaged.ApiV8Code.replace(/\r\n/g, "\n"), source.replace(/\r\n/g, "\n"));
  assert.ok(
    compareSemver(packageModel.PackageInfo.Version, "v6.5.4") >= 0,
    `application-store package must be at least v6.5.4, got ${packageModel.PackageInfo.Version}`
  );
  assert.match(upgradeSource, /BuildAiAppResourceName\s*=\s*"ai-app-build\.js"/);
  assert.match(upgradeSource, /EnsureAiAppBuilderAsync\(osClient, msgs, resources\)/);
  assert.match(upgradeSource, /TENANT_RUNTIME_CONTEXT_V1/);
  assert.match(projectSource, /EmbeddedResource Include="Resource\\ai-app-build\.js"/);
});
