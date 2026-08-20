import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const permissionSource = await readFile(new URL("../src/permission.js", import.meta.url), "utf8");
const assistantSource = await readFile(new URL("../src/views/ai-engine/index.vue", import.meta.url), "utf8");
const workbenchSource = await readFile(new URL("../src/views/ai-engine/ai-app-workbench.vue", import.meta.url), "utf8");
const marketplaceSource = await readFile(new URL("../../AI-Project/microi/AI应用/microi-platform-service/src/Marketplace.vue", import.meta.url), "utf8");

test("旧 AI 应用入口稳定跳转到统一应用商城", () => {
    assert.match(permissionSource, /to\.path === "\/mci-ai-app"/);
    assert.match(permissionSource, /path: "\/microi-store", replace: true/);
    assert.match(permissionSource, /name: "mic_ai_app_detail"/);
    assert.doesNotMatch(assistantSource, /path:\s*"\/mci-ai-app"/);
    assert.doesNotMatch(workbenchSource, /router\.push\(\{ path: "\/mci-ai-app"/);
});

test("应用创建和开发页返回操作均以应用商城为入口", () => {
    assert.match(assistantSource, /name: "mic_ai_app_detail", params: \{ appId: data\.Id \}/);
    assert.match(assistantSource, /应用已登记到【应用商城】/);
    assert.match(workbenchSource, />应用商城<\/el-button>/);
    assert.match(workbenchSource, /router\.push\(\{ path: "\/microi-store" \}\)/);
});

test("应用商城微服务在卡片和详情中承载 AI 应用预览与开发入口", () => {
    assert.equal((marketplaceSource.match(/>预览<\/button>/g) || []).length, 2);
    assert.equal((marketplaceSource.match(/>开发<\/button>/g) || []).length, 2);
    assert.match(marketplaceSource, /function canPreviewApp\(app\)/);
    assert.match(marketplaceSource, /function canDevelopApp\(app\)/);
    assert.match(marketplaceSource, /path:`\/mic-ai-app\/\$\{encodeURIComponent\(appId\)\}`/);
    assert.match(marketplaceSource, /window\.open\(url,'_blank','noopener,noreferrer'\)/);
});
