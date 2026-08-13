import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const publisherSource = await readFile(new URL("./ai-app-publish-store.js", import.meta.url), "utf8");
const packageModel = JSON.parse(await readFile(new URL("./app.microi.store.json", import.meta.url), "utf8"));
const upgradeSource = await readFile(new URL("../13-UpgradeAppStore.cs", import.meta.url), "utf8");

const engineCode = key => {
  const engine = packageModel.SysApiEngines.find(item => item.ApiEngineKey === key);
  assert.ok(engine, `missing ${key}`);
  return engine.ApiV8Code;
};

function extractFunction(source, name) {
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

function createPathClassifier(source, name) {
  const context = { String };
  vm.runInNewContext(`
    function text(value, fallback) { return value === null || value === undefined ? (fallback || '') : String(value); }
    function isBlank(value) { return text(value).trim() === ''; }
    function normalizePath(value) {
      return text(value).replace(/\\\\/g, '/').replace(/^\\/+|\\/+$/g, '');
    }
    ${name === "sourceArchivePath" ? extractFunction(source, "buildArchivePath") : ""}
    ${extractFunction(source, name)}
    result = ${name};
  `, context);
  return context.result;
}

test("publisher classifies stored source and compiled roots without leaking wrapper directories", () => {
  const sourceArchivePath = createPathClassifier(publisherSource, "sourceArchivePath");
  const buildArchivePath = createPathClassifier(publisherSource, "buildArchivePath");

  assert.equal(sourceArchivePath("source/App.vue"), "App.vue");
  assert.equal(sourceArchivePath("source/pages/home.vue"), "pages/home.vue");
  assert.equal(sourceArchivePath("App.vue"), "App.vue", "legacy unprefixed source remains supported");
  assert.equal(sourceArchivePath("build/index.html"), "");
  assert.equal(sourceArchivePath("dist/static/app.js"), "");
  assert.equal(sourceArchivePath("unpackage/dist/build/h5/index.html"), "");

  assert.equal(buildArchivePath("build/index.html"), "index.html");
  assert.equal(buildArchivePath("dist/static/app.js"), "static/app.js");
  assert.equal(buildArchivePath("unpackage/dist/build/h5/static/app.css"), "static/app.css");
  assert.equal(buildArchivePath("source/App.vue"), "");
});

test("embedded publisher is the canonical fixed publisher", () => {
  const packagedPublisher = engineCode("ai_app_publish_store");
  assert.equal(packagedPublisher.replace(/\r\n/g, "\n"), publisherSource.replace(/\r\n/g, "\n"));
  assert.match(publisherSource, /SOURCE_BUILD_ARCHIVE_ROOTS_V1/);
  assert.match(publisherSource, /sourceArchivePath\(storedSource\.FilePath/);
  assert.match(publisherSource, /buildArchivePath\(compiledFile\.FilePath/);
  assert.match(
    publisherSource,
    /var html = latestVersion \? text\(latestVersion\.BuildLog\) : '';\s*if \(!assets\.length && !isBlank\(html\)\)/,
    "legacy BuildLog must only be used after real runtime and compiled assets are both absent"
  );
});

test("source ZIP contains only root-level compilable source and preserves binary files", () => {
  const sourceZip = engineCode("ai_app_download_source_zip");
  const sourceArchivePath = createPathClassifier(sourceZip, "sourceArchivePath");
  assert.equal(sourceArchivePath("source/pages/index.vue"), "pages/index.vue");
  assert.equal(sourceArchivePath("build/index.html"), "");
  assert.match(sourceZip, /FileByteBase64:\s*readFileBase64\(file\)/);
  assert.doesNotMatch(sourceZip, /README\.microi\.txt/);
  assert.doesNotMatch(sourceZip, /Path:\s*path,\s*Content:\s*readText/);
});

test("build ZIP reads every real compiled file and strips only its build root", () => {
  const buildZip = engineCode("ai_app_download_build_zip");
  const buildArchivePath = createPathClassifier(buildZip, "buildArchivePath");
  assert.equal(buildArchivePath("build/index.html"), "index.html");
  assert.equal(buildArchivePath("build/static/js/app.js"), "static/js/app.js");
  assert.equal(buildArchivePath("source/index.html"), "");
  assert.match(buildZip, /getFiles\(appId\)/);
  assert.match(buildZip, /entries\.push\(\{\s*Path:\s*buildPath,\s*FileByteBase64:\s*readAssetBase64\(compiledFile\)/);
  assert.doesNotMatch(buildZip, /else\s*\{\s*var html = text\(version && version\.BuildLog\)/);
});

test("upgrade rejects stale publisher and stale source/build ZIP engines", () => {
  assert.match(upgradeSource, /publisherVersion\s*<\s*new System\.Version\(1, 7, 7\)/);
  assert.match(upgradeSource, /SOURCE_BUILD_ARCHIVE_ROOTS_V1/);
  assert.match(upgradeSource, /ai_app_download_build_zip[\s\S]*?REAL_BUILD_ZIP_ASSETS_V1/);
  assert.match(upgradeSource, /ai_app_download_source_zip[\s\S]*?SOURCE_ONLY_ZIP_ROOT_V1/);
});
