import assert from "node:assert/strict";
import test from "node:test";

import {
    normalizeUserMenuChildExpandMode,
    resolveUserMenuChildExpandMode,
    resolveUserThemeColor,
    resolveUserThemeMode
} from "../src/utils/user-visual-preferences.js";

test("installed per-user theme values override device-local and system values", () => {
    assert.equal(
        resolveUserThemeColor({ Id: "u1", ThemeColor: "#12abef" }, "#111111", "#222222"),
        "#12abef"
    );
    assert.equal(
        resolveUserThemeColor({ Id: "u1", ThemeColor: "" }, "#111111", "#222222"),
        "#222222"
    );
    assert.equal(resolveUserThemeMode({ Id: "u1", ThemeMode: "dark" }, "light"), "dark");
    assert.equal(resolveUserThemeMode({ Id: "u1", ThemeMode: "" }, "dark"), "light");
});

test("old tenants without preference columns retain the local compatibility fallback", () => {
    assert.equal(resolveUserThemeColor({ Id: "u1" }, "#111111", "#222222"), "#111111");
    assert.equal(resolveUserThemeMode({ Id: "u1" }, "dark"), "dark");
});

test("menu expansion can follow the system or use a personal override", () => {
    assert.equal(normalizeUserMenuChildExpandMode("unknown"), "System");
    assert.equal(resolveUserMenuChildExpandMode("System", "Right"), "Right");
    assert.equal(resolveUserMenuChildExpandMode("Down", "Right"), "Down");
    assert.equal(resolveUserMenuChildExpandMode("Right", "Down"), "Right");
});
