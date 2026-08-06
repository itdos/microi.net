import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const base = new URL("./", import.meta.url);
const normalize = value => `${String(value).replace(/\r\n?/g, "\n").replace(/\n*$/g, "")}\n`;
const [core, extension, packageText] = await Promise.all([
  readFile(new URL("core.js", base), "utf8"),
  readFile(new URL("extension.js", base), "utf8"),
  readFile(new URL("app.microi.wechat-content-security.json", base), "utf8"),
]);
const packageModel = JSON.parse(packageText);

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

test("documented callback URL uses the suffix and OsClient query name", async () => {
  const readme = await readFile(new URL("README.md", base), "utf8");
  assert.match(readme, /Callback--OsClient--你的OsClient--/);
  assert.match(readme, /\?OsClient=/);
  assert.doesNotMatch(readme, /Callback\?o=/);
});
