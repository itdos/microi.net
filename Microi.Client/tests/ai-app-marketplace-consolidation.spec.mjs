import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const permissionSource = await readFile(new URL("../src/permission.js", import.meta.url), "utf8");
const assistantSource = await readFile(new URL("../src/views/ai-engine/index.vue", import.meta.url), "utf8");
const workbenchSource = await readFile(new URL("../src/views/ai-engine/ai-app-workbench.vue", import.meta.url), "utf8");
const platformRelease = JSON.parse(await readFile(new URL("../../Microi.Server/OfficialApplications/Resource/platform-service-release.json", import.meta.url), "utf8"));
const platformSource = new URL(`../../${platformRelease.SourceRoot}/`, import.meta.url);
const marketplaceSource = await readFile(new URL("src/Marketplace.vue", platformSource), "utf8");
const marketplaceCompactCss = await readFile(new URL("src/marketplace-compact.css", platformSource), "utf8");

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
    assert.match(marketplaceSource, /async function openAppPreview\(app\)/);
});

function previewHarness({ result, publicApp = true, url = "https://file.microi.net/app/index.html", blocked = false, reject = false, changeTenant = false } = {}) {
    const events = [];
    const context = { apiBase: "https://api.itdos.com", osClient: "iTdos", currentUser: { Id: "user-a" } };
    const target = {
        set opener(value) { events.push(["opener", value]); },
        location: { replace(value) { events.push(["navigate", value]); } },
        close() { events.push(["close"]); }
    };
    const source = marketplaceSource.split(/\r?\n/).find(line => line.startsWith("async function openAppPreview(app)"));
    assert.ok(source, "必须测试已发布源码中的真实预览函数");
    const open = runInNewContext(`${source}\nopenAppPreview`, {
        URL, context,
        runtimePreviewUrl: () => url,
        isPublicApp: () => publicApp,
        showMessage: (...args) => events.push(["message", ...args]),
        window: { location: { origin: "https://web.microi.net" }, open: (...args) => { events.push(["open", ...args]); return blocked ? null : target; } },
        client: { post: async (path, body, options) => {
            events.push(["resolve", path, body.FilePathName, options.checkCode]);
            if (changeTenant) context.osClient = "other";
            if (reject) throw new Error("offline");
            return result;
        } }
    });
    return { events, open };
}

test("公开预览仅选择已验证 HTTPS 副本，且在异步查询前隔离 opener", async () => {
    const h = previewHarness({ result: { Code: 1, Data: { UseBackup: true, Url: "https://hub.microi.net:1120/itdos/verified/index.html" } } });
    await h.open({});
    assert.deepEqual(h.events, [
        ["open", "about:blank", "_blank"], ["opener", null],
        ["resolve", "/apiengine/mci-file-resource-public-url", "app/index.html", false],
        ["navigate", "https://hub.microi.net:1120/itdos/verified/index.html"]
    ]);
});

test("未就绪、失败或非 HTTPS 副本均保留原公开入口", async () => {
    for (const options of [
        { result: { Code: 1, Data: { UseBackup: false, Url: "https://hub.microi.net/x" } } },
        { result: { Code: 0, Data: { UseBackup: true, Url: "https://hub.microi.net/x" } } },
        { result: { Code: 1, Data: { UseBackup: true, Url: "http://hub.microi.net/x" } } },
        { reject: true }, { result: null }
    ]) {
        const h = previewHarness(options);
        await h.open({});
        assert.deepEqual(h.events.at(-1), ["navigate", "https://file.microi.net/app/index.html"]);
    }
});

test("私有预览不查询公开副本，切换租户后关闭待导航窗口", async () => {
    const privatePreview = previewHarness({ publicApp: false });
    await privatePreview.open({});
    assert.equal(privatePreview.events.some(event => event[0] === "resolve"), false);
    assert.deepEqual(privatePreview.events.at(-1), ["navigate", "https://file.microi.net/app/index.html"]);
    const switched = previewHarness({ changeTenant: true, result: { Code: 1, Data: { UseBackup: true, Url: "https://hub.microi.net/x" } } });
    await switched.open({});
    assert.deepEqual(switched.events.at(-1), ["close"]);
    assert.equal(switched.events.some(event => event[0] === "navigate"), false);
});

test("没有运行入口或浏览器拦截窗口时明确提示", async () => {
    const missing = previewHarness({ url: "" });
    await missing.open({});
    assert.equal(missing.events.length, 1);
    assert.equal(missing.events[0][0], "message");
    const blocked = previewHarness({ blocked: true });
    await blocked.open({});
    assert.equal(blocked.events.at(-1)[0], "message");
    assert.equal(blocked.events.some(event => event[0] === "navigate"), false);
});

test("应用商城筛选条件分成两行并允许选项自然换行", () => {
    assert.match(marketplaceSource, /class="market-filters__secondary"/);
    assert.match(marketplaceSource, /marketplace-filter-application-types/);
    assert.match(marketplaceSource, /marketplace-filter-visibility/);
    assert.match(marketplaceCompactCss, /\.market-filters\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    assert.match(marketplaceCompactCss, /\.filter-group\s*>\s*div\s*\{[^}]*flex-wrap:\s*wrap;[^}]*overflow:\s*visible;/);
});

test("安装前展示资源摘要并按包内菜单决定是否选择安装位置", () => {
    assert.match(marketplaceSource, /data-testid="marketplace-package-summary"/);
    assert.match(marketplaceSource, /data-testid="marketplace-install-setup"/);
    assert.match(marketplaceSource, /summary\?\.RequiresInstallParent/);
    assert.match(marketplaceSource, /targetMode === 'root'/);
    assert.match(marketplaceSource, /targetMode === 'existing'/);
    assert.match(marketplaceSource, /targetMode === 'create'/);
    assert.match(marketplaceSource, /InstallParentSysMenuId/);
    assert.match(marketplaceSource, /InstallParentSysMenuName/);
    assert.match(marketplaceSource, /InstallParentCreateUnderSysMenuId/);
    assert.match(marketplaceSource, /IncludePackageSummary:true/);
    assert.match(marketplaceSource, /platform-sys-menu\?Action=GetSysMenuStep/);
    assert.match(marketplaceSource, /该安装包不包含菜单引擎/);
});
