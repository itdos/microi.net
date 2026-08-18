import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
    resolveSidebarSystemLogoUrl,
    resolveTenantBrandFallbackText
} from "../src/utils/login-branding.js";

test("子租户没有配置 Logo 时不会回退为吾码官方 Logo", () => {
    const officialFallback = "https://tenant.example/static/img/logo/itdos.svg";
    assert.equal(
        resolveSidebarSystemLogoUrl("", "lsg", (value) => value, officialFallback),
        ""
    );
    assert.equal(
        resolveSidebarSystemLogoUrl("", "iTdos", (value) => value, officialFallback),
        officialFallback
    );
});

test("子租户配置的各种 Logo 数据形态始终优先于官方缺省值", () => {
    const officialFallback = "/static/img/logo/itdos.svg";
    const serverPath = (value) => `https://static.example${value}`;
    assert.equal(
        resolveSidebarSystemLogoUrl(
            JSON.stringify([{ FilePathName: "lsg/logo.jpg" }]),
            "lsg",
            serverPath,
            officialFallback
        ),
        "https://static.example/lsg/logo.jpg"
    );
});

test("图片不可用时使用当前租户标题首字作为中性兜底", () => {
    assert.equal(resolveTenantBrandFallbackText("乐闪购", "LSG", "lsg"), "乐");
    assert.equal(resolveTenantBrandFallbackText("", "LSG", "lsg"), "L");
    assert.equal(resolveTenantBrandFallbackText("", "", ""), "M");
});

test("侧栏组件不再在 Logo 容器底层写死官方图片，并显式管理加载状态", () => {
    const source = fs.readFileSync(
        new URL("../src/layout/components/Sidebar/Logo.vue", import.meta.url),
        "utf8"
    );
    assert.doesNotMatch(source, /background\s*:\s*url\([^)]*itdos\.svg/i);
    assert.match(source, /backgroundImage:\s*this\.logoLoadReady\s*&&\s*this\.logoSource/);
    assert.match(source, /logoLoadReady\s*=\s*Boolean\([\s\S]*naturalWidth\s*>\s*0/);
    assert.match(source, /"\$route\.fullPath"\(\)[\s\S]*QueueSysLogoHealthCheck/);
    assert.match(source, /logoRetryAttempt\s*>=\s*2[\s\S]*logoLoadFailed\s*=\s*true/);
    assert.match(source, /RetrySysLogoLoad\(\)[\s\S]*logoSource\s*=\s*""[\s\S]*logoSource\s*=\s*configuredSource/);
    assert.doesNotMatch(source, /HandleSysLogoError[\s\S]{0,240}logoSource\s*=\s*LOCAL_LOGO_FALLBACK/);
});
