import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const publisherSource = await readFile(new URL("./ai-app-publish-store.js", import.meta.url), "utf8");
const packageModel = JSON.parse(
  await readFile(new URL("./app.microi.store.json", import.meta.url), "utf8"),
);
const packagedPublisher = packageModel.SysApiEngines.find(
  item => item.ApiEngineKey === "ai_app_publish_store",
);

test("publisher package metadata matches the v1.7.4 V3 source", () => {
  assert.ok(packagedPublisher);
  assert.equal(packagedPublisher.Version, "v1.7.4");
  assert.equal(
    packagedPublisher.ApiV8Code.replace(/\r\n/g, "\n"),
    publisherSource.replace(/\r\n/g, "\n"),
  );
});

test("microservice packages exclude deleted and disabled historical routes", () => {
  assert.match(publisherSource, /\['AND', 'IsDeleted', '<>', 1\]/);
  assert.match(publisherSource, /\['AND', 'IsEnable', '<>', 0\]/);
});

test("publisher emits managed baselines and tenant-owned create-if-missing policies", () => {
  const context = {
    V8: {
      EncryptHelper: {
        Sha256Hex(value) {
          return crypto.createHash("sha256").update(String(value)).digest("hex");
        },
      },
    },
    JSON,
    Object,
    String,
  };
  vm.runInNewContext(`
    ${extractFunction(publisherSource, "text")}
    ${extractFunction(publisherSource, "toArray")}
    ${extractFunction(publisherSource, "parseObject")}
    ${extractFunction(publisherSource, "sha256Hex")}
    ${extractFunction(publisherSource, "apiEngineMap")}
    ${extractFunction(publisherSource, "buildApiEngineResourcePolicies")}
    result = buildApiEngineResourcePolicies;
  `, context);
  const policies = context.result(
    [
      { ApiEngineKey: "core", ApiV8Code: "new-core" },
      { ApiEngineKey: "hook", ApiV8Code: "template" },
    ],
    { ApiEngines: { hook: { UpgradePolicy: "CreateIfMissing" } } },
    {
      AppPakcet: JSON.stringify({
        SysApiEngines: [{ ApiEngineKey: "core", ApiV8Code: "old-core" }],
      }),
    },
  );

  assert.equal(policies.ApiEngines.core.UpgradePolicy, "Managed");
  assert.equal(
    policies.ApiEngines.core.BaseHash,
    crypto.createHash("sha256").update("old-core").digest("hex"),
  );
  assert.equal(policies.ApiEngines.hook.Ownership, "Tenant");
  assert.equal(policies.ApiEngines.hook.UpgradePolicy, "CreateIfMissing");
  assert.equal(policies.ApiEngines.hook.BaseHash, undefined);
});

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

function menuResolver() {
  const declaration = publisherSource.match(
    /var menuIds = parseArray\(V8\.Param\.MenuIds\);/,
  );
  const fallback = publisherSource.match(
    /if \(menuIds\.length === 0 && existingStore && existingStore\.SelectMenu\) \{\s*menuIds = selectionValues\(existingStore\.SelectMenu, \['Id', 'MenuId', 'Value'\]\);\s*\}/,
  );
  assert.ok(declaration, "missing explicit MenuIds resolution");
  assert.ok(fallback, "missing persisted SelectMenu fallback");
  const context = {};
  vm.runInNewContext(`
    ${extractFunction(publisherSource, "text")}
    ${extractFunction(publisherSource, "isBlank")}
    ${extractFunction(publisherSource, "toArray")}
    ${extractFunction(publisherSource, "parseArray")}
    ${extractFunction(publisherSource, "selectionValues")}
    function resolve(param, store) {
      var V8 = { Param: param || {} };
      var existingStore = store || null;
      ${declaration[0]}
      ${fallback[0]}
      return menuIds;
    }
    result = resolve;
  `, context);
  return context.result;
}

function storeMenuResolver() {
  const expression = publisherSource.match(
    /SelectMenu:\s*([\s\S]*?),\s*SelectTable:/,
  );
  assert.ok(expression, "missing storeRow SelectMenu expression");
  const context = {};
  vm.runInNewContext(`
    ${extractFunction(publisherSource, "selectionJson")}
    function resolve(param, existingStore) {
      var V8 = { Param: param || {} };
      return (${expression[1]});
    }
    result = resolve;
  `, context);
  return context.result;
}

function contractNormalizer() {
  const functionSource = extractFunction(publisherSource, "normalizeMenuContract");
  const context = {};
  vm.runInNewContext(`
    ${extractFunction(publisherSource, "text")}
    ${extractFunction(publisherSource, "isBlank")}
    ${extractFunction(publisherSource, "toArray")}
    ${extractFunction(publisherSource, "parseArray")}
    ${extractFunction(publisherSource, "selectionValues")}
    ${functionSource}
    result = normalizeMenuContract;
  `, context);
  return context.result;
}

test("explicit MenuIds win over the persisted SelectMenu fallback", () => {
  const resolve = menuResolver();
  const resolved = resolve(
    { MenuIds: ["menu-explicit"] },
    { SelectMenu: JSON.stringify([{ Id: "menu-stored", Name: "stored" }]) },
  );
  assert.deepEqual(Array.from(resolved), ["menu-explicit"]);
});

test("persisted SelectMenu objects supply deduplicated MenuIds when the caller omits them", () => {
  const resolve = menuResolver();
  const resolved = resolve({}, {
    SelectMenu: JSON.stringify([
      { Id: "menu-a", Name: "A", ParentId: "root", DiyTableId: "table-a", DiyTableName: "A table" },
      { Id: "MENU-A", Name: "duplicate" },
      { MenuId: "menu-b", Name: "B" },
    ]),
  });
  assert.deepEqual(Array.from(resolved), ["menu-a", "menu-b"]);
});

test("resolved MenuIds feed the exporter and exported SysMenus reach the root package", () => {
  assert.match(
    publisherSource,
    /V8\.ApiEngine\.Run\('export-microi-store-package',\s*\{[\s\S]*?MenuIds:\s*menuIds,\s*ExactMenuIds:\s*exactMenuIds,/,
  );
  assert.match(publisherSource, /SysMenus:\s*toArray\(selectedExport\.SysMenus\),/);
});

test("ExactMenuIds is opt-in and is forwarded to the package exporter", () => {
  assert.match(
    publisherSource,
    /var exactMenuIds = V8\.Param\.ExactMenuIds === true\s*\|\| V8\.Param\.ExactMenuIds === 1\s*\|\| text\(V8\.Param\.ExactMenuIds\)\.toLowerCase\(\) === 'true';/,
  );
  assert.doesNotMatch(
    publisherSource,
    /ExactMenuIds:\s*true/,
    "normal manual packages must retain the exporter's recursive default",
  );
});

test("MenuContract must exactly match the opt-in MenuIds and is attached to package assets", () => {
  const normalize = contractNormalizer();
  const contract = {
    Count: 3,
    MenuIds: ["parent", "sessions", "results"],
    Menus: [{ Id: "parent" }, { Id: "sessions" }, { Id: "results" }],
    AdminManifestPath: "source/admin-manifest.json",
    AdminManifestSha256: "abc",
  };
  assert.equal(normalize(contract, ["parent", "sessions", "results"], true), contract);
  assert.throws(() => normalize(contract, ["parent", "sessions"], true), /数量与精确 MenuIds 不一致/);
  assert.throws(() => normalize(contract, ["parent", "sessions", "other"], true), /菜单集合与精确 MenuIds 不一致/);
  assert.throws(() => normalize(contract, ["parent", "sessions", "results"], false), /只能与 ExactMenuIds=true/);
  assert.match(publisherSource, /if \(menuContract && packageAssets\) packageAssets\.MenuContract = menuContract;/);
  assert.match(publisherSource, /ExactMenuIds=true 时必须提供与菜单集合一致的 MenuContract/);
});

test("storeRow saves explicit SelectMenu metadata and otherwise preserves the stored JSON", () => {
  const resolve = storeMenuResolver();
  const menus = [{
    Id: "menu-a",
    Name: "A",
    ParentId: "root",
    DiyTableId: "table-a",
    DiyTableName: "A table",
  }];
  const stored = JSON.stringify([{ Id: "menu-stored", Name: "stored" }]);
  assert.equal(resolve({ SelectMenu: menus }, { SelectMenu: stored }), JSON.stringify(menus));
  assert.equal(resolve({}, { SelectMenu: stored }), stored);
  assert.equal(resolve({ SelectMenu: [] }, { SelectMenu: stored }), "[]", "an explicit empty selection clears the stored selection");
});

test("storeRow persists resolved resource ids when explicit package selections are supplied", () => {
  assert.match(
    publisherSource,
    /V8\.Param\.MenuIds !== undefined && V8\.Param\.MenuIds !== null\s*\? selectionJson\(menuIds\)/,
  );
  assert.match(
    publisherSource,
    /SelectTable:[\s\S]*?V8\.Param\.TableIds !== undefined && V8\.Param\.TableIds !== null\s*\? selectionJson\(tableIds\)/,
  );
  assert.match(
    publisherSource,
    /SelectApiEngine:[\s\S]*?V8\.Param\.ApiEngineKeys !== undefined && V8\.Param\.ApiEngineKeys !== null\s*\? selectionJson\(apiEngineKeys\)/,
  );
});

function exactPublishedVersionValidator() {
  const context = {};
  vm.runInNewContext(`
    ${extractFunction(publisherSource, "ok")}
    ${extractFunction(publisherSource, "fail")}
    ${extractFunction(publisherSource, "text")}
    ${extractFunction(publisherSource, "isBlank")}
    ${extractFunction(publisherSource, "normalizeExactVersion")}
    ${extractFunction(publisherSource, "validateExactPublishedVersion")}
    result = validateExactPublishedVersion;
  `, context);
  return context.result;
}

test("legacy exact package repair accepts only latest successful immutable states with an exact asset contract", () => {
  const validate = exactPublishedVersionValidator();
  const assets = { PackageVersion: "v1.5.5" };

  for (const state of ["Published", "Completed"]) {
    const result = validate(
      { VersionNo: "v1.5.5", PublishState: state },
      assets,
      "v1.5.5",
      false,
    );
    assert.equal(result.Code, 1, `legacy exact should accept ${state}`);
    assert.equal(result.Data.AppVersion, "v1.5.5");
  }

  const legacyV2Result = validate(
    { VersionNo: "v1.5.5", Status: "Published", PublishState: "LegacyUnverified" },
    assets,
    "v1.5.5",
    false,
  );
  assert.equal(legacyV2Result.Code, 1, "legacy v2 must use its verified historical Status field");
  assert.equal(
    validate(
      { VersionNo: "v1.5.5", Status: "Published", PublishState: "LegacyUnverified" },
      assets,
      "v1.5.5",
      true,
    ).Code,
    0,
    "protocol v3 must never accept a legacy-unverified pointer",
  );

  for (const state of ["Failed", "Preparing", "Publishing", "Pending", "Cancelled", ""]) {
    const result = validate(
      { VersionNo: "v1.5.5", PublishState: state },
      assets,
      "v1.5.5",
      false,
    );
    assert.equal(result.Code, 0, `legacy exact must reject ${state || "empty"}`);
    assert.match(result.Msg, /必须为 Published 或 Completed/);
  }

  assert.equal(
    validate({ VersionNo: "v1.5.4", PublishState: "Completed" }, assets, "v1.5.5", false).Code,
    0,
    "an older version row must not satisfy the exact contract",
  );
  assert.equal(
    validate(
      { VersionNo: "v1.5.5", PublishState: "Completed" },
      { PackageVersion: "v1.5.4" },
      "v1.5.5",
      false,
    ).Code,
    0,
    "stale prepared assets must not satisfy the exact contract",
  );
  assert.equal(
    validate({ VersionNo: "v1.5.5", PublishState: "Completed" }, {}, "v1.5.5", false).Code,
    0,
    "PreparedAssets.PackageVersion is mandatory",
  );
  assert.equal(
    validate({ VersionNo: "v1.5.5", PublishState: "Completed" }, assets, "", false).Code,
    0,
    "AppVersion is mandatory instead of silently defaulting to v1.0.0",
  );
  assert.equal(
    validate({ VersionNo: "v1.5.5", PublishState: "Published" }, assets, "v1.5.5", true).Code,
    0,
    "protocol v3 remains Completed-only",
  );
});

test("interrupted package repair resolves legacy exact against the single newest version row", () => {
  assert.match(
    publisherSource,
    /var exactPublishedVersion = protocolV3[\s\S]*?V8\.Param\.ExactPublishedVersion === true[\s\S]*?validateExactPublishedVersion\([\s\S]*?exactVersionRow,[\s\S]*?packageAssets,[\s\S]*?V8\.Param\.AppVersion/,
  );
  assert.match(
    publisherSource,
    /function getLatestVersion\(appId\)[\s\S]*?_OrderBy: 'CreateTime',[\s\S]*?_OrderByType: 'DESC',[\s\S]*?_PageSize: 1/,
  );
  assert.match(
    publisherSource,
    /var exactVersionRow = protocolV3 \? committedVersion : latestVersion;/,
  );
  assert.match(
    publisherSource,
    /var versionNo = exactPublishedVersion\s*\? requestedPublishedVersion\s*:/,
  );
  assert.match(
    publisherSource,
    /AppVersion:\s*versionNo,/,
    "the validated immutable version must be written back to the store",
  );
});

test("protocol v3 resolves the committed version by exact VersionId instead of a newer staged row", () => {
  const context = {
    V8: {
      FormEngine: {
        GetTableData(_table, query) {
          assert.deepEqual(Array.from(query._Where[0]), ["Id", "=", "version-committed"]);
          assert.deepEqual(Array.from(query._Where[1]), ["AND", "AppId", "=", "app-id"]);
          return {
            Code: 1,
            Data: [{ Id: "version-committed", PublishState: "Completed" }],
          };
        },
      },
    },
  };
  vm.runInNewContext(`
    ${extractFunction(publisherSource, "toArray")}
    ${extractFunction(publisherSource, "getCommittedVersion")}
    result = getCommittedVersion;
  `, context);
  const committed = context.result("app-id", "version-committed");
  assert.equal(committed.Id, "version-committed");
  assert.notEqual(committed.Id, "version-staged-newer");
  assert.match(
    publisherSource,
    /var exactVersionRow = protocolV3 \? committedVersion : latestVersion;/,
  );
  assert.throws(() => {
    context.V8.FormEngine.GetTableData = () => ({ Code: 1, Data: [] });
    context.result("app-id", "missing");
  }, /精确命中 1 条/u);
});

test("protocol v3 package write is a committed-proof fenced CAS with pre/post readback", () => {
  assert.match(publisherSource, /Version: v1\.7\.4/);
  assert.match(
    publisherSource,
    /V8\.FormEngine\.UptFormDataByWhere\('sys_microistore', packageFields\)/,
  );
  for (const field of [
    "CommittedPublishVersionId",
    "CommittedRuntimeManifestHash",
    "PublishFence",
    "PublishRowVersion",
    "PublishState",
  ]) {
    assert.match(publisherSource, new RegExp(`\\['AND', '${field}', '='`, "u"));
  }
  const v3Branch = publisherSource.slice(
    publisherSource.indexOf("if (protocolV3) {\n    // Core"),
    publisherSource.indexOf("var publishResult = upsertStore(storeRow);"),
  );
  assert.doesNotMatch(v3Branch, /upsertStore|AddFormData|UptFormData\('sys_microistore'/u);
  assert.match(v3Branch, /assertV3CommittedStore\(postPublishStore, committedProof, '写包后'\)/u);
});

test("v3 route canonical JSON 固定向量与 Node/MCP 一致且拒绝非 safe integer", () => {
  const context = {};
  vm.runInNewContext(`
    ${extractFunction(publisherSource, "canonicalJson")}
    result = canonicalJson;
  `, context);
  const value = [
    { title: '中文"引号', meta: { z: 9007199254740991, a: -9007199254740991 }, path: "/a" },
    { order: 0 },
  ];
  const canonical = context.result(value);
  assert.equal(canonical, '[{"meta":{"a":-9007199254740991,"z":9007199254740991},"path":"/a","title":"中文\\"引号"},{"order":0}]');
  assert.equal(crypto.createHash("sha256").update(canonical, "utf8").digest("hex"), "39ac0b5c44884edcb6497dbf6a0fa8a2e95a1f2a968e8eaa10e7557e0443d47e");
  assert.throws(() => context.result([{ order: 1.5 }]), /safe integer/u);
  assert.throws(() => context.result([{ order: 9007199254740992 }]), /safe integer/u);
});

test("v3 MicroService 包只使用 committed route/metadata snapshot，禁止回退 mutable live runtime", () => {
  assert.match(
    publisherSource,
    /var runtime = appType === 'MicroService'[\s\S]*?protocolV3[\s\S]*?Service: V8\.Param\.MicroService \|\| null[\s\S]*?: getMicroService\(app\.AppKey\)/u,
  );
  assert.match(publisherSource, /if \(!protocolV3 && appType === 'MicroService'/u);
  assert.match(publisherSource, /v3 MicroService 必须显式提供 MicroService snapshot，禁止回退 live runtime/u);
  assert.match(
    publisherSource,
    /text\(committedVersion\.RouteSnapshotJson\) !== v3RouteSnapshot\.Json[\s\S]*?committedVersion\.RouteSnapshotHash/u,
  );
  assert.match(
    publisherSource,
    /var entryPath = protocolV3\s*\? text\(committedVersion\.EntryPath\)/u,
  );
  assert.match(
    publisherSource,
    /postCommittedVersion = getCommittedVersion[\s\S]*?postCommittedVersion\.RouteSnapshotJson[\s\S]*?route snapshot 已漂移/u,
  );
});
