import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

function mockElement({ text = "", children = 0, width = 0, height = 0, tagName = "DIV" } = {}) {
    return {
        tagName,
        textContent: text,
        childElementCount: children,
        scrollWidth: width,
        scrollHeight: height,
        clientWidth: width,
        clientHeight: height,
        getBoundingClientRect: () => ({ width, height })
    };
}

test("friendly micro-app route exists before the catch-all and requires a page fact", () => {
    const router = read("src/router/index.js");
    const friendly = router.indexOf('path: "/micro-app/:appKey/:microPath(.*)*"');
    const catchAll = router.indexOf('path: "/:pathMatch(.*)*"');
    assert.ok(friendly >= 0);
    assert.ok(catchAll > friendly);
    assert.match(router, /microAppFriendlyRoute:\s*true/);
    assert.match(router, /microAppFriendlyRoute:\s*true,\s*keepAlive:\s*false/);
    assert.match(router, /import MicroAppHost from ["']@\/views\/micro-app\/host\.vue["']/);
    assert.match(router, /name:\s*["']micro_app_friendly["'][\s\S]*?component:\s*MicroAppHost/);
    assert.doesNotMatch(router, /name:\s*["']micro_app_friendly["'][\s\S]{0,240}?component:\s*\(\)\s*=>\s*import/);
    const constantsFrozen = router.indexOf("const constantRouteNames = collectRouteNames(constantRoutes)");
    assert.ok(constantsFrozen > friendly, "friendly route must be registered before the router freezes constant route names");
    assert.ok(router.indexOf("export const asyncRoutes") > friendly, "friendly route must not wait for authenticated menu injection");

    const host = read("src/views/micro-app/host.vue");
    assert.match(host, /MicroApp\/Resolve/);
    assert.match(host, /const requirePage\s*=\s*this\.\$route\?\.meta\?\.microAppFriendlyRoute\s*===\s*true/);
    assert.match(host, /RequirePage:\s*requirePage/);
});

test("render health requires real visible child content and permits only one automatic rebuild", async () => {
    const source = read("src/views/micro-app/render-health.js");
    const health = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
    const visibleStyle = () => ({ display: "block", visibility: "visible" });

    assert.equal(health.hasRenderableMicroAppContent(null, visibleStyle), false);
    assert.equal(health.hasRenderableMicroAppContent({ querySelector: () => null }, visibleStyle), false);

    const emptyRoot = mockElement({ width: 800, height: 600 });
    const zeroHeightRoot = mockElement({ text: "个人资料", width: 800, height: 0 });
    const visibleRoot = mockElement({ text: "个人资料", width: 800, height: 600 });
    const appWithRoot = rootElement => ({
        querySelector: selector => selector === "micro-app-body"
            ? { querySelector: inner => inner === "#app" ? rootElement : null, children: [] }
            : null
    });

    assert.equal(health.hasRenderableMicroAppContent(appWithRoot(emptyRoot), visibleStyle), false);
    assert.equal(health.hasRenderableMicroAppContent(appWithRoot(zeroHeightRoot), visibleStyle), false);
    assert.equal(health.hasRenderableMicroAppContent(appWithRoot(visibleRoot), visibleStyle), true);
    assert.equal(health.hasRenderableMicroAppContent(appWithRoot(visibleRoot), () => ({ display: "none" })), false);

    assert.equal(health.shouldAutoRecoverMicroApp(0, "https://api.example/micro-app/index.html"), true);
    assert.equal(health.shouldAutoRecoverMicroApp(1, "https://api.example/micro-app/index.html"), false);
    assert.equal(health.shouldAutoRecoverMicroApp(0, ""), false);
});

test("hosts use authenticated resolve and one diagnostic error component", () => {
    for (const file of ["host.vue", "dialog.vue"]) {
        const source = read(`src/views/micro-app/${file}`);
        assert.match(source, /runtime-error\.vue/);
        assert.match(source, /MicroApp\/Resolve/);
        assert.doesNotMatch(source, /GetTableData\(["']sys_microiservice["']/);
        assert.match(source, /probeEntry/);
        assert.match(source, /<head/);
        assert.match(source, /<body/);
    }

    const diagnostic = read("src/views/micro-app/runtime-error.vue");
    for (const detail of ["appKey", "pageKey", "routePath", "version", "entryUrl", "httpStatus", "publishStatus", "assetSource", "mountState", "reasonCode"]) {
        assert.match(diagnostic, new RegExp(detail));
    }
    assert.match(diagnostic, /重试/);
    assert.match(diagnostic, /返回上一页/);
    assert.match(diagnostic, /复制诊断/);
});

test("managed menu routes can use the stable entry only for safe compatibility failures", async () => {
    const utilitySource = read("src/utils/microAppEntryUrl.js");
    const utility = await import(`data:text/javascript;base64,${Buffer.from(utilitySource).toString("base64")}`);
    const canFallback = utility.shouldUseMicroAppResolveFallback;

    assert.equal(canFallback({ Code: 0, DataAppend: { TraceId: "trace" } }), true);
    assert.equal(canFallback(null), true);
    assert.equal(canFallback({ Code: 1001 }), false);
    assert.equal(canFallback({ Code: 0, Data: { ReasonCode: "TENANT_MISMATCH" } }), false);
    assert.equal(canFallback({ Code: 0, Data: { ReasonCode: "MICRO_APP_NOT_AVAILABLE" } }), false);
    assert.equal(canFallback({ Code: 0 }, { requirePage: true }), false);
    assert.equal(canFallback({ Code: 0 }, { requestedVersion: "v1.0.0" }), false);

    for (const file of ["host.vue", "dialog.vue"]) {
        const source = read(`src/views/micro-app/${file}`);
        assert.match(source, /shouldUseMicroAppResolveFallback/);
        assert.match(source, /managed-stable-entry/);
    }
});

test("host sizing and error ownership contracts avoid duplicate and viewport-specific failures", () => {
    for (const file of ["host.vue", "dialog.vue"]) {
        const source = read(`src/views/micro-app/${file}`);
        assert.match(source, /--micro-app-available-width/);
        assert.match(source, /--micro-app-available-height/);
        assert.match(source, /--micro-app-safe-area-bottom/);
        assert.match(source, /ResizeObserver/);
        assert.match(source, /host:resize/);
        assert.doesNotMatch(source, /calc\(100vh\s*-\s*100px\)/);
        assert.match(source, /handled/);
    }
});

test("page host derives height from the visible viewport instead of its collapsed tags parent", async () => {
    const utilitySource = read("src/utils/microAppViewport.js");
    const utility = await import(`data:text/javascript;base64,${Buffer.from(utilitySource).toString("base64")}`);
    const viewport = utility.resolveMicroAppHostViewport(
        { top: 68, width: 1362, height: 28 },
        { offsetTop: 0, height: 471 },
        471
    );

    assert.deepEqual(viewport, { width: 1362, height: 403, safeAreaBottom: 0 });

    const host = read("src/views/micro-app/host.vue");
    assert.match(host, /resolveMicroAppHostViewport/);
    assert.match(host, /host\.style\.height/);
    assert.match(host, /host\.style\.minHeight/);
    assert.doesNotMatch(host, /Math\.min\(rect\.height/);
    assert.match(host, /overflow:\s*auto/);
});

test("page host automatically heals one stuck first mount and then exposes a stable diagnostic", () => {
    const host = read("src/views/micro-app/host.vue");
    const health = read("src/views/micro-app/render-health.js");

    assert.match(host, /startMountWatchdog/);
    assert.match(host, /shouldAutoRecoverMicroApp\(this\.autoMountRetryCount,\s*this\.entryUrl\)/);
    assert.match(health, /Number\(retryCount\s*\|\|\s*0\)\s*<\s*1/);
    assert.match(host, /unmountApp\(this\.microAppName,\s*\{\s*destroy:\s*true,\s*clearData:\s*true\s*\}\)/);
    assert.match(host, /MICRO_APP_MOUNT_TIMEOUT/);
    assert.match(host, /micro-app:ready/);
    assert.match(host, /startContentWatchdog/);
    assert.match(host, /hasRenderableMicroAppContent/);
    assert.match(health, /app\.querySelector\("micro-app-body"\)[\s\S]{0,120}?app\.shadowRoot/);
    assert.match(health, /if\s*\(!body\)\s*return false/);
    assert.doesNotMatch(host, /hasContent\s*===\s*null/);
    assert.doesNotMatch(host, /if\s*\(this\.mountReadyGeneration\s*===\s*generation[\s\S]{0,180}?this\.markMicroAppReady/);
    assert.match(host, /MICRO_APP_CONTENT_EMPTY/);
    assert.match(host, /hostGeneration:\s*this\.resolveGeneration/);
    assert.match(host, /hostMountAttempt:\s*this\.retryKey/);
    assert.match(host, /readyAttempt\s*!==\s*this\.retryKey/);
    assert.match(host, /resolveGeneration/);
});

test("cached micro-app hosts only react while their own route is active", () => {
    const host = read("src/views/micro-app/host.vue");

    assert.match(host, /isHostActive:\s*true/);
    assert.match(host, /ownedRoutePath:\s*this\.\$route\?\.path/);
    assert.match(host, /activated\(\)\s*\{[\s\S]*?this\.isHostActive\s*=\s*true/);
    assert.match(host, /deactivated\(\)\s*\{[\s\S]*?this\.isHostActive\s*=\s*false/);
    assert.match(host, /if\s*\(!this\.isHostActive\s*\|\|\s*this\.\$route\?\.path\s*!==\s*this\.ownedRoutePath\)\s*return/);
    assert.match(host, /startViewportContract\(\)\s*\{\s*this\.stopViewportContract\(\)/);
    assert.doesNotMatch(host, /<micro-app[\s\S]*?\n\s+keep-alive\b/);
});
