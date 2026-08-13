import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

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
    const friendlyRoute = router.slice(friendly, catchAll);
    assert.match(friendlyRoute, /microAppHost:\s*true/);
    assert.match(friendlyRoute, /microAppCacheMode:\s*["']runtime-keep-alive["']/);
    assert.match(friendlyRoute, /keepAlive:\s*false/);
    assert.match(router, /import MicroAppHost from ["']@\/views\/micro-app\/host\.vue["']/);
    assert.match(router, /name:\s*["']micro_app_friendly["'][\s\S]*?component:\s*MicroAppHost/);
    assert.doesNotMatch(router, /name:\s*["']micro_app_friendly["'][\s\S]{0,240}?component:\s*\(\)\s*=>\s*import/);
    const constantsFrozen = router.indexOf("const constantRouteNames = collectRouteNames(constantRoutes)");
    assert.ok(constantsFrozen > friendly, "friendly route must be registered before the router freezes constant route names");
    assert.ok(router.indexOf("export const asyncRoutes") > friendly, "friendly route must not wait for authenticated menu injection");

    const host = read("src/views/micro-app/host.vue");
    assert.match(host, /MicroApp\/Resolve/);
    assert.match(host, /const requirePage\s*=\s*this\.ownedRouteMeta\?\.microAppFriendlyRoute\s*===\s*true/);
    assert.match(host, /RequirePage:\s*requirePage/);
});

test("generated micro-app menu routes never cache a second Vue host lifecycle", () => {
    const permission = read("src/pinia/modules/permission.js");
    const appendMetaStart = permission.indexOf("function appendMicroAppMeta(meta, item)");
    const appendMetaEnd = permission.indexOf("\nfunction GetComponent", appendMetaStart);
    const appendMeta = permission.slice(appendMetaStart, appendMetaEnd);

    assert.ok(appendMetaStart >= 0, "dynamic menu metadata builder must exist");
    assert.match(appendMeta, /if\s*\(isMicroAppMenu\(item\)\)\s*\{/);
    assert.match(appendMeta, /meta\.keepAlive\s*=\s*false/);
    assert.match(appendMeta, /meta\.microAppHost\s*=\s*true/);
    assert.match(appendMeta, /meta\.microAppCacheMode\s*=\s*["']runtime-keep-alive["']/);
});

test("native micro-app cache keeps five LRU tab instances and destroys exact closed tabs", async (t) => {
    const originalWindow = globalThis.window;
    const destroyed = [];
    globalThis.window = {
        microApp: {
            unmountApp: async (name, options) => {
                destroyed.push({ name, options });
                return true;
            }
        },
        dispatchEvent: () => true
    };

    const cache = await import(`${pathToFileURL(path.join(root, "src/utils/microAppRuntimeCache.js")).href}?test=${Date.now()}`);
    t.after(() => {
        cache.resetMicroAppRuntimeCacheRegistry();
        globalThis.window = originalWindow;
    });

    for (let index = 1; index <= cache.MICRO_APP_RUNTIME_CACHE_LIMIT; index += 1) {
        cache.registerMicroAppRuntimeCache({ name: `app-${index}`, routeFullPath: `/route/${index}` });
        await cache.markMicroAppRuntimeHidden(`app-${index}`);
    }

    cache.registerMicroAppRuntimeCache({ name: "app-6", routeFullPath: "/route/6" });
    await cache.markMicroAppRuntimeHidden("app-6");
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.deepEqual(destroyed[0], {
        name: "app-1",
        options: { destroy: true, clearData: true }
    });
    assert.equal(cache.getMicroAppRuntimeCacheSnapshot().length, cache.MICRO_APP_RUNTIME_CACHE_LIMIT);

    await cache.releaseMicroAppRuntimeCacheForView({ fullPath: "/route/5" }, "tab-close");
    assert.equal(destroyed.some(item => item.name === "app-5"), true);
    assert.equal(cache.getMicroAppRuntimeCacheSnapshot().some(item => item.routeFullPath === "/route/5"), false);

    const identity = cache.createMicroAppRuntimeName({
        osClient: "tenant",
        appKey: "chemical-bid-management",
        menuId: "menu",
        routeFullPath: "/projects?secret=must-not-leak",
        version: "v1",
        entryUrl: "https://example.test/index.html?token=must-not-leak"
    });
    assert.ok(identity.length <= 64);
    assert.doesNotMatch(identity, /secret|token|must-not-leak/);
    assert.equal(identity, cache.createMicroAppRuntimeName({
        osClient: "tenant",
        appKey: "chemical-bid-management",
        menuId: "menu-hydrated-after-first-render",
        routeFullPath: "/projects?secret=must-not-leak",
        version: "v1",
        entryUrl: "https://example.test/index.html?token=must-not-leak"
    }), "late menu metadata must not change an existing fullPath runtime identity");
    assert.notEqual(identity, cache.createMicroAppRuntimeName({
        osClient: "tenant",
        appKey: "chemical-bid-management",
        routeFullPath: "/my-projects",
        version: "v1",
        entryUrl: "https://example.test/index.html?token=must-not-leak"
    }), "different fullPath values must still receive isolated runtimes");
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

test("menu, dialog and component hosts pass authenticated permission context without URL tokens", () => {
    const permission = read("src/pinia/modules/permission.js");
    assert.match(permission, /"DiyTableId",\s*"ModuleEngineKey",\s*"MicroServiceId"/);
    assert.match(permission, /meta\.ModuleEngineKey\s*=\s*item\.ModuleEngineKey/);

    for (const file of ["host.vue", "dialog.vue", "dev-component.vue"]) {
        const source = read(`src/views/micro-app/${file}`);
        assert.match(source, /permissionContext/);
        assert.match(source, /moduleEngineKey/);
        assert.match(source, /diyTableId/);
        assert.doesNotMatch(source, /[?&](?:token|authorization)=/i);
    }

    for (const file of ["diy-table-navigation.mixin.js", "diy-form-navigation.mixin.js"]) {
        const source = read(`src/views/form-engine/mixins/${file}`);
        assert.match(source, /OpenAppDialog\(param\)[\s\S]*?PermissionContext:\s*\{/);
        assert.match(source, /PermissionContext:[\s\S]*?sysMenuId:[\s\S]*?moduleEngineKey:[\s\S]*?diyTableId:/);
    }
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
    const hostRule = host.match(/\.micro-app-host\s*\{([\s\S]*?)\n\}/)?.[1] || "";
    const appRule = host.match(/\.micro-app-host__app\s*\{([\s\S]*?)\n\}/)?.[1] || "";
    assert.match(hostRule, /overflow:\s*hidden/);
    assert.match(appRule, /overflow-x:\s*auto/);
    assert.match(appRule, /overflow-y:\s*auto/);
    assert.match(appRule, /overscroll-behavior:\s*contain/);
    assert.match(host, /contain:\s*layout paint/);
    assert.match(host, /isolation:\s*isolate/);
});

test("page host automatically heals one stuck first mount and then exposes a stable diagnostic", () => {
    const host = read("src/views/micro-app/host.vue");
    const health = read("src/views/micro-app/render-health.js");
    const mountWatchdog = host.indexOf("startMountWatchdog(generation, attempt = this.retryKey)");
    const visibleContentGuard = host.indexOf("if (this.hasRenderableMicroAppContent() === true)", mountWatchdog);
    const mountTimeoutRecovery = host.indexOf('this.recoverMountFailure("微服务首次挂载超时', mountWatchdog);

    assert.match(host, /startMountWatchdog/);
    assert.ok(mountWatchdog >= 0, "mount watchdog must track the current mount attempt");
    assert.ok(visibleContentGuard > mountWatchdog, "mount watchdog must inspect real DOM even when lifecycle signals are missing");
    assert.ok(mountTimeoutRecovery > visibleContentGuard, "a visibly rendered micro-app must be accepted before timeout recovery can destroy it");
    assert.ok(host.includes("attempt !== this.retryKey"));
    assert.match(host, /this\.mountWatchdog\s*=\s*setTimeout\(inspect,\s*250\)/);
    assert.match(host, /this\.hasRenderableMicroAppContent\(\)\s*===\s*true[\s\S]{0,120}?this\.markMicroAppReady\(\)/);
    assert.match(host, /shouldAutoRecoverMicroApp\(this\.autoMountRetryCount,\s*this\.entryUrl\)/);
    assert.match(health, /Number\(retryCount\s*\|\|\s*0\)\s*<\s*1/);
    assert.match(host, /destroyMicroAppRuntimeCache\(this\.microAppName,\s*["']host-recovery["']\)/);
    const cache = read("src/utils/microAppRuntimeCache.js");
    assert.match(cache, /unmountApp\(normalizedName,\s*\{\s*destroy:\s*true,\s*clearData:\s*true\s*\}\)/);
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

test("menu micro-apps use one native cache owner and immutable fullPath host identities", () => {
    const host = read("src/views/micro-app/host.vue");
    const appMain = read("src/layout/components/AppMain.vue");
    const tagsView = read("src/pinia/modules/tagsView.js");
    const user = read("src/pinia/modules/user.js");

    assert.match(host, /isHostActive:\s*true/);
    assert.match(host, /const route\s*=\s*this\.\$route\s*\|\|\s*\{\}/);
    assert.match(host, /ownedRoutePath:\s*route\.path/);
    assert.match(host, /ownedRouteFullPath:\s*route\.fullPath/);
    assert.match(host, /<micro-app[\s\S]*?\n\s+keep-alive\b/);
    assert.match(host, /@beforeshow=["']handleBeforeShow["']/);
    assert.match(host, /@aftershow=["']handleAfterShow["']/);
    assert.match(host, /@afterhidden=["']handleAfterHidden["']/);
    assert.match(host, /forceSetData\(this\.microAppName,\s*data\)/);
    assert.match(host, /createMicroAppRuntimeName/);
    assert.match(host, /startViewportContract\(\)\s*\{\s*this\.stopViewportContract\(\)/);
    assert.doesNotMatch(host, /\$route\.fullPath\s*:/);

    assert.match(appMain, /microAppHost\s*===\s*true[\s\S]*?\$route\.fullPath/);
    assert.match(tagsView, /releaseMicroAppRuntimeCacheForView/);
    assert.match(tagsView, /view\.meta\?\.microAppHost\s*===\s*true\s*\|\|\s*view\.meta\?\.keepAlive\s*===\s*false/);
    assert.match(tagsView, /visited-view-limit/);
    assert.match(tagsView, /close-other-tabs/);
    assert.match(tagsView, /close-all-tabs/);
    assert.match(user, /clearMicroAppRuntimeCache\(["']logout["']\)/);
    assert.match(user, /clearMicroAppRuntimeCache\(["']token-reset["']\)/);
    assert.match(user, /clearMicroAppRuntimeCache\(["']role-change["']\)/);
});
