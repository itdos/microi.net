import assert from "node:assert/strict";
import test from "node:test";

import { normalizeCurrentUserRoleLimits } from "../src/utils/current-user-state.js";

test("current user role permissions can be normalized repeatedly", () => {
    const user = {
        Id: "u1",
        _RoleLimits: [{ Permission: '["Add","Edit","Del"]' }]
    };

    const first = normalizeCurrentUserRoleLimits(user);
    const second = normalizeCurrentUserRoleLimits({ ...first, ThemeMode: "dark" });

    assert.deepEqual(first._RoleLimits[0].Permission, ["Add", "Edit", "Del"]);
    assert.deepEqual(second._RoleLimits[0].Permission, ["Add", "Edit", "Del"]);
    assert.equal(second.ThemeMode, "dark");
});

test("invalid or missing role permission snapshots fail closed without blocking user state", () => {
    const malformed = normalizeCurrentUserRoleLimits({
        Id: "u1",
        _RoleLimits: [{ Permission: "Add,Edit,Del" }, { Permission: null }]
    });
    const missing = normalizeCurrentUserRoleLimits({ Id: "u2" });

    assert.deepEqual(malformed._RoleLimits.map(item => item.Permission), [[], []]);
    assert.deepEqual(missing._RoleLimits, []);
});
