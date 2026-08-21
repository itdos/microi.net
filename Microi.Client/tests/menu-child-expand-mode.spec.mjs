import assert from "node:assert/strict";
import test from "node:test";

import {
    MENU_CHILD_EXPAND_MODE,
    isRightMenuChildExpandMode,
    normalizeMenuChildExpandMode
} from "../src/layout/components/Sidebar/menu-child-expand-mode.mjs";

test("menu child expansion keeps the historical downward mode by default", () => {
    for (const value of [undefined, null, "", "Down", "down", "unsupported"]) {
        assert.equal(normalizeMenuChildExpandMode(value), MENU_CHILD_EXPAND_MODE.DOWN);
        assert.equal(isRightMenuChildExpandMode(value), false);
    }
});

test("menu child expansion accepts the persisted Right value", () => {
    for (const value of ["Right", " right ", "flyout", "horizontal", "向右展开"]) {
        assert.equal(normalizeMenuChildExpandMode(value), MENU_CHILD_EXPAND_MODE.RIGHT);
        assert.equal(isRightMenuChildExpandMode(value), true);
    }
});
