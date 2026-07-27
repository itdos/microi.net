import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("./ai-app-build.js", import.meta.url), "utf8");
const packageModel = JSON.parse(await readFile(new URL("./app.microi.store.json", import.meta.url), "utf8"));
const upgradeSource = await readFile(new URL("../13-UpgradeAppStore.cs", import.meta.url), "utf8");
const projectSource = await readFile(new URL("../Microi.Upgrade.csproj", import.meta.url), "utf8");

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
  assert.match(source, /var isEntry\s*=\s*relativePath\.toLowerCase\(\)\s*===\s*"index\.html"/);
  assert.match(source, /var isHtml\s*=\s*\/\\\.html\$\/i\.test\(relativePath\)/);
  assert.match(source, /var versionSegment\s*=.*"\/versions\/"/);
  assert.match(source, /var latestPublishRoot\s*=\s*"ai-app-publish\/"\s*\+\s*appKey/);
  assert.match(source, /StableFilePathName:\s*latestPath/);
  assert.match(source, /VersionEntryPath:\s*versionEntryPath/);
  assert.match(source, /for \(var pass = 0; pass < 2; pass\+\+\)/);
  assert.match(source, /publishCompiledFiles\(files, buildRoot, appKey, versionNo\)/);
  assert.doesNotMatch(source, /text\(files\[i\]\.PublishHdfsPath\)/);
  assert.match(source, /injectRuntimeContext\(htmlContent\.Data\)/);
  assert.match(source, /entryPath\s*=\s*latestPath/);
  assert.match(source, /previewHtml\s*=\s*injectRuntimeContext\(compilePreviewHtml\(files, app\.Data\)\)/);
  assert.match(source, /requestedAction\s*===\s*"RepairStableLatest"/);
  assert.match(source, /requestedAction\s*===\s*"PromoteStoreAssets"/);
  assert.match(source, /promoteStoreAssets\(app\.Data, promotedAppKey, promotedVersionNo, V8\.Param\.Assets\)/);
});

test("application-store package and server upgrade both carry the fixed builder", () => {
  const packaged = packageModel.SysApiEngines.find(item => item.ApiEngineKey === "ai_app_build");
  assert.ok(packaged);
  assert.equal(packaged.Version, "v1.3.7");
  assert.equal(packaged.ApiV8Code.replace(/\r\n/g, "\n"), source.replace(/\r\n/g, "\n"));
  assert.match(String(packageModel.PackageInfo.Version), /^v6\.5\.(?:[4-9]|\d{2,})$|^v6\.[6-9]\./);
  assert.match(upgradeSource, /BuildAiAppResourceName\s*=\s*"ai-app-build\.js"/);
  assert.match(upgradeSource, /EnsureAiAppBuilderAsync\(osClient, msgs, resources\)/);
  assert.match(upgradeSource, /TENANT_RUNTIME_CONTEXT_V1/);
  assert.match(projectSource, /EmbeddedResource Include="Resource\\ai-app-build\.js"/);
});
