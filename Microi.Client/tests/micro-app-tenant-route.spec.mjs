import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { parse as parseJs } from "@babel/parser";
import { createRouter, createMemoryHistory } from "vue-router";
import { buildMicroAppFriendlyPath, parseMicroAppPath, assertMicroAppTenant } from "../src/router/micro-app-route.js";
import { buildMicroAppRouteAliases, resolveMicroAppMenuPaths } from "../src/router/micro-app-route-alias.js";
import { resolveSaasPublicTrialHostConfig } from "../src/views/micro-app/saas-public-trial-route.js";
import { createMicroAppRuntimeName } from "../src/utils/microAppRuntimeCache.js";
import * as entryHelpers from "../src/utils/microAppEntryUrl.js";

const read = file => fs.readFileSync(new URL("../" + file, import.meta.url), "utf8");
const tenant = "loctek";
const parse = (value, options = {}) => parseMicroAppPath(value, { osClient: tenant, ...options });
const plain = value => JSON.parse(JSON.stringify(value));

function createHost() {
    const source = read("src/views/micro-app/host.vue").match(/<script>([\s\S]*?)<\/script>/)[1];
    const ast = parseJs(source, { sourceType: "module" });
    const exported = ast.program.body.find(node => node.type === "ExportDefaultDeclaration").declaration;
    const methods = exported.properties.find(node => node.key.name === "methods").value.properties;
    const wanted = ["extractRouteConfig", "resolveManagedRuntime"];
    const methodSource = methods.filter(node => wanted.includes(node.key.name)).map(node => source.slice(node.start, node.end)).join(",\n");
    const helpers = ast.program.body.filter(node => node.type === "FunctionDeclaration"
        && ["safeDecode", "parseQueryString", "normalizeMicroRoutePath", "parseMicroAppPath", "removeMicroRouteQuery", "parseJsonObject"].includes(node.id.name));
    const calls = [];
    const context = {
        URL, URLSearchParams, window: { location: { origin: "http://localhost:61500" } },
        DiyCommon: { IsNull: value => value == null || value === "", GetOsClient: () => tenant,
            GetApiBase: () => "https://api.example.com",
            PostAsync: async (url, body) => {
                calls.push({ url, body: plain(body) });
                return { Code: 1, Data: { EntryUrl: "/micro-app/loctek/microi-3d-engine/index.html", Page: { PageKey: "designer" } } };
            } },
        parseMicroAppRoute: parseMicroAppPath, assertMicroAppTenant, resolveSaasPublicTrialHostConfig,
        ...entryHelpers
    };
    const implementation = vm.runInNewContext(helpers.map(node => source.slice(node.start, node.end)).join("\n")
        + "\n({" + methodSource + "})", context);
    return { implementation, calls };
}

test("canonical routes carry the tenant and decode nested paths once", () => {
    const path = buildMicroAppFriendlyPath({ osClient: tenant, appKey: "microi-3d-engine", routePath: "/设计/设备 A?mode=edit&mode=view#detail" });
    assert.equal(path, "/micro-app/loctek/microi-3d-engine/%E8%AE%BE%E8%AE%A1/%E8%AE%BE%E5%A4%87%20A?mode=edit&mode=view#detail");
    const result = parse(path);
    assert.equal(result.appKey, "microi-3d-engine");
    assert.equal(result.osClient, tenant);
    assert.equal(result.routePath, "/设计/设备 A");
    assert.equal(result.isTenantScoped, true);
    assert.equal(parse("http://client.example/?OsClient=loctek#" + path).routePath, "/设计/设备 A");
    assert.equal(parse(buildMicroAppFriendlyPath({ osClient: tenant, appKey: "app" })).routePath, "/");
});

test("legacy AppKey, MsKey and service Id deep links survive without menu metadata", () => {
    for (const key of ["microi-3d-engine", "service-ms-key", "01ABCDEF", tenant]) {
        const root = parse(`/micro-app/${key}`);
        assert.equal(root.appKey, key);
        assert.equal(root.routePath, "/");
    }
    for (const key of ["microi-3d-engine", "service-ms-key", "01ABCDEF"]) {
        const result = parse(`/micro-app/${key}/internal/hidden/details`);
        assert.equal(result.appKey, key);
        assert.equal(result.routePath, "/internal/hidden/details");
        assert.equal(result.osClient, "");
    }
    const ambiguous = parse(`/micro-app/${tenant}/designer/details`, { appKeyHint: tenant, routePathHint: "/designer/details" });
    assert.equal(ambiguous.appKey, tenant);
    assert.equal(ambiguous.routePath, "/designer/details");
    assert.equal(ambiguous.isTenantScoped, false);
    const sameKey = parse(`/micro-app/${tenant}/${tenant}/designer`, { appKeyHint: tenant, routePathHint: "/designer" });
    assert.equal(sameKey.appKey, tenant);
    assert.equal(sameKey.routePath, "/designer");
    assert.equal(sameKey.isTenantScoped, true);
});

test("static index.html coordinates and explicit scoped tenants are validated", () => {
    const stable = parse("https://api.example/micro-app/loctek/app/index.html?v=v2&microRoute=%2Fdesigner");
    assert.equal(stable.appKey, "app");
    assert.equal(stable.version, "v2");
    assert.equal(stable.routePath, "/designer");
    assert.equal(parse("/micro-app/loctek/app/v1.9.0/index.html").version, "v1.9.0");
    assert.doesNotThrow(() => assertMicroAppTenant(stable, tenant));
    for (const result of [parse("/micro-app/foreign/app/index.html"), parse("/micro-app/foreign/app/designer", { format: "scoped" }),
        parse("/micro-app/foreign/app/designer", { appKeyHint: "app", routePathHint: "/designer" })]) {
        assert.throws(() => assertMicroAppTenant(result, tenant), error => error.reasonCode === "TENANT_MISMATCH");
    }
    // 无明确格式标记的歧义路径保留旧语义，始终不改变请求租户。
    const legacy = parse("/micro-app/foreign/hidden/details");
    assert.equal(legacy.appKey, "foreign");
    assert.equal(legacy.osClient, "");
});

test("tenant matching ignores case while preserving application key spelling and legacy hints", () => {
    for (const input of ["/micro-app/itdos/MixedCaseApp/designer", "/micro-app/ITDOS/MixedCaseApp/index.html", "/micro-app/itdos/MixedCaseApp/v1/index.html"]) {
        const result = parseMicroAppPath(input, { osClient: "iTdos" });
        assert.equal(result.isTenantScoped, true);
        assert.equal(result.appKey, "MixedCaseApp");
        assert.doesNotThrow(() => assertMicroAppTenant(result, "iTdos"));
    }
    const root = parseMicroAppPath("/micro-app/itdos", { osClient: "iTdos" });
    assert.equal(root.isTenantScoped, false);
    assert.equal(root.appKey, "itdos");
    const legacy = parseMicroAppPath("/micro-app/itdos/internal/details", {
        osClient: "iTdos", appKeyHint: "itdos", routePathHint: "/internal/details"
    });
    assert.equal(legacy.isTenantScoped, false);
    assert.equal(legacy.appKey, "itdos");
    assert.equal(legacy.routePath, "/internal/details");
    const foreign = parseMicroAppPath("/micro-app/iTdos2/MixedCaseApp/designer", { osClient: "iTdos", format: "scoped" });
    assert.throws(() => assertMicroAppTenant(foreign, "iTdos"), error => error.reasonCode === "TENANT_MISMATCH");
});

test("real host path coordinates win over stale metadata and query overrides", async () => {
    const { implementation, calls } = createHost();
    const host = { ownedRoutePath: "/micro-app/loctek/microi-3d-engine/designer", ownedRouteFullPath: "/micro-app/loctek/microi-3d-engine/designer?mode=edit",
        ownedRouteMeta: { microAppFriendlyRoute: true, AppKey: "stale-app", RoutePath: "/stale", Url: "/micro-app/stale-app/stale" },
        ownedRouteQuery: { OsClient: "foreign", appKey: "evil", routePath: "/wrong", src: "https://evil.example/index.html", urlApiEngineId: "evil" } };
    const config = implementation.extractRouteConfig.call(host);
    assert.equal(config.appKey, "microi-3d-engine");
    assert.equal(config.microRoutePath, "/designer");
    assert.equal(config.microAppUrl, "");
    assert.equal(config.urlApiEngineId, "");
    await implementation.resolveManagedRuntime.call(host, config);
    assert.deepEqual(calls, [{ url: "/api/MicroApp/Resolve", body: { OsClient: tenant, AppKey: "microi-3d-engine", Version: "",
        RoutePath: "/designer", RequirePage: true, IncludePageMetadata: false } }]);
    host.ownedRoutePath = "/micro-app/foreign/app/index.html";
    assert.throws(() => implementation.extractRouteConfig.call(host), error => error.reasonCode === "TENANT_MISMATCH");
    assert.equal(calls.length, 1, "mismatched tenant must fail before making a request");
    host.ownedRoutePath = "/micro-app/foreign/microi-platform-service/saas-trial";
    host.ownedRouteMeta = { saasPublicTrial: true, microAppRouteFormat: "scoped" };
    assert.throws(() => implementation.extractRouteConfig.call(host), error => error.reasonCode === "TENANT_MISMATCH");
    host.ownedRoutePath = "/micro-app/foreign/internal/hidden/details";
    host.ownedRouteMeta = { microAppFriendlyRoute: true };
    host.ownedRouteQuery = {};
    const legacy = implementation.extractRouteConfig.call(host);
    await implementation.resolveManagedRuntime.call(host, legacy);
    assert.equal(calls.at(-1).body.OsClient, tenant);
    assert.equal(calls.at(-1).body.AppKey, "foreign");
    assert.equal(calls.at(-1).body.RoutePath, "/internal/hidden/details");
});

test("real menu builder generates tenant coordinates for both stored URL formats", () => {
    const source = read("src/pinia/modules/permission.js");
    const ast = parseJs(source, { sourceType: "module" });
    const functions = ast.program.body.filter(node => node.type === "FunctionDeclaration"
        && ["safeDecode", "normalizeMicroRoutePath", "parseMicroAppUrl", "buildMicroAppMenuPath"].includes(node.id.name));
    const build = vm.runInNewContext(functions.map(node => source.slice(node.start, node.end)).join("\n") + "\nbuildMicroAppMenuPath", {
        window: { location: { origin: "http://localhost:61500" } },
        DiyCommon: { IsNull: value => value == null || value === "", GetOsClient: () => tenant, GuidRemoveSing: value => String(value || "").replace(/[-{}]/g, "") },
        buildMicroAppFriendlyPath, parseMicroAppPath, assertMicroAppTenant
    });
    for (const Url of ["/micro-app/microi-3d-engine/designer", "/micro-app/loctek/microi-3d-engine/designer"]) {
        assert.equal(build({ Url, MicroServiceKey: "microi-3d-engine", MicroServiceRoutePath: "/designer" }), "/micro-app/loctek/microi-3d-engine/designer");
    }
    assert.equal(build({ Url: "/micro-app/loctek", MicroServiceKey: "loctek", MicroServiceRoutePath: "/" }), "/micro-app/loctek/loctek");
    assert.equal(build({ Url: "/micro-app/loctek/designer/details", MicroServiceKey: "loctek", MicroServiceRoutePath: "/designer/details" }), "/micro-app/loctek/loctek/designer/details");
});

test("compatibility redirects wait for tenant bootstrap and preserve query/hash", async () => {
    const source = read("src/router/index.js");
    const ast = parseJs(source, { sourceType: "module" });
    const records = ast.program.body.filter(node => node.type === "ExportNamedDeclaration"
        && ["constantRoutes", "asyncRoutes"].includes(node.declaration?.declarations?.[0]?.id?.name))
        .flatMap(node => node.declaration.declarations[0].init.elements);
    for (const expected of [{ path: "/ai-workflow", suffix: "/relationship" }, { path: "/blueprint/designer/:id", suffix: "/designer/123" }]) {
        const node = records.find(node => node?.properties?.some(prop => prop.key.name === "path" && prop.value.value === expected.path));
        let currentTenant = "stale-tenant";
        let ready;
        const pending = new Promise(resolve => { ready = resolve; });
        const route = vm.runInNewContext("(" + source.slice(node.start, node.end) + ")", {
            buildMicroAppFriendlyPath, DiyCommon: { GetOsClient: () => currentTenant }, waitForPlatformBootstrap: () => pending
        });
        const result = route.beforeEnter({ params: { id: "123" }, query: { record: "1" }, hash: "#detail" });
        currentTenant = tenant;
        ready(true);
        const target = await result;
        assert.equal(target.path, "/micro-app/loctek/microi-ai-workflow" + expected.suffix);
        assert.deepEqual(plain(target.query), { record: "1" });
        assert.equal(target.hash, "#detail");
        assert.equal(target.replace, true);
    }
});

test("real static router recognizes scoped and old multi-level links on first refresh", async () => {
    const source = read("src/router/index.js");
    const ast = parseJs(source, { sourceType: "module" });
    const constantRoutes = ast.program.body.find(node => node.type === "ExportNamedDeclaration"
        && node.declaration?.declarations?.[0]?.id?.name === "constantRoutes").declaration.declarations[0].init;
    const routeSources = constantRoutes.elements.filter(node => node?.properties?.some(prop => prop.key.name === "path" && prop.value.value?.startsWith("/micro-app/")))
        .map(node => source.slice(node.start, node.end));
    const routes = vm.runInNewContext("[" + routeSources.join(",") + "]", { Layout: {}, MicroAppHost: {} });
    const router = createRouter({ history: createMemoryHistory(), routes });
    for (const path of ["/micro-app/loctek/microi-3d-engine/designer", "/micro-app/loctek/app", "/micro-app/loctek/app/a/b", "/micro-app/app/internal/hidden/details", "/micro-app/01ABCDEF"]) {
        await router.push(path);
        assert.ok(router.currentRoute.value.matched.length > 0, path);
        assert.equal(router.currentRoute.value.meta.microAppFriendlyRoute, true);
        assert.equal(router.currentRoute.value.meta.keepAlive, false);
        assert.ok(parse(path).appKey);
    }
    assert.equal(router.resolve("/micro-app/loctek/microi-platform-service/saas-trial").meta.saasPublicTrial, true);
    assert.equal(router.resolve("/micro-app/loctek/microi-platform-service/system-settings").meta.anonymous, undefined);
});

test("menu aliases keep canonical, old keys and Ids on the same route record", () => {
    const primaryPath = buildMicroAppFriendlyPath({ osClient: tenant, appKey: "app", routePath: "/a/b" });
    const alias = buildMicroAppRouteAliases({ primaryPath, friendlyPath: primaryPath, osClient: tenant, appKey: "app", serviceId: "01ABC", routePath: "/a/b" });
    assert.deepEqual(alias, ["/micro-app/app/a/b", "/micro-app/01ABC/a/b", "/micro-app/loctek/01ABC/a/b"]);
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: primaryPath, alias, name: "test-menu", component: {}, meta: { Id: "menu-1" } }] });
    for (const path of [primaryPath, ...alias]) {
        assert.equal(router.resolve(path).name, "test-menu");
        assert.equal(router.resolve(path).meta.Id, "menu-1");
    }
    assert.equal(resolveMicroAppMenuPaths({ menuUrl: "/legacy/page", friendlyPath: primaryPath }).primaryPath, "/legacy/page");
    assert.equal(resolveMicroAppMenuPaths({ menuUrl: "/micro-app/app/a/b", friendlyPath: primaryPath }).primaryPath, primaryPath);
});

test("TagsView runtime fingerprints remain isolated by tenant, app and fullPath", () => {
    const coordinates = { osClient: tenant, appKey: "app", routeFullPath: "/micro-app/loctek/app/a?record=1", version: "v1", entryUrl: "/index.html" };
    const name = createMicroAppRuntimeName(coordinates);
    assert.equal(name, createMicroAppRuntimeName({ ...coordinates }));
    for (const change of [{ osClient: "foreign" }, { appKey: "other" }, { routeFullPath: "/micro-app/loctek/app/a?record=2" }]) {
        assert.notEqual(name, createMicroAppRuntimeName({ ...coordinates, ...change }));
    }
});
