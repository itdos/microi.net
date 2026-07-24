import assert from "node:assert/strict";
import test from "node:test";

import {
    applyLegacySysMenuConfigFallback,
    legacySysMenuConfigFields
} from "../src/utils/sys-menu-legacy-compat.js";

test("legacy DiyConfig fills blank v6 physical menu fields", function () {
    const menu = {
        SelectApi: "",
        HiddenIndex: null,
        DiyConfig: JSON.stringify({
            SelectApi: "https://api.itdos.com/apiengine/get-microi-store-list?OsClient=iTdos",
            HiddenIndex: 0
        })
    };

    applyLegacySysMenuConfigFallback(menu);

    assert.equal(
        menu.SelectApi,
        "https://api.itdos.com/apiengine/get-microi-store-list?OsClient=iTdos"
    );
    assert.equal(menu.HiddenIndex, 0);
});

test("physical v6 values win over stale legacy DiyConfig during reads", function () {
    const menu = {
        SelectApi: "https://new.example/api",
        DiyConfig: JSON.stringify({ SelectApi: "https://old.example/api" })
    };

    applyLegacySysMenuConfigFallback(menu);

    assert.equal(menu.SelectApi, "https://new.example/api");
});

test("malformed legacy DiyConfig never clears physical fields", function () {
    const menu = {
        SelectApi: "https://new.example/api",
        DiyConfig: "{broken"
    };

    applyLegacySysMenuConfigFallback(menu);

    assert.equal(menu.SelectApi, "https://new.example/api");
    assert.equal(legacySysMenuConfigFields.includes("GeneralSeaarch"), true);
});
