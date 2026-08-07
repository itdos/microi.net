import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const packageModel = JSON.parse(await readFile(new URL("./app.microi.store.json", import.meta.url), "utf8"));
const standardSdk = (await readFile(new URL("../../../microi.skills/microi.v8.js", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const createEngines = packageModel.SysApiEngines.filter(item => item.ApiEngineKey === "ai_app_create");

assert.equal(createEngines.length, 1, "ai_app_create must exist exactly once");
const engine = createEngines[0];
const source = engine.ApiV8Code;

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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function generatedStarters() {
  const functionNames = [
    "sourceLines",
    "safeScriptJson",
    "vuePackageJson",
    "vueTsConfig",
    "vueViteConfig",
    "vueIndexHtml",
    "vueEnvDts",
    "vueMicroiSdk",
    "vueMicroiBridge",
    "vueMain",
    "vueAppFile",
    "vueStyle",
    "vueReadme",
    "vueStarterFiles",
    "microServiceStarterFiles",
    "webStarterFiles",
  ];
  const context = { JSON, Object, String };
  vm.runInNewContext(`
    function text(value, fallback) { return value === null || value === undefined ? (fallback || "") : String(value); }
    ${functionNames.map(extractFunction).join("\n")}
    result = {
      web: webStarterFiles("合同测试 Web", "Web 描述</script><script>alert(1)</script>"),
      microService: microServiceStarterFiles("合同测试微服务", "微服务描述")
    };
  `, context);
  return JSON.parse(JSON.stringify(context.result));
}

function fileMap(files) {
  return new Map(files.map(file => [file.FilePath, file.Content]));
}

function assertStableVueBaseline(files, applicationType) {
  const map = fileMap(files);
  const packageJson = JSON.parse(map.get("package.json"));
  const tsconfig = JSON.parse(map.get("tsconfig.json"));

  assert.deepEqual(packageJson.engines, { node: "^20.19.0 || >=22.12.0" });
  assert.deepEqual(packageJson.dependencies, { vue: "3.5.40" });
  assert.deepEqual(packageJson.devDependencies, {
    "@vitejs/plugin-vue": "6.0.8",
    typescript: "5.9.3",
    vite: "7.3.6",
    "vue-tsc": "3.3.9",
  });
  assert.deepEqual(packageJson.scripts, {
    dev: "vite",
    typecheck: "vue-tsc --noEmit",
    build: "vue-tsc --noEmit && vite build",
    preview: "vite preview",
  });
  assert.equal(tsconfig.compilerOptions.strict, true);
  assert.equal(tsconfig.compilerOptions.moduleResolution, "Bundler");
  assert.equal(tsconfig.compilerOptions.noEmit, true);
  assert.equal(tsconfig.compilerOptions.allowJs, true);

  assert.match(map.get("vite.config.ts"), /base:\s*['"]\.\/['"]/);
  assert.match(map.get("vite.config.ts"), /plugins:\s*\[vue\(\)\]/);
  assert.match(map.get("index.html"), /src="\/src\/main\.ts"/);
  assert.doesNotMatch(map.get("index.html"), /main\.js/);
  assert.match(map.get("src/App.vue"), /<script setup lang="ts">/);
  assert.match(map.get("src/App.vue"), /ref\(/);
  assert.match(map.get("src/App.vue"), new RegExp(`const applicationType = ["']${applicationType}["']`));
  assert.match(map.get("src/main.ts"), /createApp\(App\)/);
  assert.match(map.get("src/main.ts"), /configureMicroiV8\(context\)/);
  assert.match(map.get("src/platform/microi.ts"), /createMicroiV8/);
  assert.match(map.get("src/platform/microi.ts"), /export const microiV8 = createMicroiV8\(\)/);
  assert.match(map.get("src/platform/microi.ts"), /microiV8\.ApiEngine\.Run\(/);
  assert.match(map.get("src/platform/microi.ts"), /window\.__MICROI_APP_CONTEXT__/);
  assert.match(map.get("src/platform/microi.ts"), /window\.microApp\?\.getData/);
  assert.equal(map.get("src/utils/microi.v8.js"), standardSdk, "starter must embed the maintained Microi SDK");

  const businessSource = files
    .filter(file => file.FilePath !== "src/utils/microi.v8.js")
    .map(file => String(file.Content))
    .join("\n");
  assert.doesNotMatch(businessSource, /\/api\/ApiEngine\/Run/i);
  assert.doesNotMatch(businessSource, /fetch\s*\(/);
  assert.doesNotMatch(businessSource, /assets\/app\.js/);
  assert.doesNotMatch(businessSource, /src\/main\.js/);
}

test("ai_app_create keeps one versioned and syntactically valid engine", () => {
  assert.ok(compareSemver(engine.Version, "v1.1.5") >= 0);
  assert.match(engine.ChangeHistory, new RegExp(`^\\d{4}-\\d{2}-\\d{2}(?: \\d{2}:\\d{2}:\\d{2})? ${escapeRegExp(engine.Version)} `));
  assert.match(source, /ApiEngineKey: ai_app_create/);
  assert.match(source, new RegExp(`Version: ${escapeRegExp(engine.Version)}`));
  assert.doesNotThrow(() => new Function(source));
});

test("Web starter is a Vue 3, Vite, and strict TypeScript application", () => {
  const { web } = generatedStarters();
  assert.deepEqual(web.map(file => file.FilePath), [
    "package.json",
    "tsconfig.json",
    "vite.config.ts",
    "index.html",
    "src/env.d.ts",
    "src/main.ts",
    "src/App.vue",
    "src/style.css",
    "src/platform/microi.ts",
    "src/utils/microi.v8.js",
    "README.md",
  ]);
  assertStableVueBaseline(web, "Web");
  assert.doesNotMatch(fileMap(web).get("src/App.vue"), /<script>alert\(1\)<\/script>/);
  assert.match(fileMap(web).get("src/App.vue"), /\\u003c\/script>/);
});

test("MicroService starter shares the stable baseline and keeps its route manifest", () => {
  const { microService } = generatedStarters();
  assert.deepEqual(microService.map(file => file.FilePath), [
    "package.json",
    "tsconfig.json",
    "vite.config.ts",
    "index.html",
    "microi.routes.json",
    "src/env.d.ts",
    "src/main.ts",
    "src/App.vue",
    "src/style.css",
    "src/platform/microi.ts",
    "src/utils/microi.v8.js",
    "README.md",
  ]);
  assert.deepEqual(JSON.parse(fileMap(microService).get("microi.routes.json")), [
    { path: "/", name: "home", title: "首页", sort: 0, isHome: true },
  ]);
  assertStableVueBaseline(microService, "MicroService");
});
