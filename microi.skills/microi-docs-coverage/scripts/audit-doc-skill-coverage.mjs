#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..", "..");
const docRoot = path.join(repoRoot, "microi.doc", "docs", "doc");
const skillRoot = path.join(repoRoot, "microi.skills");
const skillReadmePath = path.join(skillRoot, "README.md");
const mapPath = path.join(
  skillRoot,
  "microi-docs-coverage",
  "references",
  "capability-map.md",
);
const componentSourcePath = path.join(
  repoRoot,
  "Microi.Client",
  "src",
  "views",
  "form-engine",
  "diy-field-component",
  "diy-component-list.json",
);
const componentReferencePath = path.join(
  skillRoot,
  "microi-form-engine",
  "references",
  "component-catalog.md",
);
const bluetoothOfficialDocPath = path.join(
  docRoot,
  "v8-engine",
  "v8-client.md",
);
const bluetoothAdapterPath = path.join(
  repoRoot,
  "Microi.Client",
  "src",
  "utils",
  "v8-print.js",
);
const bluetoothEditorDefinitionPath = path.join(
  repoRoot,
  "Microi.Client",
  "src",
  "views",
  "form-engine",
  "diy-components",
  "v8-api-definitions.js",
);
const bluetoothTscPath = path.join(
  repoRoot,
  "Microi.Client",
  "src",
  "utils",
  "ble",
  "tsc.js",
);
const bluetoothEscPath = path.join(
  repoRoot,
  "Microi.Client",
  "src",
  "utils",
  "ble",
  "esc.js",
);
const bluetoothReferencePaths = [
  path.join(
    skillRoot,
    "v8-frontend-events",
    "references",
    "bluetooth-print.md",
  ),
  path.join(
    skillRoot,
    "v8-frontend-events",
    "references",
    "bluetooth-print-api.md",
  ),
];
const bluetoothMountPaths = [
  path.join(repoRoot, "Microi.Client", "src", "utils", "diy.common.js"),
  path.join(
    repoRoot,
    "Microi.Client",
    "src",
    "views",
    "form-engine",
    "diy-form.vue",
  ),
  path.join(
    repoRoot,
    "Microi.Client",
    "src",
    "views",
    "form-engine",
    "diy-table.vue",
  ),
];
const defaultReportDir = path.join(repoRoot, ".tmp", "reports");
const excludedDocs = new Set(["about/update-log.md"]);

const v8TokenPattern =
  /(?<![A-Za-z0-9_$])V8(?:(?:\?\.|\.)[A-Za-z_$][A-Za-z0-9_$]*)+/g;
const namedApiPattern =
  /(?<![A-Za-z0-9_$])(?:(?:AutoNumber|Button|CodeEditor|DataUtils|DbSession|Divider|Entity|EventBus|EventReplace|FromSection|ImgUpload|JsonTable|NavigateType|OpenTable|ShardingRouter|SqlFunc|SqlSubQuery|StaticText|System|TableChild|TagInput|Textarea|Transfer|DiyCommon|V8Engine|V8ExtensionRegistry)(?:(?:\?\.|\.)[A-Za-z_$][A-Za-z0-9_$]*)+|Microi(?:\.DataSourceEngine\.Run|\.CheckResult))/g;
const mcpToolPattern =
  /(?<![@A-Za-z0-9_])microi_(?:codex|(?:create|drop|execute|generate|get|import|inspect|list|plan|publish|query|redis|run|save|scaffold|sync|update|upload|validate)_[a-z0-9_]+)/g;
const httpRoutePattern =
  /(?<![A-Za-z0-9_])\/(?:api|apiengine)\/[A-Za-z0-9_{}.$~:/?=+&%\-]*/gi;
const globalFunctionPattern =
  /\b(?:DateNow|DateFormat|DateAdd|setTimeout)\s*\(|\bconsole\.log\s*\(/g;
const mapRowPattern = /^\|\s*`([^`]+\.md)`\s*\|\s*([^|]+?)\s*\|/;
const dynamicBases = new Set([
  "V8.CacheData",
  "V8.ClientModel",
  "V8.CurrentRow",
  "V8.CurrentUser",
  "V8.Field",
  "V8.Form",
  "V8.Header",
  "V8.OldForm",
  "V8.OsClientModel",
  "V8.Param",
  "V8.Result",
  "V8.Row",
  "V8.ScanCodeRes",
  "V8.SysConfig",
  "V8.TableModel",
]);

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function walk(root, predicate) {
  const result = [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await walk(target, predicate)));
    } else if (predicate(target)) {
      result.push(target);
    }
  }
  return result;
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function parseReportDir() {
  const index = process.argv.indexOf("--report-dir");
  if (index === -1) return defaultReportDir;
  if (!process.argv[index + 1]) {
    throw new Error("--report-dir requires a path");
  }
  return path.resolve(process.argv[index + 1]);
}

async function readText(target) {
  return (await fs.readFile(target, "utf8")).replace(/^\uFEFF/, "");
}

async function collectDocs() {
  const files = await walk(docRoot, (target) => target.endsWith(".md"));
  const docs = new Map();
  for (const file of files) {
    const relative = toPosix(path.relative(docRoot, file));
    if (!excludedDocs.has(relative)) docs.set(relative, file);
  }
  return docs;
}

async function collectSkillNames() {
  const entries = await fs.readdir(skillRoot, { withFileTypes: true });
  const names = new Set();
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(skillRoot, entry.name, "SKILL.md");
    if (await exists(skillFile)) names.add(entry.name);
  }
  return names;
}

async function collectReadmeSkillNames() {
  const names = new Set();
  const pattern = /`([^`/\\]+)[/\\]SKILL\.md`/g;
  for (const match of (await readText(skillReadmePath)).matchAll(pattern)) {
    names.add(match[1]);
  }
  return names;
}

async function parseCapabilityMap() {
  const mapped = new Map();
  for (const line of (await readText(mapPath)).split(/\r?\n/)) {
    const match = line.match(mapRowPattern);
    if (!match) continue;
    const docPath = match[1].replaceAll("\\", "/");
    const owners = match[2]
      .split(",")
      .map((owner) => owner.trim().replaceAll("`", ""))
      .filter(Boolean);
    mapped.set(docPath, owners);
  }
  return mapped;
}

function normalizeV8Token(rawToken) {
  const token = rawToken.replaceAll("?.", ".");
  for (const base of [...dynamicBases].sort((a, b) => b.length - a.length)) {
    if (token.startsWith(`${base}.`)) {
      return {
        token: base,
        reason: `${token} -> ${base} (dynamic data property)`,
      };
    }
  }
  if (token.startsWith("V8.Print.BLEInformation.")) {
    return {
      token: "V8.Print.BLEInformation",
      reason:
        `${token} -> V8.Print.BLEInformation ` +
        "(diagnostic data property)",
    };
  }
  if (token.startsWith("V8.Dbs.") && token !== "V8.Dbs.Open") {
    return {
      token: "V8.Dbs",
      reason: `${token} -> V8.Dbs (dynamic extension database)`,
    };
  }
  return { token, reason: null };
}

async function extractTokens(files) {
  const tokens = new Set();
  const normalizedExamples = new Map();
  for (const file of files) {
    const matches = (await readText(file)).match(v8TokenPattern) ?? [];
    for (const rawToken of matches) {
      const normalized = normalizeV8Token(rawToken);
      tokens.add(normalized.token);
      if (!normalized.reason) continue;
      if (!normalizedExamples.has(normalized.token)) {
        normalizedExamples.set(normalized.token, new Set());
      }
      normalizedExamples.get(normalized.token).add(normalized.reason);
    }
  }
  return { tokens, normalizedExamples };
}

function normalizeNamedApi(rawToken) {
  const token = rawToken.replaceAll("?.", ".");
  if (/\.(?:cs|js|ts|vue)$/i.test(token)) {
    return {
      token: null,
      reason: `${token} (source filename, not callable API)`,
    };
  }
  return { token, reason: null };
}

async function extractNamedApis(files) {
  const names = new Set();
  const ignoredExamples = new Set();
  for (const file of files) {
    const matches = (await readText(file)).match(namedApiPattern) ?? [];
    for (const rawToken of matches) {
      const normalized = normalizeNamedApi(rawToken);
      if (normalized.token) {
        names.add(normalized.token);
      } else if (normalized.reason) {
        ignoredExamples.add(normalized.reason);
      }
    }
  }
  return { names, ignoredExamples };
}

async function extractMcpTools(files) {
  const names = new Set();
  for (const file of files) {
    const matches = (await readText(file)).match(mcpToolPattern) ?? [];
    for (const match of matches) names.add(match);
  }
  return names;
}

function normalizeHttpRoute(rawRoute) {
  const cleaned = rawRoute.replace(/[.,;:)\]]+$/g, "");
  const pathOnly = cleaned.split("?")[0];
  const lower = pathOnly.toLowerCase();

  if (lower.startsWith("/apiengine/")) {
    if (lower.includes("--osclient--")) {
      return {
        route: "/apiengine/{apienginekey}--osclient--{osclient}--",
        reason:
          `${cleaned} -> ` +
          "/apiengine/{ApiEngineKey}--OsClient--{OsClient}--",
      };
    }
    return {
      route: "/apiengine/{apienginekey}",
      reason: `${cleaned} -> /apiengine/{ApiEngineKey}`,
    };
  }

  if (lower === "/api/example" || lower.startsWith("/api/example/")) {
    return {
      route: "/api/{controller}/{action}",
      reason: `${cleaned} -> /api/{Controller}/{Action} (generic example)`,
    };
  }

  const formPrefix = "/api/formengine/";
  if (lower.startsWith(formPrefix)) {
    const segment = lower.slice(formPrefix.length);
    const compact = segment.replaceAll("-", "");
    const operations = [
      "gettabledataanonymous",
      "getformdataanonymous",
      "addformdataanonymous",
      "uptformdatabywhere",
      "delformdatabywhere",
      "gettabledata",
      "getformdata",
      "addformdata",
      "uptformdata",
      "delformdata",
    ];
    for (const operation of operations) {
      if (compact === operation) {
        return { route: `${formPrefix}${operation}`, reason: null };
      }
      if (compact.startsWith(operation)) {
        return {
          route: `${formPrefix}${operation}-{formenginekey}`,
          reason:
            `${cleaned} -> ` +
            `/api/formengine/${operation}-{FormEngineKey}`,
        };
      }
    }
  }

  return { route: lower, reason: null };
}

async function extractRoutes(files) {
  const routes = new Set();
  const normalizedExamples = new Map();
  for (const file of files) {
    const matches = (await readText(file)).match(httpRoutePattern) ?? [];
    for (const rawRoute of matches) {
      const normalized = normalizeHttpRoute(rawRoute);
      routes.add(normalized.route);
      if (!normalized.reason) continue;
      if (!normalizedExamples.has(normalized.route)) {
        normalizedExamples.set(normalized.route, new Set());
      }
      normalizedExamples.get(normalized.route).add(normalized.reason);
    }
  }
  return { routes, normalizedExamples };
}

async function extractGlobalFunctions(files) {
  const functions = new Set();
  for (const file of files) {
    const matches = (await readText(file)).match(globalFunctionPattern) ?? [];
    for (const match of matches) {
      functions.add(match.replace(/\s*\($/, ""));
    }
  }
  return functions;
}

async function inspectComponents() {
  const source = JSON.parse(await readText(componentSourcePath));
  const reference = await readText(componentReferencePath);
  const controls = source
    .map((item) => item.Control)
    .filter((control) => typeof control === "string" && control);
  const missing = controls.filter(
    (control) => !reference.includes(`\`${control}\``),
  );
  return { controls: new Set(controls), missing: sorted(new Set(missing)) };
}

function extractBuilderMethods(source) {
  return new Set(
    [...source.matchAll(/jpPrinter\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*function\s*\(/g)]
      .map((match) => match[1]),
  );
}

function extractPrintMembers(source) {
  const startMatch = /\b(?:var|let|const)\s+Print\s*=\s*\{/.exec(source);
  const start = startMatch ? startMatch.index : -1;
  const end = source.indexOf("\n    return Print;", start);
  if (start === -1 || end === -1) return new Set();

  const block = source.slice(start, end);
  const members = new Set(
    [...block.matchAll(
      /^\s{8}([A-Za-z_$][A-Za-z0-9_$]*):\s*(?:async\s+)?function\s*\(/gm,
    )].map((match) => match[1]),
  );
  for (const match of block.matchAll(
    /^\s{8}(createNew(?:ESC)?):\s*[A-Za-z_$][A-Za-z0-9_$.]*,/gm,
  )) {
    members.add(match[1]);
  }
  for (const internalName of ["setTipHandler", "initializeConnection"]) {
    members.delete(internalName);
  }
  for (const name of [...members]) {
    if (name.startsWith("_")) members.delete(name);
  }
  if (/^\s{8}BLEInformation:\s*/m.test(block)) {
    members.add("BLEInformation");
  }
  return members;
}

function findUndocumentedNames(names, text) {
  return sorted([...names].filter((name) => !text.includes(name)));
}

async function inspectBluetoothPrint() {
  const [
    adapter,
    tsc,
    esc,
    officialDoc,
    editorDefinitions,
    ...references
  ] = await Promise.all([
    readText(bluetoothAdapterPath),
    readText(bluetoothTscPath),
    readText(bluetoothEscPath),
    readText(bluetoothOfficialDocPath),
    readText(bluetoothEditorDefinitionPath),
    ...bluetoothReferencePaths.map((target) => readText(target)),
  ]);
  const skillReference = references.join("\n");
  const printMembers = extractPrintMembers(adapter);
  const tscMethods = extractBuilderMethods(tsc);
  const escMethods = extractBuilderMethods(esc);
  const mountCallsMissing = [];
  const mountsMissingFromOfficialDoc = [];
  const mountsMissingFromSkill = [];

  for (const mountPath of bluetoothMountPaths) {
    const source = await readText(mountPath);
    const relative = toPosix(path.relative(repoRoot, mountPath));
    if (
      !source.includes("initV8Print") ||
      !/initV8Print\s*\(/.test(source)
    ) {
      mountCallsMissing.push(relative);
    }
    if (!officialDoc.includes(relative)) {
      mountsMissingFromOfficialDoc.push(relative);
    }
    if (!skillReference.includes(relative.replace("Microi.Client/", ""))) {
      mountsMissingFromSkill.push(relative);
    }
  }

  return {
    printMembers,
    tscMethods,
    escMethods,
    printMissingFromOfficialDoc: findUndocumentedNames(
      printMembers,
      officialDoc,
    ),
    printMissingFromEditorDefinitions: findUndocumentedNames(
      printMembers,
      editorDefinitions,
    ),
    printMissingFromSkill: findUndocumentedNames(printMembers, skillReference),
    tscMissingFromOfficialDoc: findUndocumentedNames(tscMethods, officialDoc),
    tscMissingFromEditorDefinitions: findUndocumentedNames(
      tscMethods,
      editorDefinitions,
    ),
    tscMissingFromSkill: findUndocumentedNames(tscMethods, skillReference),
    escMissingFromOfficialDoc: findUndocumentedNames(escMethods, officialDoc),
    escMissingFromEditorDefinitions: findUndocumentedNames(
      escMethods,
      editorDefinitions,
    ),
    escMissingFromSkill: findUndocumentedNames(escMethods, skillReference),
    mountCallsMissing: sorted(mountCallsMissing),
    mountsMissingFromOfficialDoc: sorted(mountsMissingFromOfficialDoc),
    mountsMissingFromSkill: sorted(mountsMissingFromSkill),
  };
}

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function renderList(items, empty = "无") {
  return items.length ? items.map((item) => `- \`${item}\``) : [`- ${empty}`];
}

function buildReport({
  docs,
  mapped,
  skills,
  readmeSkills,
  docTokens,
  skillTokens,
  normalizedExamples,
  docNamedApis,
  skillNamedApis,
  ignoredNamedApiExamples,
  docMcpTools,
  skillMcpTools,
  docRoutes,
  skillRoutes,
  normalizedRoutes,
  docGlobalFunctions,
  skillGlobalFunctions,
  componentControls,
  missingComponents,
  bluetooth,
}) {
  const unmapped = sorted([...docs.keys()].filter((key) => !mapped.has(key)));
  const stale = sorted([...mapped.keys()].filter((key) => !docs.has(key)));
  const unknownOwners = [];
  const ownerless = [];
  for (const [doc, owners] of mapped) {
    if (!owners.length) ownerless.push(doc);
    for (const owner of owners) {
      if (!skills.has(owner)) unknownOwners.push(`${doc}: ${owner}`);
    }
  }
  unknownOwners.sort((a, b) => a.localeCompare(b));
  ownerless.sort((a, b) => a.localeCompare(b));
  const uncovered = sorted(
    [...docTokens].filter((token) => !skillTokens.has(token)),
  );
  const uncoveredNamedApis = sorted(
    [...docNamedApis].filter((name) => !skillNamedApis.has(name)),
  );
  const uncoveredMcpTools = sorted(
    [...docMcpTools].filter((name) => !skillMcpTools.has(name)),
  );
  const uncoveredRoutes = sorted(
    [...docRoutes].filter((route) => !skillRoutes.has(route)),
  );
  const uncoveredGlobalFunctions = sorted(
    [...docGlobalFunctions].filter(
      (functionName) => !skillGlobalFunctions.has(functionName),
    ),
  );
  const skillsMissingFromReadme = sorted(
    [...skills].filter((skill) => !readmeSkills.has(skill)),
  );
  const staleReadmeSkills = sorted(
    [...readmeSkills].filter((skill) => !skills.has(skill)),
  );
  const bluetoothIssues = [
    ...bluetooth.printMissingFromOfficialDoc.map(
      (name) => `official doc missing V8.Print.${name}`,
    ),
    ...bluetooth.printMissingFromSkill.map(
      (name) => `Skill missing V8.Print.${name}`,
    ),
    ...bluetooth.printMissingFromEditorDefinitions.map(
      (name) => `editor definitions missing V8.Print.${name}`,
    ),
    ...bluetooth.tscMissingFromOfficialDoc.map(
      (name) => `official doc missing TSC.${name}`,
    ),
    ...bluetooth.tscMissingFromSkill.map(
      (name) => `Skill missing TSC.${name}`,
    ),
    ...bluetooth.tscMissingFromEditorDefinitions.map(
      (name) => `editor definitions missing TSC.${name}`,
    ),
    ...bluetooth.escMissingFromOfficialDoc.map(
      (name) => `official doc missing ESC.${name}`,
    ),
    ...bluetooth.escMissingFromSkill.map(
      (name) => `Skill missing ESC.${name}`,
    ),
    ...bluetooth.escMissingFromEditorDefinitions.map(
      (name) => `editor definitions missing ESC.${name}`,
    ),
    ...bluetooth.mountCallsMissing.map(
      (name) => `source mount missing initV8Print: ${name}`,
    ),
    ...bluetooth.mountsMissingFromOfficialDoc.map(
      (name) => `official doc missing mount: ${name}`,
    ),
    ...bluetooth.mountsMissingFromSkill.map(
      (name) => `Skill missing mount: ${name}`,
    ),
  ];
  const ok =
    !unmapped.length &&
    !stale.length &&
    !unknownOwners.length &&
    !ownerless.length &&
    !uncovered.length &&
    !uncoveredNamedApis.length &&
    !uncoveredMcpTools.length &&
    !uncoveredRoutes.length &&
    !uncoveredGlobalFunctions.length &&
    !missingComponents.length &&
    !bluetoothIssues.length &&
    !skillsMissingFromReadme.length &&
    !staleReadmeSkills.length;

  const generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "# Microi 中文文档与 Skills 覆盖审计",
    "",
    `- 生成时间：\`${generatedAt}\``,
    `- 中文文档：\`${docs.size}\`（已排除更新日志与英文站）`,
    `- Skills：\`${skills.size}\``,
    `- 文档标准化 V8 名称：\`${docTokens.size}\``,
    `- 文档其它具名 API：\`${docNamedApis.size}\``,
    `- 文档 MCP 工具名：\`${docMcpTools.size}\``,
    `- 文档标准化 HTTP 路由：\`${docRoutes.size}\``,
    `- 文档平台全局函数：\`${docGlobalFunctions.size}\``,
    `- 当前表单组件：\`${componentControls.size}\``,
    `- 蓝牙打印公开入口：\`${bluetooth.printMembers.size}\``,
    `- TSC 构建器方法：\`${bluetooth.tscMethods.size}\``,
    `- ESC/POS 构建器方法：\`${bluetooth.escMethods.size}\``,
    `- Skill 标准化 V8 名称：\`${skillTokens.size}\``,
    `- 结论：**${ok ? "PASS" : "FAIL"}**`,
    "",
    "## 未映射中文文档",
    "",
    ...renderList(unmapped),
    "",
    "## 映射中已不存在的中文文档",
    "",
    ...renderList(stale),
    "",
    "## 不存在或缺失的责任 Skill",
    "",
    ...renderList([...unknownOwners, ...ownerless]),
    "",
    "## Skills 总目录漏项或失效项",
    "",
    ...renderList([
      ...skillsMissingFromReadme.map((skill) => `missing: ${skill}`),
      ...staleReadmeSkills.map((skill) => `stale: ${skill}`),
    ]),
    "",
    "## 文档出现但 Skills 未覆盖的 V8 名称",
    "",
    ...renderList(uncovered),
    "",
    "## 文档出现但 Skills 未覆盖的其它具名 API",
    "",
    ...renderList(uncoveredNamedApis),
    "",
    "## 文档出现但 Skills 未覆盖的 MCP 工具名",
    "",
    ...renderList(uncoveredMcpTools),
    "",
    "## 文档出现但 Skills 未覆盖的平台 HTTP 路由",
    "",
    ...renderList(uncoveredRoutes),
    "",
    "## 文档出现但 Skills 未覆盖的平台全局函数",
    "",
    ...renderList(uncoveredGlobalFunctions),
    "",
    "## 当前组件清单未进入表单 Skill 的控件",
    "",
    ...renderList(missingComponents),
    "",
    "## 蓝牙打印源码、官方文档与 Skills 未对齐项",
    "",
    ...renderList(bluetoothIssues),
    "",
    "## 已排除的源码文件名",
    "",
    ...renderList(sorted(ignoredNamedApiExamples)),
    "",
    "## 已归一的动态示例",
    "",
  ];

  if (normalizedExamples.size) {
    for (const key of sorted(normalizedExamples.keys())) {
      lines.push(`### \`${key}\``, "");
      for (const reason of sorted(normalizedExamples.get(key))) {
        lines.push(`- \`${reason}\``);
      }
      lines.push("");
    }
  } else {
    lines.push("- 无", "");
  }

  lines.push("## 已归一的 HTTP 路由示例", "");
  if (normalizedRoutes.size) {
    for (const key of sorted(normalizedRoutes.keys())) {
      lines.push(`### \`${key}\``, "");
      for (const reason of sorted(normalizedRoutes.get(key))) {
        lines.push(`- \`${reason}\``);
      }
      lines.push("");
    }
  } else {
    lines.push("- 无", "");
  }

  const normalizedPayload = {};
  for (const key of sorted(normalizedExamples.keys())) {
    normalizedPayload[key] = sorted(normalizedExamples.get(key));
  }
  const normalizedRoutePayload = {};
  for (const key of sorted(normalizedRoutes.keys())) {
    normalizedRoutePayload[key] = sorted(normalizedRoutes.get(key));
  }
  return {
    ok,
    markdown: `${lines.join("\n").trimEnd()}\n`,
    payload: {
      generatedAt,
      ok,
      counts: {
        docs: docs.size,
        skills: skills.size,
        docV8Tokens: docTokens.size,
        skillV8Tokens: skillTokens.size,
        docNamedApis: docNamedApis.size,
        skillNamedApis: skillNamedApis.size,
        docMcpTools: docMcpTools.size,
        skillMcpTools: skillMcpTools.size,
        docHttpRoutes: docRoutes.size,
        skillHttpRoutes: skillRoutes.size,
        docGlobalFunctions: docGlobalFunctions.size,
        skillGlobalFunctions: skillGlobalFunctions.size,
        componentControls: componentControls.size,
        bluetoothPrintMembers: bluetooth.printMembers.size,
        bluetoothTscMethods: bluetooth.tscMethods.size,
        bluetoothEscMethods: bluetooth.escMethods.size,
      },
      unmappedDocs: unmapped,
      staleMappedDocs: stale,
      unknownOwners,
      ownerlessDocs: ownerless,
      skillsMissingFromReadme,
      staleReadmeSkills,
      uncoveredV8Tokens: uncovered,
      uncoveredNamedApis,
      uncoveredMcpTools,
      uncoveredHttpRoutes: uncoveredRoutes,
      uncoveredGlobalFunctions,
      missingComponents,
      bluetoothIssues,
      bluetooth: {
        printMembers: sorted(bluetooth.printMembers),
        tscMethods: sorted(bluetooth.tscMethods),
        escMethods: sorted(bluetooth.escMethods),
        printMissingFromOfficialDoc: bluetooth.printMissingFromOfficialDoc,
        printMissingFromEditorDefinitions:
          bluetooth.printMissingFromEditorDefinitions,
        printMissingFromSkill: bluetooth.printMissingFromSkill,
        tscMissingFromOfficialDoc: bluetooth.tscMissingFromOfficialDoc,
        tscMissingFromEditorDefinitions:
          bluetooth.tscMissingFromEditorDefinitions,
        tscMissingFromSkill: bluetooth.tscMissingFromSkill,
        escMissingFromOfficialDoc: bluetooth.escMissingFromOfficialDoc,
        escMissingFromEditorDefinitions:
          bluetooth.escMissingFromEditorDefinitions,
        escMissingFromSkill: bluetooth.escMissingFromSkill,
        mountCallsMissing: bluetooth.mountCallsMissing,
        mountsMissingFromOfficialDoc: bluetooth.mountsMissingFromOfficialDoc,
        mountsMissingFromSkill: bluetooth.mountsMissingFromSkill,
      },
      ignoredNamedApiExamples: sorted(ignoredNamedApiExamples),
      normalizedExamples: normalizedPayload,
      normalizedRoutes: normalizedRoutePayload,
    },
  };
}

async function main() {
  if (
    !(await exists(docRoot)) ||
    !(await exists(skillRoot)) ||
    !(await exists(skillReadmePath)) ||
    !(await exists(mapPath)) ||
    !(await exists(componentSourcePath)) ||
    !(await exists(componentReferencePath)) ||
    !(await exists(bluetoothOfficialDocPath)) ||
    !(await exists(bluetoothAdapterPath)) ||
    !(await exists(bluetoothEditorDefinitionPath)) ||
    !(await exists(bluetoothTscPath)) ||
    !(await exists(bluetoothEscPath)) ||
    !(
      await Promise.all(bluetoothReferencePaths.map((target) => exists(target)))
    ).every(Boolean) ||
    !(
      await Promise.all(bluetoothMountPaths.map((target) => exists(target)))
    ).every(Boolean)
  ) {
    throw new Error(
      "Microi docs, skills, capability map, or component catalog is missing",
    );
  }
  const reportDir = parseReportDir();
  const docs = await collectDocs();
  const skills = await collectSkillNames();
  const readmeSkills = await collectReadmeSkillNames();
  const mapped = await parseCapabilityMap();
  const docExtraction = await extractTokens([...docs.values()]);
  const docNamedApis = await extractNamedApis([...docs.values()]);
  const docMcpTools = await extractMcpTools([...docs.values()]);
  const docRoutes = await extractRoutes([...docs.values()]);
  const docGlobalFunctions = await extractGlobalFunctions([...docs.values()]);
  const skillMarkdown = await walk(skillRoot, (target) =>
    target.endsWith(".md"),
  );
  const skillExtraction = await extractTokens(skillMarkdown);
  const skillNamedApis = await extractNamedApis(skillMarkdown);
  const skillMcpTools = await extractMcpTools(skillMarkdown);
  const skillRoutes = await extractRoutes(skillMarkdown);
  const skillGlobalFunctions = await extractGlobalFunctions(skillMarkdown);
  const components = await inspectComponents();
  const bluetooth = await inspectBluetoothPrint();
  const report = buildReport({
    docs,
    mapped,
    skills,
    readmeSkills,
    docTokens: docExtraction.tokens,
    skillTokens: skillExtraction.tokens,
    normalizedExamples: docExtraction.normalizedExamples,
    docNamedApis: docNamedApis.names,
    skillNamedApis: skillNamedApis.names,
    ignoredNamedApiExamples: docNamedApis.ignoredExamples,
    docMcpTools,
    skillMcpTools,
    docRoutes: docRoutes.routes,
    skillRoutes: skillRoutes.routes,
    normalizedRoutes: docRoutes.normalizedExamples,
    docGlobalFunctions,
    skillGlobalFunctions,
    componentControls: components.controls,
    missingComponents: components.missing,
    bluetooth,
  });

  await fs.mkdir(reportDir, { recursive: true });
  const markdownPath = path.join(
    reportDir,
    "microi-doc-skill-coverage.md",
  );
  const jsonPath = path.join(reportDir, "microi-doc-skill-coverage.json");
  await fs.writeFile(markdownPath, report.markdown, "utf8");
  await fs.writeFile(
    jsonPath,
    `${JSON.stringify(report.payload, null, 2)}\n`,
    "utf8",
  );
  process.stdout.write(report.markdown);
  console.log(`Markdown report: ${markdownPath}`);
  console.log(`JSON report: ${jsonPath}`);
  process.exitCode = report.ok ? 0 : 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 2;
});
