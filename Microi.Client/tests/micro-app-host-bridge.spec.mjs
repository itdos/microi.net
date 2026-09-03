import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const bridgeSource = read("src/views/micro-app/host-bridge.js");
const bridge = await import(pathToFileURL(path.join(root, "src/views/micro-app/host-bridge.js")).href);

test("menu micro-apps receive a versioned host capability contract", () => {
    assert.deepEqual(bridge.createMicroAppHostCapabilities(), {
        protocol: "microi.host.v1",
        mode: "tab",
        requestType: "micro-app:host-action",
        resultType: "micro-app:host-action-result",
        actions: [
            "closeTab",
            "navigate",
            "replaceTab",
            "back",
            "forward",
            "reloadTab",
            "setTabTitle",
            "showMessage",
            "refreshCurrentUser",
            "setGlobalOverlay",
            "openForm",
            "openPlatformPrint"
        ],
        lifecycle: {
            cacheMode: "runtime-keep-alive",
            cacheOwner: "micro-app",
            maxCachedTabs: 5,
            stateEvent: "appstate-change",
            states: ["beforeshow", "aftershow", "afterhidden"]
        }
    });
});

test("host actions use one explicit dispatch envelope and normalize documented aliases", () => {
    assert.equal(bridge.parseMicroAppHostAction({ type: "business:event", action: "closeTab" }), null);
    assert.deepEqual(
        bridge.parseMicroAppHostAction({
            type: "micro-app:host-action",
            action: "close-current-tab",
            requestId: "request-1",
            data: { reason: "completed" }
        }),
        { action: "closeTab", requestId: "request-1", data: { reason: "completed" } }
    );
    assert.equal(
        bridge.parseMicroAppHostAction({ type: "micro-app:host-action", action: "openTab", data: { path: "/mic-home" } }).action,
        "navigate"
    );
    assert.equal(
        bridge.parseMicroAppHostAction({ type: "micro-app:host-action", data: { action: "refreshTab" } }).action,
        "reloadTab"
    );
    assert.equal(
        bridge.parseMicroAppHostAction({ type: "micro-app:host-action", data: { action: "syncUserPreferences" } }).action,
        "refreshCurrentUser"
    );
});

test("host route targets accept only normalized internal routes", () => {
    assert.equal(bridge.normalizeHostRouteTarget("/#/mic-home?from=micro-app"), "/mic-home?from=micro-app");
    assert.deepEqual(
        bridge.normalizeHostRouteTarget({ route: { path: "/mic-order", query: { id: 12, enabled: true } } }),
        { path: "/mic-order", query: { id: "12", enabled: "true" } }
    );
    assert.deepEqual(
        bridge.normalizeHostRouteTarget({ name: "mic_order", params: { id: "01ABC" }, hash: "detail" }),
        { name: "mic_order", params: { id: "01ABC" }, hash: "#detail" }
    );

    for (const target of ["https://evil.example/", "//evil.example/", "/bad\\path", "/%5Clocal", "/lo%67in", "/login", "/access-login?key=x", "/redirect/mic-home"]) {
        assert.throws(() => bridge.normalizeHostRouteTarget(target));
    }
});

test("tab titles and host messages remain bounded plain text", () => {
    assert.equal(bridge.normalizeHostTabTitle({ title: "  完成页\n" }), "完成页");
    assert.deepEqual(bridge.normalizeHostMessage({ message: " 保存成功 ", messageType: "success" }), {
        message: "保存成功",
        messageType: "success"
    });
    assert.equal(bridge.normalizeHostMessage({ message: "提示", messageType: "html" }).messageType, "info");
});

test("platform print bridge is fixed to the current tenant backend and registered print component", () => {
    const normalized = bridge.normalizeHostPlatformPrint({
        PrintId: "01KWDMSRHGGSZNHERS0VZP88C8",
        DataApi: "https://localhost:61501/apiengine/print_tuoma?OsClient=junchi&IdList=%5B%221%22%5D",
        Title: "普通打印（1 条）"
    }, { apiBase: "https://localhost:61501", osClient: "junchi" });
    assert.equal(normalized.ComponentName, "OpenIframe");
    assert.equal(normalized.OpenType, "Drawer");
    assert.equal(normalized.DataAppend.PrintId, "01KWDMSRHGGSZNHERS0VZP88C8");
    assert.match(normalized.DataAppend.DataApi, /\/apiengine\/print_tuoma\?OsClient=junchi/);

    for (const DataApi of [
        "https://evil.example/apiengine/print_tuoma?OsClient=junchi",
        "https://localhost:61501/api/SysUser/login?OsClient=junchi",
        "https://localhost:61501/apiengine/print_tuoma?OsClient=other"
    ]) {
        assert.throws(() => bridge.normalizeHostPlatformPrint({ PrintId: "print-1", DataApi }, {
            apiBase: "https://localhost:61501",
            osClient: "junchi"
        }));
    }
});

test("the page host connects dispatch actions to router and TagsView behavior", () => {
    const host = read("src/views/micro-app/host.vue");
    assert.match(host, /webBase:\s*window\.location\.origin/);
    assert.match(host, /hostCapabilities:\s*createMicroAppHostCapabilities\(\)/);
    assert.match(host, /parseMicroAppHostAction\(payload\)/);
    assert.match(host, /case "closeTab"/);
    assert.match(host, /tagsViewStore\.delView\(currentView\)/);
    assert.match(host, /case "navigate"/);
    assert.match(host, /this\.\$router\.push\(target\)/);
    assert.match(host, /case "replaceTab"/);
    assert.match(host, /this\.\$router\.replace\(target\)/);
    assert.match(host, /window\.addEventListener\("page-refresh"/);
    assert.match(host, /MICRO_APP_HOST_ACTION_RESULT_TYPE/);
    assert.match(host, /case "refreshCurrentUser"[\s\S]*RefreshLoginUser/);
    assert.match(host, /case "openPlatformPrint"[\s\S]*this\.openPlatformPrint/);
    assert.match(host, /refPlatformPrintDialog/);
    assert.match(host, /childPrelockedHtmlOnly/);
    assert.match(host, /htmlOverflow:\s*childPrelockedHtmlOnly\s*\?\s*""\s*:\s*html\.style\.overflow/);
    assert.match(host, /html\.style\.overflow\s*=\s*state\.htmlOverflow/);
});

test("marketplace form waits for the async dialog on the first click", () => {
    const host = read("src/views/micro-app/host.vue");
    assert.match(host, /function loadDiyFormFullModule\(\)/);
    assert.match(host, /DiyFormFull:\s*defineAsyncComponent\(loadDiyFormFullModule\)/);
    assert.match(host, /while \(this\.marketplaceFormOpening\)/);
    assert.match(host, /this\.marketplaceFormOpeningKey === requestKey/);
    assert.match(host, /for \(let attempt = 0; attempt < 200; attempt \+= 1\)/);
    assert.match(host, /typeof dialog\?\.Init === "function"/);
    assert.match(host, /HOST_FORM_DIALOG_NOT_READY/);
    assert.match(host, /catch \(error\) \{[\s\S]*this\.formDialogVisible = false;[\s\S]*throw error;/);
    assert.doesNotMatch(host, /if \(!dialog\?\.Init\) throw new Error\("应用表单组件尚未就绪，请稍后重试"\)/);
});
