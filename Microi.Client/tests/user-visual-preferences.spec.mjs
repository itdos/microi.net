import assert from "node:assert/strict";
import test from "node:test";

import {
    normalizeUserMenuChildExpandMode,
    resolveUserMenuChildExpandMode,
    resolveUserThemeColor,
    resolveUserThemeMode
} from "../src/utils/user-visual-preferences.js";
import { resolveUserCornerStyle, resolveUserNavigationLayout, normalizeUserNavigationLayout } from "../src/utils/user-visual-preferences.js";

test("empty corner preference inherits the tenant, with round as the empty tenant default", () => {
    assert.equal(resolveUserCornerStyle({ Id: 'u1', CornerStyle: '' }, 'round', 'square'), 'square');
    assert.equal(resolveUserCornerStyle({ Id: 'u1', CornerStyle: 'System' }, 'square', ''), 'round');
    assert.equal(resolveUserCornerStyle({ Id: 'u1', CornerStyle: 'round' }, 'square', 'square'), 'round');
    assert.equal(resolveUserCornerStyle({ Id: 'u2', CornerStyle: '' }, 'square', ''), 'round');
    assert.equal(resolveUserCornerStyle({ Id: 'old-user' }, 'square', ''), 'square');
});

test("navigation placement follows the tenant unless the current user chooses a valid override", () => {
    assert.equal(normalizeUserNavigationLayout('TOP'), 'Top');
    assert.equal(normalizeUserNavigationLayout('unknown'), 'System');
    assert.equal(resolveUserNavigationLayout('System', 'Top'), 'Top');
    assert.equal(resolveUserNavigationLayout('', ''), 'Side');
    assert.equal(resolveUserNavigationLayout('Side', 'Top'), 'Side');
    assert.equal(resolveUserNavigationLayout('Top', 'Side'), 'Top');
    assert.equal(normalizeUserNavigationLayout('TOPSIDE'), 'TopSide');
    assert.equal(resolveUserNavigationLayout('System', 'TopSide'), 'TopSide');
    assert.equal(resolveUserNavigationLayout('TopSide', 'Side'), 'TopSide');
});

test("installed per-user theme values override device-local and system values", () => {
    assert.equal(
        resolveUserThemeColor({ Id: "u1", ThemeColor: "#12abef" }, "#111111", "#222222"),
        "#12abef"
    );
    assert.equal(
        resolveUserThemeColor({ Id: "u1", ThemeColor: "" }, "#111111", "#222222"),
        "#222222"
    );
    assert.equal(
        resolveUserThemeColor({ Id: "u1", ThemeColor: "" }, "#111111", "", "#333333"),
        "#333333"
    );
    assert.equal(resolveUserThemeMode({ Id: "u1", ThemeMode: "dark" }, "light", "light"), "dark");
    assert.equal(resolveUserThemeMode({ Id: "u1", ThemeMode: "" }, "light", "dark"), "dark");
    assert.equal(resolveUserThemeMode({ Id: "u1", ThemeMode: "" }, "dark", "", "light"), "light");
});

test("old tenants without preference columns retain the local compatibility fallback", () => {
    assert.equal(resolveUserThemeColor({ Id: "u1" }, "#111111", "#222222"), "#111111");
    assert.equal(resolveUserThemeMode({ Id: "u1" }, "dark", "light"), "dark");
    assert.equal(resolveUserThemeMode({ Id: "u1" }, "", "dark"), "dark");
});

test("menu expansion can follow the system or use a personal override", () => {
    assert.equal(normalizeUserMenuChildExpandMode("unknown"), "System");
    assert.equal(resolveUserMenuChildExpandMode("System", "Right"), "Right");
    assert.equal(resolveUserMenuChildExpandMode("Down", "Right"), "Down");
    assert.equal(resolveUserMenuChildExpandMode("Right", "Down"), "Right");
});
