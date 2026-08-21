import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
    getFormFieldDisplayValue,
    getFormRecordDisplayTitle,
    hasFormBannerConfig
} from "../src/views/form-engine/field-display-value.js";

test("standard view resolves stored option ids to labels", function () {
    const field = {
        Name: "Status",
        Component: "Select",
        Config: { SelectSaveField: "Id", SelectLabel: "Name" },
        Data: [
            { Id: "draft", Name: "草稿" },
            { Id: "approved", Name: "已审批" }
        ]
    };
    assert.equal(getFormFieldDisplayValue({ Status: "approved" }, field), "已审批");
    assert.equal(getFormFieldDisplayValue({ Status: '{"Id":"draft","Name":"草稿"}' }, field), "草稿");
});

test("standard view recursively resolves department and tree ids", function () {
    const field = {
        Name: "DeptId",
        Component: "Department",
        Config: {
            SelectSaveField: "Id",
            SelectLabel: "Name",
            Department: { EmitPath: false }
        },
        Data: [{
            Id: "root",
            Name: "集团",
            _Child: [{ Id: "rd", Name: "研发中心" }]
        }]
    };
    assert.equal(getFormFieldDisplayValue({ DeptId: "rd" }, field), "研发中心");
    assert.equal(getFormFieldDisplayValue({ DeptId: '["root","rd"]' }, field), "研发中心");
});

test("business translations and auxiliary labels take precedence over raw ids", function () {
    const field = { Name: "OwnerId", Component: "Select" };
    assert.equal(getFormFieldDisplayValue({ OwnerId: "u1", OwnerIdName: "张三" }, field), "张三");
    assert.equal(getFormFieldDisplayValue({ OwnerId: "u1", _BusinessTranslations: { OwnerId: "李四" } }, field), "李四");
});

test("empty values and banner compatibility remain deterministic", function () {
    assert.equal(getFormFieldDisplayValue({}, { Name: "Missing", Component: "Text" }), "—");
    assert.equal(hasFormBannerConfig({}), true);
    assert.equal(hasFormBannerConfig({ Visible: false, Title: "隐藏" }), false);
    assert.equal(hasFormBannerConfig({ TitleField: "OrderNo" }), true);
});

test("record heading follows query-column order and skips non-readable controls", function () {
    const fields = [
        { Id: "layout", Name: "Layout", Component: "CollapseGroup" },
        { Id: "cover", Name: "Cover", Component: "ImgUpload" },
        { Id: "name", Name: "ApiName", Component: "Text" },
        { Id: "status", Name: "Status", Component: "Select", Config: { SelectSaveField: "Id", SelectLabel: "Name" }, Data: [{ Id: "on", Name: "启用" }] }
    ];
    const configured = [{ Id: "layout" }, { Id: "cover" }, { Id: "name" }, { Id: "status" }];
    assert.equal(getFormRecordDisplayTitle({ ApiName: "平台登录事件", Status: "on" }, configured, fields), "平台登录事件");
    assert.equal(getFormRecordDisplayTitle({ ApiName: "", Status: "on" }, configured, fields), "启用");
});

test("record heading resolves option JSON labels and never exposes raw JSON", function () {
    const fields = [
        { Id: "status", Name: "Status", Component: "Select", Config: { SelectLabel: "Label", SelectSaveField: "Id" } },
        { Id: "fallback", Name: "Fallback", Component: "Text" }
    ];
    assert.equal(getFormRecordDisplayTitle(
        { Status: '{"Id":"approved","Label":"已审批"}', Fallback: "备用标题" },
        ["status", "fallback"],
        fields
    ), "已审批");
    assert.equal(getFormRecordDisplayTitle(
        { Status: '{"Id":"approved","Payload":{"x":1}}', Fallback: "备用标题" },
        ["status", "fallback"],
        fields
    ), "备用标题");
});

test("full form title consumes the shared readable-record resolver", async function () {
    const [dialogMixin, titleStyles] = await Promise.all([
        readFile(new URL("../src/views/form-engine/mixins/diy-form-full-dialog.mixin.js", import.meta.url), "utf8"),
        readFile(new URL("../src/views/form-engine/styles/diy-form-full.global.scss", import.meta.url), "utf8")
    ]);
    assert.match(dialogMixin, /getFormRecordDisplayTitle/u);
    assert.match(dialogMixin, /SysMenuModel\s*&&\s*self\.SysMenuModel\.SelectFields/u);
    assert.match(dialogMixin, /recordTitle\s*\|\|\s*tableTitle/u);
    assert.match(titleStyles, /\.diy-form-dialog-title__heading\s*>\s*span\s*\{[\s\S]*text-overflow:\s*ellipsis;[\s\S]*white-space:\s*nowrap;/u);
});
