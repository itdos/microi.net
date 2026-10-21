import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(directory, "../../..");
const packageModel = JSON.parse(fs.readFileSync(path.join(directory, "app.microi.form-engine.json"), "utf8"));
const commonSource = fs.readFileSync(path.join(workspace, "Microi.Client/src/utils/diy.common.js"), "utf8");
const operationsSource = fs.readFileSync(
    path.join(workspace, "Microi.Client/src/views/form-engine/mixins/diy-table-operations.mixin.js"),
    "utf8"
);

test("form-engine package declares the protected custom export client capability", () => {
    const info = packageModel.PackageInfo;
    assert.equal(info.Version, "v7.7.8");
    assert.equal(info.ChangeLog.Version, info.Version);
    // 新版共享列发行保留原导出安全发布说明，不能把旧能力要求误绑到新的标题变更日志。
    const exportHistory = info.ChangeHistory.split(/\r?\n/).find(line => line.startsWith('2026-09-21 v7.7.6 '));
    assert.ok(exportHistory);
    assert.match(exportHistory, /Authorization/);
    assert.match(exportHistory, /无需开启匿名调用/);
    assert.ok(info.ChangeHistory.startsWith(`${info.ChangeLog.ReleaseTime.slice(0, 10)} ${info.Version} ${info.ChangeLog.Content}`));
    assert.ok(info.RequiredPlatformCapabilities.includes(
        "ClientFeature:ProtectedCustomExportAuthorizationV1"
    ));
});

test("the declared capability has its client implementation and loading recovery", () => {
    assert.match(commonSource, /headers\.authorization = "Bearer " \+ requestToken/);
    assert.match(commonSource, /finally\s*\{[\s\S]*?callback\(result\)/);
    assert.match(operationsSource, /await self\.DiyCommon\.FormExportFileV2/);
    assert.match(operationsSource, /finally\s*\{\s*self\.BtnExportLoading = false;/);
});
