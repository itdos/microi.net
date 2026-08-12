import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const base = new URL("./", import.meta.url);
const normalize = value => `${String(value).replace(/\r\n?/g, "\n").replace(/\n*$/g, "")}\n`;
const [core, extension, statusBatch, packageText] = await Promise.all([
  readFile(new URL("core.js", base), "utf8"),
  readFile(new URL("extension.js", base), "utf8"),
  readFile(new URL("status-batch.js", base), "utf8"),
  readFile(new URL("app.microi.wechat-content-security.json", base), "utf8"),
]);
const packageModel = JSON.parse(packageText);
const runStatusBatch = (v8) => new Function("V8", "DateNow", statusBatch)(
  v8,
  () => "2026-08-07T00:00:00.000Z",
);

test("package keeps protocol work in C# and callback business in the managed engine", () => {
  const managed = packageModel.SysApiEngines.find(
    item => item.ApiEngineKey === "mci-wechat-content-callback-core",
  );
  assert.ok(managed);
  assert.equal(managed.ApiV8Code, normalize(core));
  assert.equal(managed.StopHttp, 1);
  assert.equal(managed.AllowAnonymous, 0);
  assert.equal(managed.Lock, 1);
  assert.match(managed.ApiV8Code, /CallbackEvent:/);
  assert.match(managed.ApiV8Code, /V8\.Method\.AddSysLog/);
  assert.match(managed.ApiV8Code, /mci-wechat-content-callback-extension/);
});

test("tenant extension is create-if-missing and its source is never a managed update", () => {
  const extensionEngine = packageModel.SysApiEngines.find(
    item => item.ApiEngineKey === "mci-wechat-content-callback-extension",
  );
  assert.ok(extensionEngine);
  assert.equal(extensionEngine.ApiV8Code, normalize(extension));
  assert.deepEqual(
    packageModel.ResourcePolicies.ApiEngines[extensionEngine.ApiEngineKey],
    { Ownership: "Tenant", UpgradePolicy: "CreateIfMissing" },
  );
  assert.deepEqual(
    packageModel.ResourcePolicies.ApiEngines["mci-wechat-content-callback-core"],
    { Ownership: "Application", UpgradePolicy: "Managed" },
  );
});

test("batch status engine is authenticated, managed and does not expose review details", () => {
  const batch = packageModel.SysApiEngines.find(
    item => item.ApiEngineKey === "mci-wechat-content-status-batch",
  );
  assert.ok(batch);
  assert.equal(batch.ApiV8Code, normalize(statusBatch));
  assert.equal(batch.StopHttp, 0);
  assert.equal(batch.AllowAnonymous, 0);
  assert.equal(batch.Lock, 0);
  assert.deepEqual(
    packageModel.ResourcePolicies.ApiEngines[batch.ApiEngineKey],
    { Ownership: "Application", UpgradePolicy: "Managed" },
  );
  assert.match(batch.ApiV8Code, /V8\.CurrentUser/);
  assert.match(batch.ApiV8Code, /WechatContentSecurity:Review:/);
  assert.match(batch.ApiV8Code, /text\(review\.UserId\) == currentUserId/);
  assert.doesNotMatch(batch.ApiV8Code, /OpenId\s*:/);
  assert.doesNotMatch(batch.ApiV8Code, /FilePath\s*:/);
  assert.match(batch.ApiV8Code, /\/\/ zhy:/);
});

test("package version and declared engine count match the generated resources", () => {
  assert.equal(packageModel.PackageInfo.Version, "v1.0.1");
  assert.equal(packageModel.PackageInfo.AppVersion, "v1.0.1");
  assert.equal(packageModel.PackageInfo.ApiEngineCount, packageModel.SysApiEngines.length);
});

test("batch status only returns normalized states owned by the current user", () => {
  const ownPassed = "1".padStart(32, "0");
  const otherPending = "2".padStart(32, "0");
  const missing = "3".padStart(32, "0");
  const values = new Map([
    [`Microi:tenant:WechatContentSecurity:Review:${ownPassed}`, JSON.stringify({
      ReviewId: ownPassed,
      UserId: "user-1",
      Status: "Passed",
      FilePath: "/private/one.jpg",
      OpenId: "must-not-leak",
    })],
    [`Microi:tenant:WechatContentSecurity:Review:${otherPending}`, JSON.stringify({
      ReviewId: otherPending,
      UserId: "user-2",
      Status: "Pending",
    })],
  ]);
  const result = runStatusBatch({
    OsClient: "tenant",
    CurrentUser: { Id: "user-1" },
    Param: { ReviewIds: [ownPassed, otherPending, missing] },
    Cache: { Get: key => values.get(key) || null },
  });
  assert.equal(result.Code, 1);
  assert.deepEqual(result.Data.Items, [
    { ReviewId: ownPassed, Status: "Passed" },
    { ReviewId: otherPending, Status: "Error" },
    { ReviewId: missing, Status: "Error" },
  ]);
  assert.equal(JSON.stringify(result).includes("must-not-leak"), false);
  assert.equal(JSON.stringify(result).includes("FilePath"), false);
});

test("batch status rejects anonymous and oversized requests", () => {
  const anonymous = runStatusBatch({
    OsClient: "tenant",
    CurrentUser: null,
    Param: { ReviewIds: ["1".padStart(32, "0")] },
    Cache: { Get: () => null },
  });
  assert.equal(anonymous.Code, 1001);

  const oversized = runStatusBatch({
    OsClient: "tenant",
    CurrentUser: { Id: "user-1" },
    Param: { ReviewIds: Array.from({ length: 21 }, (_, index) => index.toString(16).padStart(32, "0")) },
    Cache: { Get: () => null },
  });
  assert.equal(oversized.Code, 0);
});

test("documented callback URL uses the suffix and OsClient query name", async () => {
  const readme = await readFile(new URL("README.md", base), "utf8");
  assert.match(readme, /Callback--OsClient--你的OsClient--/);
  assert.match(readme, /\?OsClient=/);
  assert.doesNotMatch(readme, /Callback\?o=/);
});
