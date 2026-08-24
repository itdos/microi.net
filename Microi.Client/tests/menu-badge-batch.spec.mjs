import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMenuBadgeRequester } from "../src/layout/components/Sidebar/menu-badge-batch.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const nextTask = (callback) => queueMicrotask(callback);

test("official sidebar badges are coalesced into one multi-menu engine request", async () => {
    const calls = [];
    const run = async (key, payload) => {
        calls.push({ key, payload });
        return {
            Code: 1,
            Data: {
                Menus: {
                    menu1: { Value: 7, Count: 7 },
                    menu2: { Value: 11, Count: 11 }
                }
            }
        };
    };
    const request = createMenuBadgeRequester(nextTask);
    const [first, second, duplicate] = await Promise.all([
        request(run, "mci-module-presentation-stats", { OsClient: "iTdos", SysMenuId: "menu1", ValueOnly: true }),
        request(run, "mci-module-presentation-stats", { OsClient: "iTdos", SysMenuId: "menu2", ValueOnly: true }),
        request(run, "mci-module-presentation-stats", { OsClient: "iTdos", SysMenuId: "menu1", ValueOnly: true })
    ]);

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].payload.MenuRequests.map(item => item.SysMenuId), ["menu1", "menu2"]);
    assert.equal(calls[0].payload.MenuRequests.every(item => item.ValueOnly === true), true);
    assert.equal(first.Data.Value, 7);
    assert.equal(second.Data.Value, 11);
    assert.equal(duplicate.Data.Value, 7);
});

test("custom engines keep their existing request contract", async () => {
    const calls = [];
    const run = async (key, payload) => {
        calls.push({ key, payload });
        return { Code: 1, Data: { Value: 3 } };
    };
    const request = createMenuBadgeRequester(nextTask);
    const result = await request(run, "customer-badge", { OsClient: "demo", SysMenuId: "menu1" });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].payload.MenuRequests, undefined);
    assert.equal(result.Data.Value, 3);
});

test("an older official engine falls back to individual calls during rolling upgrades", async () => {
    const calls = [];
    const run = async (key, payload) => {
        calls.push({ key, payload });
        if (payload.MenuRequests) return { Code: 1, Data: { Value: 0 } };
        return { Code: 1, Data: { Value: payload.SysMenuId === "menu1" ? 5 : 9 } };
    };
    const request = createMenuBadgeRequester(nextTask);
    const [first, second] = await Promise.all([
        request(run, "mci-module-presentation-stats", { OsClient: "demo", SysMenuId: "menu1" }),
        request(run, "mci-module-presentation-stats", { OsClient: "demo", SysMenuId: "menu2" })
    ]);

    assert.equal(calls.length, 3);
    assert.equal(first.Data.Value, 5);
    assert.equal(second.Data.Value, 9);
});

test("batch failures reject every waiting sidebar item", async () => {
    const request = createMenuBadgeRequester(nextTask);
    const failure = new Error("batch failed");
    const run = async () => { throw failure; };
    const settled = await Promise.allSettled([
        request(run, "mci-module-presentation-stats", { OsClient: "demo", SysMenuId: "menu1" }),
        request(run, "mci-module-presentation-stats", { OsClient: "demo", SysMenuId: "menu2" })
    ]);

    assert.deepEqual(settled.map(item => item.status), ["rejected", "rejected"]);
    assert.equal(settled[0].reason, failure);
    assert.equal(settled[1].reason, failure);
});

test("all standard module-presentation surfaces share the official batch requester", () => {
    const surfaces = [
        "src/views/form-engine/mixins/diy-table-presentation.mixin.js",
        "src/views/form-engine/mixins/diy-form-state.mixin.js",
        "src/views/form-engine/form-view-blocks/standard-form-banner.vue"
    ];
    for (const relative of surfaces) {
        const source = fs.readFileSync(path.join(root, relative), "utf8");
        assert.match(source, /import\s*\{\s*requestMenuBadge\s*\}/u, `${relative} must use the shared coalescer`);
        assert.match(source, /await\s+requestMenuBadge\s*\(/u, `${relative} must not bypass the shared coalescer`);
    }
});
