import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const errorLogSource = fs.readFileSync(path.join(root, "src/utils/error-log.js"), "utf8");
const mainSource = fs.readFileSync(path.join(root, "src/main.js"), "utf8");

test("Element Plus Tabs 卸载竞态只按错误签名精确兜底", () => {
    assert.match(errorLogSource, /isElementPlusTabsUnmountRace/);
    assert.match(errorLogSource, /unregisterPane/);
    assert.match(errorLogSource, /stack\.includes\("element-plus"\)/);
    assert.match(errorLogSource, /lifecycle\.includes\("beforeUnmount"\)/);
    assert.match(errorLogSource, /console\.error\(err, info\)/, "其它真实异常仍需输出");
});

test("全局错误处理器在 Vue mount 之前安装", () => {
    const setupIndex = mainSource.indexOf("setupErrorHandler(app)");
    const mountIndex = mainSource.indexOf('app.mount("#app_microi")');
    assert.ok(setupIndex >= 0 && mountIndex > setupIndex);
});
