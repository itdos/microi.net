import assert from "node:assert/strict";
import test from "node:test";
import { needsDefaultTreeLoading, treeFlag, buildChildPage } from "../src/views/form-engine/left-right/left-tree-loading.js";
import { scheduleTableFilterReload } from "../src/views/form-engine/utils/diy-table-init.js";

test("server automatic paging enables loading even when the saved tree setting is off", () => {
    assert.equal(needsDefaultTreeLoading({ DataAppend: { AutoTreeLazy: true }, Data: [] }), true);
    assert.equal(needsDefaultTreeLoading({ Data: [{ _HasChild: 1 }] }), true);
    assert.equal(needsDefaultTreeLoading({ Data: [{ _HasChild: 1, _Child: [{ Id: "child" }] }] }), false);
    for (const value of [false, 0, "0", "false", null]) assert.equal(treeFlag(value), false);
});

test("child paging preserves real rows and offers the next page only when required", () => {
    const row = { Id: "child", _HasChild: true };
    const page = buildChildPage({ Data: [row], DataCount: 2 }, "parent", 1, 1, "Title");
    assert.equal(page[0], row);
    assert.deepEqual(page[1].__LeftTreeLoadMore, { parentId: "parent", pageIndex: 2 });
    assert.equal(page[1]._IsLeaf, true);
    assert.equal(buildChildPage({ Data: [row], DataCount: 2 }, "parent", 2, 1, "Title").length, 1);
    assert.equal(buildChildPage({ Data: [], DataCount: 100 }, "parent", 1, 1, "Title").length, 0);
});

test("multiple parent/filter changes query the latest selection once without metadata reload", async () => {
    const calls = [];
    const context = {
        PropsFilterReloadOnly: true, SysMenuModel: { Id: "menu" }, PropsWhere: [],
        ScheduleInit() { throw new Error("metadata must be reused"); },
        GetDiyTableRow(query) { calls.push({ ...query, where: this.PropsWhere }); }
    };
    const first = scheduleTableFilterReload(context);
    context.PropsWhere = [["CategoryId", "=", "last"]];
    const second = scheduleTableFilterReload(context);
    await Promise.all([first, second]);
    assert.deepEqual(calls, [{ _PageIndex: 1, where: [["CategoryId", "=", "last"]] }]);
    context.moduleShellLoading = true;
    await scheduleTableFilterReload(context);
    assert.equal(calls.length, 1);
    context.moduleShellLoading = false;
    context._isDestroyed = true;
    await scheduleTableFilterReload(context);
    assert.equal(calls.length, 1);
});

test("other table integrations keep their existing initialization behavior", async () => {
    let called = 0;
    await scheduleTableFilterReload({ ScheduleInit() { called++; } });
    assert.equal(called, 1);
});
