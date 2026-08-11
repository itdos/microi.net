import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import tableStateMixin from "../src/views/form-engine/mixins/diy-table-state.mixin.js";
import tableUtilsMixin from "../src/views/form-engine/mixins/table-utils.mixin.js";
import tableUiMixin from "../src/views/form-engine/mixins/diy-table-ui.mixin.js";

const methods = tableUtilsMixin.methods;

test("row action width includes visible V8 button labels, chrome and only real gaps", function () {
    const width = methods.GetRowActionButtonsWidth([
        { Name: "设计", IsVisible: true },
        { Name: "复制表", IsVisible: 1 },
        { Name: "不可见", IsVisible: false }
    ]);

    assert.equal(width, 138);
    assert.equal(methods.GetRowActionButtonsWidth([
        { Name: "提料", IsVisible: true },
        { Name: "成品", IsVisible: true },
        { Name: "请购", IsVisible: true },
        { Name: "收款", IsVisible: true }
    ]), 258);
    assert.equal(methods.GetRowActionButtonsWidth([
        { Name: "充值Token", IsVisible: true },
        { Name: "清除登录信息", IsVisible: true }
    ]), 209);
    assert.equal(methods.GetActionCellReserveWidth(), 30);
    assert.equal(methods.GetActionMinColumnWidth(), 56);
});

test("row action content width follows the buttons that the same row really renders", function () {
    const context = {
        ...methods,
        IsTrashMode: false,
        TableChildField: { Readonly: false },
        TableChildFormMode: "Edit",
        _LimitEdit: true,
        _LimitDel: true,
        IsWorkFlowMenu() { return false; },
        IsPermission(name) { return name === "NoDetail"; },
        CanManageUserAccessKey() { return false; },
        $t(key) { return key === "Msg.Detail" ? "详情" : key === "Msg.More" ? "更多" : key; }
    };
    const regularRow = {
        IsVisibleDetail: true,
        IsVisibleEdit: true,
        IsVisibleDel: false,
        _RowMoreBtnsOut: [],
        _RowMoreBtnsIn: []
    };
    const v8OnlyRow = {
        IsVisibleDetail: false,
        IsVisibleEdit: false,
        IsVisibleDel: false,
        _RowMoreBtnsOut: [{ Name: "长按钮文案", IsVisible: true }],
        _RowMoreBtnsIn: []
    };

    assert.equal(methods.GetRowActionContentWidth.call(context, regularRow), 129);
    assert.equal(methods.GetRowActionContentWidth.call(context, v8OnlyRow), 96);
    assert.equal(Math.max(
        methods.GetRowActionContentWidth.call(context, regularRow),
        methods.GetRowActionContentWidth.call(context, v8OnlyRow)
    ), 129);
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
        MaxRowActionContentWidth: 258,
        GetActionCellReserveWidth() { return 30; },
        GetActionMinColumnWidth() { return 56; }
    };

    assert.equal(tableStateMixin.computed.GetActionWidth.call(context), 500);
    context.SysMenuModel.TableActionFixedWidth = 200;
    assert.equal(tableStateMixin.computed.GetActionWidth.call(context), 288);
    context.SysMenuModel.TableActionFixedWidth = 600;
    assert.equal(tableStateMixin.computed.GetActionWidth.call(context), 600);
});

test("the last visible content column flex-fills remaining width before the fixed action column", function () {
    const uiMethods = tableUiMixin.methods;
    const fields = [
        { Id: "name", Name: "Name", Label: "名称", TableWidth: 180 },
        { Id: "status", Name: "Status", Label: "状态", TableWidth: 130 }
    ];
    const context = {
        ...uiMethods,
        PresentationTableFieldList: fields,
        ShowDiyFieldList: fields,
        ColIsDisplay(name) { return name !== "UpdateTime" && name !== "UserName" && name !== "CreateTime"; },
        ColIsFixed() { return false; },
        GetListColumnConfig() { return null; }
    };

    assert.equal(uiMethods.GetTableFillColumnKey.call(context), "field:status");
    assert.equal(uiMethods.GetTableColumnWidth.call(context, fields[1], 1), undefined);
    assert.equal(uiMethods.GetTableColumnMinWidth.call(context, fields[1], 1), 130);
    assert.equal(uiMethods.GetTableColumnWidth.call(context, fields[0], 0), 180);

    context.ColIsDisplay = name => name === "UpdateTime";
    assert.equal(uiMethods.GetTableFillColumnKey.call(context), "audit:UpdateTime");
    assert.equal(uiMethods.GetAuditColumnWidth.call(context, "UpdateTime", 150), undefined);
    assert.equal(uiMethods.GetAuditColumnMinWidth.call(context, "UpdateTime", 150), 150);
    assert.equal(uiMethods.GetTableColumnWidth.call(context, fields[1], 1), 130);
});

test("row action styles use compact gaps and keep statistic badges inside the fixed column safe area", function () {
    const styles = readFileSync(new URL("../src/styles/diy-table.scss", import.meta.url), "utf8");

    assert.match(styles, /\.diy-table-action-content\s*\{[\s\S]*?gap:\s*6px;/);
    assert.match(styles, /\.diy-table-action-content\s*\{[\s\S]*?justify-content:\s*flex-end;/);
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
