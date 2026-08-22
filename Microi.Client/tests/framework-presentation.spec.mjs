import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
    renderFrameworkWatermarkContent,
    resolveFrameworkWatermarkSettings,
    resolveMenuRenderSource,
    resolveRouteRenderSource
} from "../src/utils/framework-presentation.js";

const read = relativePath => readFile(new URL(relativePath, import.meta.url), "utf8");

test("route and menu sources distinguish microservices from explicit custom paths", () => {
    assert.equal(resolveMenuRenderSource({ OpenType: "MicroService" }), "microservice");
    assert.equal(resolveMenuRenderSource({ ComponentPath: "/micro-app/host" }), "microservice");
    assert.equal(resolveMenuRenderSource({ ComponentPath: "/views/custom/order-board.vue" }), "custom");
    assert.equal(resolveMenuRenderSource({ ComponentPath: "/diy/diy-table" }), "");
    assert.equal(resolveRouteRenderSource({ microAppHost: true }), "microservice");
    assert.equal(resolveRouteRenderSource({ RenderSourceType: "CustomComponent" }), "custom");
});

test("framework watermark is opt-in, token-aware and bounded for readability", () => {
    const now = new Date(2026, 7, 22, 9, 5);
    assert.equal(resolveFrameworkWatermarkSettings({}, { SysTitle: "吾码" }, now).enabled, false);
    assert.equal(
        renderFrameworkWatermarkContent("$SysTitle$ · $UserName$ · $DateTime$", {
            SysTitle: "骏驰",
            UserName: "管理员"
        }, now),
        "骏驰 · 管理员 · 2026-08-22 09:05"
    );
    assert.equal(
        renderFrameworkWatermarkContent("", { SysTitle: "骏驰", UserName: "", Account: "admin" }, now),
        "骏驰 - admin"
    );
    assert.equal(
        renderFrameworkWatermarkContent("$SysTitle$ - $UserName$", {
            SysTitle: "骏驰",
            UserName: "   ",
            Name: "不能作为回退值",
            Account: "admin"
        }, now),
        "骏驰 - admin"
    );
    assert.equal(
        renderFrameworkWatermarkContent("$SysTitle$ - $UserName$", {
            SysTitle: "骏驰",
            UserName: "undefined",
            Account: "null"
        }, now),
        "骏驰"
    );
    assert.equal(
        renderFrameworkWatermarkContent("", { SysTitle: "骏驰", UserName: "", Account: "" }, now),
        "骏驰"
    );
    const defaults = resolveFrameworkWatermarkSettings({
        FrameworkWatermarkEnabled: 1,
        FrameworkWatermarkOpacity: 0,
        FrameworkWatermarkFontSize: 0
    }, { SysTitle: "骏驰", Account: "admin" }, now);
    assert.equal(defaults.content, "骏驰 - admin");
    assert.equal(defaults.opacityPercent, 30);
    assert.equal(defaults.fontSize, 14);
    assert.equal(defaults.direction, "DiagonalUp");
    assert.equal(defaults.density, "Comfortable");
    const settings = resolveFrameworkWatermarkSettings({
        FrameworkWatermarkEnabled: 1,
        FrameworkWatermarkContent: "{{SysShortTitle}} | {{Account}}",
        FrameworkWatermarkDirection: "DiagonalDown",
        FrameworkWatermarkDensity: "Sparse",
        FrameworkWatermarkOpacity: 99,
        FrameworkWatermarkFontSize: 4
    }, {
        SysShortTitle: "JC",
        Account: "admin"
    }, now);
    assert.equal(settings.enabled, true);
    assert.equal(settings.content, "JC | admin");
    assert.equal(settings.rotate, 22);
    assert.equal(settings.density, "Sparse");
    assert.equal(settings.opacityPercent, 99);
    assert.equal(settings.fontSize, 8);
});

test("framework hosts own permanent, inspectable source badges and the watermark", async () => {
    const [app, appMain, host, dialog, devComponent, table, pageWidget, badge, watermark, cache] = await Promise.all([
        read("../src/App.vue"),
        read("../src/layout/components/AppMain.vue"),
        read("../src/views/micro-app/host.vue"),
        read("../src/views/form-engine/diy-custom-dialog.vue"),
        read("../src/views/form-engine/diy-field-component/diy-devcomponent.vue"),
        read("../src/views/form-engine/diy-table.vue"),
        read("../src/views/page-engine/engine/components/form-designer/widget/common-widget.vue"),
        read("../src/components/MciRenderSourceBadge/index.vue"),
        read("../src/components/MciFrameworkWatermark/index.vue"),
        read("../src/utils/dynamicComponentCache.js")
    ]);
    assert.match(app, /<MciFrameworkWatermark\s*\/>/u);
    assert.match(appMain, /routeRenderSource === 'custom'[\s\S]*dismissible/u);
    assert.match(host, /<MciRenderSourceBadge[\s\S]*type="microservice"[\s\S]*dismissible[\s\S]*renderSourceInfo/u);
    assert.match(dialog, /renderSourceType[\s\S]*isMicroAppDialog \? "microservice" : "custom"/u);
    assert.match(devComponent, /resolveDevComponentRenderSource/u);
    assert.match(table, /field\.Component === 'DevComponent'[\s\S]*GetDevComponentRenderSource/u);
    assert.match(pageWidget, /Number\(widgetObj\.category\) === 1[\s\S]*type="custom"/u);
    assert.doesNotMatch(badge, /collapseDelay|is-collapsed|RenderSourceBadgeMode/u);
    assert.match(badge, /data-render-source-details/u);
    assert.match(badge, /data-render-source-dismiss/u);
    assert.match(badge, /cursor:\s*pointer/u);
    assert.match(badge, /border-radius:\s*24px/u);
    assert.match(badge, /prefers-reduced-motion/u);
    assert.match(watermark, /width:\s*100vw/u);
    assert.match(watermark, /height:\s*100vh/u);
    assert.match(watermark, /pointer-events:\s*none/u);
    assert.match(cache, /renderSource = 'microservice'/u);
    assert.match(cache, /_sourceCache/u);
});
