import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const resourceUrl = new URL("./", import.meta.url);
const packageModel = JSON.parse(await readFile(new URL("app.microi.store.json", resourceUrl), "utf8"));
const bulkSource = await readFile(new URL("bulk-import-packages.js", resourceUrl), "utf8");
const importerSource = await readFile(new URL("import-package.js", resourceUrl), "utf8");
const statSource = await readFile(new URL("official-marketplace-install-stat.js", resourceUrl), "utf8");

function parseButtons(value) {
  return value ? JSON.parse(value) : [];
}

test("application-store package hides every install mutation on the official platform", () => {
  assert.equal(packageModel.PackageInfo.Version, "v7.0.5");
  const menu = packageModel.SysMenus.find((item) => item.Url === "/microi-store");
  assert.ok(menu, "application-store menu is missing");

  const rowButtons = parseButtons(menu.MoreBtns);
  for (const [name, action] of [["安装", "Install"], ["更新", "Update"], ["重新安装", "Reinstall"]]) {
    const button = rowButtons.find((item) => item.Name === name);
    assert.ok(button, `${name} button is missing`);
    assert.match(button.V8CodeShow, /IsOfficialPlatform === true/);
    assert.equal(button.InstallAction, action);
    assert.equal(button.ApiEngineKey, "import-microi-store-package");
    assert.equal(button.RunBackground, true);
  }

  const pageButtons = parseButtons(menu.PageBtns);
  const offline = pageButtons.find((item) => item.Name === "安装离线包");
  const bulk = pageButtons.find((item) => item.Name === "全部安装/更新");
  assert.match(offline.V8CodeShow, /IsOfficialPlatform === true/);
  assert.match(bulk.V8CodeShow, /IsOfficialPlatform === true/);
  assert.match(bulk.V8CodeShow, /Level/);
  assert.match(bulk.V8Code, /RunBackground\('bulk-import-microi-store-packages'/);
  assert.match(bulk.V8Code, /已是最新版的应用不会重新安装/);
});

test("bulk install persists its plan in the shared background-task checkpoint", () => {
  assert.match(bulkSource, /BACKGROUND_TASK_CHECKPOINT_PLAN_V2/);
  assert.match(bulkSource, /BACKGROUND_TASK_TRUSTED_BOOTSTRAP_V1/);
  assert.match(bulkSource, /trustedInvocation[\s\S]*&& !!taskId[\s\S]*taskEnvelope\.Id[\s\S]*fencingToken/);
  assert.doesNotMatch(bulkSource, /\|\| \(text\(taskEnvelope\.Id\)/);
  assert.doesNotMatch(bulkSource, /mci_marketplace_bulk_install_item/);
  assert.match(bulkSource, /status != 'Uninstalled' && status != 'Outdated'/);
  assert.match(bulkSource, /InstallAction: status == 'Outdated' \? 'Update' : 'Install'/);
  assert.match(bulkSource, /BackgroundTask:\s*\{[\s\S]*?HasMore: true,[\s\S]*?Checkpoint:/);
  assert.match(bulkSource, /Plan: plan/);
  assert.match(bulkSource, /ChildCheckpoint/);
  assert.match(bulkSource, /UpdateBackgroundTask/);
  assert.match(bulkSource, /V8\.ApiEngine\.Run\('import-microi-store-package'/);
  assert.doesNotMatch(bulkSource, /localStorage|sessionStorage|static\s+/i);
});

test("every install action reports one stable operation to the authoritative counter", () => {
  assert.match(importerSource, /InstallOperationId/);
  assert.match(importerSource, /InstallAction: installAction/);
  assert.match(importerSource, /OperationId: installOperationId/);
  assert.match(importerSource, /official_marketplace_install_stat/);
  assert.doesNotMatch(importerSource, /UPDATE\s+`?sys_microistore`?\s+SET\s+`?InstallCount`?/i);

  assert.match(statSource, /mci_marketplace_install_event/);
  assert.match(statSource, /INSERT IGNORE INTO `mci_marketplace_install_event`/);
  assert.match(statSource, /OperationId不能为空/);
  assert.match(statSource, /InstallAction仅支持Install、Update或Reinstall/);
  assert.match(statSource, /InstallCount`=COALESCE\(`InstallCount`,0\)\+1/);
  assert.match(statSource, /RedisCompatibility/);
});

test("the embedded bulk engine exactly matches its maintained source", () => {
  const engine = packageModel.SysApiEngines.find(
    (item) => item.ApiEngineKey === "bulk-import-microi-store-packages",
  );
  assert.ok(engine, "embedded bulk engine is missing");
  assert.equal(engine.Version, "v1.1.1");
  assert.equal(engine.IsEnable, 1);
  assert.equal(engine.StopHttp, 0);
  assert.equal(engine.ApiV8Code, bulkSource);
  assert.equal(packageModel.PackageInfo.ApiEngineCount, packageModel.SysApiEngines.length);
});

test("package importer fails closed when an API engine is not durably persisted", () => {
  assert.match(importerSource, /Version: v1\.8\.6/);
  assert.match(importerSource, /PACKAGE_API_ENGINE_READBACK_V1/);
  assert.match(importerSource, /assertPersistedApiEngine\(apiEngine, updatedEngine\)/);
  assert.match(importerSource, /assertPersistedApiEngine\(apiEngine, insertedEngine\)/);
  assert.match(importerSource, /throw new Error\('更新接口引擎失败：'/);
  assert.match(importerSource, /throw new Error\('新增接口引擎失败：'/);
  assert.match(importerSource, /actualCode !== expectedCode/);

  const embeddedImporter = packageModel.SysApiEngines.find(
    (item) => item.ApiEngineKey === "import-microi-store-package",
  );
  assert.ok(embeddedImporter, "embedded package importer is missing");
  assert.equal(embeddedImporter.Version, "v1.8.6");
  assert.equal(embeddedImporter.ApiV8Code, importerSource);
});
