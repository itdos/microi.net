import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import selectionMixin from "../src/views/form-engine/mixins/diy-table-selection.mixin.js";

const methods = selectionMixin.methods;

function createSelectionContext(overrides = {}) {
    const context = {
        PropsTableType: "",
        EnableMultipleSelect: false,
        TableEnableBatch: true,
        TableDisplayMode: "Table",
        TableId: "table-1",
        SysMenuModel: { BatchSelectMoreBtns: [{ Id: "batch-action" }] },
        TableMultipleSelection: [],
        $refs: {}
    };
    Object.assign(context, overrides);
    Object.keys(methods).forEach(name => {
        context[name] = methods[name].bind(context);
    });
    return context;
}

function normalRowClickEvent() {
    return {
        defaultPrevented: false,
        target: {
            closest() {
                return null;
            }
        }
    };
}

function interactiveRowClickEvent(marker) {
    return {
        defaultPrevented: false,
        target: {
            closest(selector) {
                return selector.includes(marker) ? {} : null;
            }
        }
    };
}

function attachTableRef(context) {
    const calls = [];
    context.$refs[`diy-table-${context.TableId}`] = {
        toggleRowSelection(row, selected) {
            calls.push({ row, selected });
            context.TableMultipleSelection = selected ? [row] : [];
        }
    };
    return calls;
}

test("configured batch list toggles a row when its non-interactive area is clicked", () => {
    const context = createSelectionContext();
    const calls = attachTableRef(context);
    const row = { Id: "row-1" };

    assert.equal(context.ToggleTableRowSelectionByClick(row, { type: "default" }, normalRowClickEvent()), true);
    assert.deepEqual(calls, [{ row, selected: true }]);

    assert.equal(context.ToggleTableRowSelectionByClick(row, { type: "default" }, normalRowClickEvent()), true);
    assert.deepEqual(calls, [{ row, selected: true }, { row, selected: false }]);
});

test("OpenTable multi-select uses the same row-click selection behavior", () => {
    const context = createSelectionContext({
        PropsTableType: "OpenTable",
        EnableMultipleSelect: true,
        SysMenuModel: { BatchSelectMoreBtns: [] }
    });
    const calls = attachTableRef(context);
    const row = { Id: "popup-row" };

    assert.equal(context.ToggleTableRowSelectionByClick(row, { type: "default" }, normalRowClickEvent()), true);
    assert.deepEqual(calls, [{ row, selected: true }]);
});

test("row-click selection ignores checkbox, action and child-table interactions", () => {
    const context = createSelectionContext();
    const calls = attachTableRef(context);
    const row = { Id: "row-2" };

    assert.equal(context.ToggleTableRowSelectionByClick(row, { type: "selection" }, normalRowClickEvent()), false);
    assert.equal(context.ToggleTableRowSelectionByClick(row, { type: "default" }, interactiveRowClickEvent("button")), false);
    assert.equal(context.ToggleTableRowSelectionByClick(row, { type: "default" }, interactiveRowClickEvent(".diy-special-cell")), false);
    assert.equal(calls.length, 0);
});

test("lists without batch selection keep their original row-click behavior", () => {
    const context = createSelectionContext({
        TableEnableBatch: false,
        SysMenuModel: { BatchSelectMoreBtns: [] }
    });
    const calls = attachTableRef(context);

    assert.equal(context.ToggleTableRowSelectionByClick({ Id: "row-3" }, { type: "default" }, normalRowClickEvent()), false);
    assert.equal(calls.length, 0);
});

test("diy-table wires row clicks once and the child-table action stops propagation", async () => {
    const tableSource = await readFile(new URL("../src/views/form-engine/diy-table.vue", import.meta.url), "utf8");
    const specialCellSource = await readFile(new URL("../src/views/form-engine/diy-components/DiyTableSpecialCell.vue", import.meta.url), "utf8");

    assert.match(tableSource, /self\.ToggleTableRowSelectionByClick\(row, column, event\);/);
    assert.match(specialCellSource, /class="diy-special-cell"[\s\S]*@click\.stop/);
    assert.match(specialCellSource, /component === 'TableChild'[\s\S]*@click\.stop="openTableChild"/);
});
