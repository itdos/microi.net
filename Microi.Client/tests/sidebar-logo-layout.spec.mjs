import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { resolveSidebarLogoLayout } from "../src/utils/sidebar-logo-layout.js";

test("image-only logo respects 80px height and uses available width instead of an icon square", () => {
    assert.deepEqual(resolveSidebarLogoLayout(80, true, false), { width: "100%", height: "80px", containerHeight: "96px" });
    assert.deepEqual(resolveSidebarLogoLayout("80px", true, false), resolveSidebarLogoLayout(80, true, false));
});
test("icon/title and collapsed modes retain compact, valid pixel dimensions", () => {
    assert.equal(resolveSidebarLogoLayout(80, false, false).width, "80px");
    assert.deepEqual(resolveSidebarLogoLayout(80, true, true), { width: "40px", height: "40px", containerHeight: "63px" });
});
test("empty, invalid and unbounded logo dimensions have safe defaults", () => {
    for (const value of [null, "", "NaN", -1, 0, "80%; position:fixed", Infinity]) {
        assert.equal(resolveSidebarLogoLayout(value, false, false).height, "40px");
    }
    assert.equal(resolveSidebarLogoLayout(10000, false, false).height, "240px");
});

test("logo link includes its horizontal padding before global styles finish loading", () => {
    const source = fs.readFileSync(new URL("../src/layout/components/Sidebar/Logo.vue", import.meta.url), "utf8");
    assert.match(source, /\.sidebar-logo-microi-link\s*\{[^}]*box-sizing:\s*border-box/);
    assert.match(source, /\.sidebar-logo-microi-shell\s*\{[^}]*max-width:\s*100%/);
});
