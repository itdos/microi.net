import assert from "node:assert/strict";
import test from "node:test";

import {
    buildMacDesktopPages,
    normalizeMacScreenCount
} from "../src/views/webos/utils/desktop-menu-layout.js";

test("macOS desktop restores the configured screen count and honors each menu screen index", () => {
    const pages = buildMacDesktopPages([
        { Id: "home", Name: "首页", MacScreenIndex: 0 },
        {
            Id: "widgets",
            Name: "WebOS",
            _Child: [
                { Id: "clock", Name: "时间", IconComponent: "/today.vue" },
                { Id: "weather", Name: "天气", IconComponent: "/weather.vue" },
                { Id: "assistant", Name: "AI助手", MacScreenIndex: 2 }
            ]
        },
        { Id: "engine", Name: "系统引擎", MacScreenIndex: 2 },
        { Id: "calculator", Name: "税费计算", MacScreenIndex: "3" },
        { Id: "outside", Name: "越界菜单", MacScreenIndex: 9 }
    ], 6);

    assert.equal(pages.length, 6);
    assert.deepEqual(pages.map(page => page.ScreenId), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(pages[0].List.map(item => item.Id), ["home", "clock", "weather"]);
    assert.deepEqual(pages[1].List.map(item => item.Id), ["assistant", "engine"]);
    assert.deepEqual(pages[2].List.map(item => item.Id), ["calculator"]);
    assert.deepEqual(pages.slice(3).map(page => page.List), [[], [], []]);
    assert.equal(pages[0].List[1]._WebosWidgetContainerId, "widgets");
});

test("invalid desktop screen counts safely fall back to one bounded screen", () => {
    assert.equal(normalizeMacScreenCount(undefined), 1);
    assert.equal(normalizeMacScreenCount(0), 1);
    assert.equal(normalizeMacScreenCount("6"), 6);
    assert.equal(normalizeMacScreenCount(999), 20);
});
