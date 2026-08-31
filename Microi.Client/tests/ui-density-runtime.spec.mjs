import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
    buildUiDensityVariables,
    normalizeUiDensityScale,
} from "../src/utils/ui-density.js";

test("界面密度只允许安全的 90%-110% 五档，并同步字体、控件和间距", () => {
    assert.equal(normalizeUiDensityScale(null), 100, "首次使用且没有本地设置时必须保持标准密度");
    assert.equal(normalizeUiDensityScale(""), 100);
    assert.equal(normalizeUiDensityScale(87), 90);
    assert.equal(normalizeUiDensityScale(103), 105);
    assert.equal(normalizeUiDensityScale(999), 110);

    const compact = buildUiDensityVariables(90);
    const standard = buildUiDensityVariables(100);
    const large = buildUiDensityVariables(110);
    assert.ok(parseFloat(compact["--el-font-size-base"]) < parseFloat(standard["--el-font-size-base"]));
    assert.ok(parseFloat(large["--el-component-size"]) > parseFloat(standard["--el-component-size"]));
    assert.ok(parseFloat(large["--mci-space-4"]) > parseFloat(standard["--mci-space-4"]));
    assert.equal(parseFloat(compact["--mci-touch-target"]), 44, "紧凑模式也不能破坏触屏最小点击区域");
});

test("顶栏提供全局密度入口，启动时先恢复用户选择", () => {
    const navbar = readFileSync(new URL("../src/layout/components/Navbar.vue", import.meta.url), "utf8");
    const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
    assert.match(navbar, /<UiDensitySelect class="right-menu-item hover-effect"\s*\/?>/);
    assert.match(main, /initializeUiDensity\(\)/);
    assert.match(main, /styles\/ui-density\.scss/);
});
