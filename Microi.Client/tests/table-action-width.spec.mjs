import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import tableStateMixin from "../src/views/form-engine/mixins/diy-table-state.mixin.js";
import tableUtilsMixin from "../src/views/form-engine/mixins/table-utils.mixin.js";

const methods = tableUtilsMixin.methods;

test("row action width includes visible V8 button labels, chrome and gaps", function () {
    const width = methods.GetRowActionButtonsWidth([
        { Name: "设计", IsVisible: true },
        { Name: "复制表", IsVisible: 1 },
        { Name: "不可见", IsVisible: false }
    ]);

    assert.equal(width, 152);
    assert.equal(methods.GetRowActionButtonsWidth([
        { Name: "提料", IsVisible: true },
        { Name: "成品", IsVisible: true },
        { Name: "请购", IsVisible: true },
        { Name: "收款", IsVisible: true }
    ]), 280);
    assert.equal(methods.GetRowActionButtonsWidth([
        { Name: "充值Token", IsVisible: true },
        { Name: "清除登录信息", IsVisible: true }
    ]), 223);
    assert.equal(methods.GetActionCellReserveWidth(), 32);
});

test("switching from card to table refreshes the Element Plus layout after nextTick", function () {
    let layoutCount = 0;
    let nextTickCount = 0;
    const context = {
        TableDisplayMode: "Card",
        TableId: "table-id",
        cardSelection: [1],
        TableMultipleSelection: [1],
        DiyTableRowPageSize: 15,
        diyStore: { IsPhoneView: false },
        $refs: {
            "diy-table-table-id": { doLayout() { layoutCount += 1; } }
        },
        $nextTick(callback) {
            nextTickCount += 1;
            callback();
        }
    };

    methods.ShiftTableDisplayMode.call(context);

    assert.equal(context.TableDisplayMode, "Table");
    assert.deepEqual(context.cardSelection, []);
    assert.deepEqual(context.TableMultipleSelection, []);
    assert.equal(nextTickCount, 1);
    assert.equal(layoutCount, 1);
});

test("configured action width is a safe minimum and cannot crop wider button content", function () {
    const context = {
        SysMenuModel: { TableActionFixedWidth: 500 },
        IsWorkFlowMenu() { return false; },
        IsPermission() { return true; },
        IsTrashMode: false,
        TableChildFormMode: "Edit",
        _LimitEdit: false,
        _LimitDel: true,
        HasVisibleMoreBtnsIn: false,
        MaxRowBtnsOut: 280,
        GetActionCellReserveWidth() { return 32; }
    };

    assert.equal(tableStateMixin.computed.GetActionWidth.call(context), 500);
    context.SysMenuModel.TableActionFixedWidth = 400;
    assert.equal(tableStateMixin.computed.GetActionWidth.call(context), 452);
    context.SysMenuModel.TableActionFixedWidth = 600;
    assert.equal(tableStateMixin.computed.GetActionWidth.call(context), 600);
});

test("row action styles use compact gaps and keep statistic badges inside the fixed column safe area", function () {
    const styles = readFileSync(new URL("../src/styles/diy-table.scss", import.meta.url), "utf8");

    assert.match(styles, /\.diy-table-action-content\s*\{[\s\S]*?gap:\s*6px;/);
    assert.match(styles, /\.diy-table-action-content\s*\{[\s\S]*?justify-content:\s*flex-start;/);
    assert.match(styles, />\s*\.el-button\s*\{[\s\S]*?margin-left:\s*0\s*!important;[\s\S]*?padding-inline:\s*9px;/);
    assert.match(styles, /\.diy-table-action-content\s*\{[\s\S]*?\.button-stat-badge\s*\{[\s\S]*?top:\s*-5px;[\s\S]*?right:\s*-5px;[\s\S]*?min-width:\s*16px;/);
    assert.match(styles, /@media\s*\(max-width:\s*1440px\)[\s\S]*?gap:\s*4px;[\s\S]*?padding-inline:\s*7px;/);
});

test("selected rows paint an opaque fixed action column over horizontally scrolling cells", function () {
    const styles = readFileSync(new URL("../src/views/form-engine/styles/diy-table-rowlist.scss", import.meta.url), "utf8");

    assert.match(styles, /diy-current-row\s*>\s*td\.el-table__cell\.el-table-fixed-column--right[\s\S]*?background-color:\s*var\(--el-bg-color,[^)]+\)\s*!important;/);
    assert.match(styles, /diy-current-row\s*>\s*td\.el-table__cell\.el-table-fixed-column--right[\s\S]*?background-image:\s*linear-gradient\(/);
});

test("card mode keeps ShowRow false V8 buttons inside More and gives desktop cards a visible surface", function () {
    const component = readFileSync(new URL("../src/views/form-engine/diy-table.vue", import.meta.url), "utf8");
    const styles = readFileSync(new URL("../src/styles/diy-table.scss", import.meta.url), "utf8");

    assert.doesNotMatch(component, /<el-button[\s\S]{0,180}v-for="\(btn, btnIndex\) in item\._RowMoreBtnsIn"/);
    assert.match(component, /<el-dropdown-item[\s\S]{0,260}v-if="btn\.IsVisible && !TableChildField\.Readonly"[\s\S]{0,260}@click="RunMoreBtn\(btn, item\)"/);
    assert.match(styles, /\.card-wrapper-desktop\s*\{[\s\S]*?\.box-card\.card-redesign\s*\{[\s\S]*?box-shadow:\s*var\(--mci-shadow-card,[\s\S]*?\)\s*!important;/);
    assert.match(styles, /\.card-wrapper-desktop\s*\{[\s\S]*?\.card-actions\s*\{[\s\S]*?border-top:\s*1px solid[\s\S]*?background:/);
});
