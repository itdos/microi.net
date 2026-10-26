import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { compileStyle, compileTemplate, parse } from "@vue/compiler-sfc";
import { appendPresentationSelectFields } from "../src/views/form-engine/utils/table-presentation-query.js";
import { getModuleViewFieldNames, selectModuleView } from "../src/views/form-engine/form-view-blocks/view-schema-runtime.js";

const component = readFileSync(new URL("../src/views/form-engine/diy-table.vue", import.meta.url), "utf8");
const presentationSource = readFileSync(new URL("../src/views/form-engine/mixins/diy-table-presentation.mixin.js", import.meta.url), "utf8");
const presentation = new Function(presentationSource
    .replace(/import\s+[\s\S]*?\s+from\s+["'][^"']+["'];/g, "")
    .replace("export default", "return"))();
const schemaSource = readFileSync(new URL("../src/views/form-engine/mixins/diy-table-schema.mixin.js", import.meta.url), "utf8");
const schema = new Function(schemaSource
    .replace(/import\s+[\s\S]*?\s+from\s+["'][^"']+["'];/g, "")
    .replace("export default", "return"))();

function fieldContext() {
    const context = {
        DiyCommon: { IsNull: value => value === undefined || value === null || value === "" },
        SysMenuModel: {},
        CardContentFieldList: [],
        isMuban: () => false,
        IsInTableEditField: () => true
    };
    Object.entries(schema.methods).forEach(([key, method]) => { context[key] = method.bind(context); });
    for (const key of ["GetPresentationFieldValue", "HasPresentationFieldValue", "GetVisibleCardContentFields"]) {
        context[key] = presentation.methods[key].bind(context);
    }
    return context;
}

test("a card's configured information joins the existing query projection without dropping other columns", () => {
    const menu = {
        SelectFields: [{ Name: "Name" }, "State", { Name: "ExistingBusinessField" }],
        ViewSchema: { Views: [{ Key: "mobile-card", Scene: "Card", Device: "Mobile", Layout: { Card: {
            TitleField: "Name", SubtitleFields: [{ Name: "Account", ShowLabel: true }],
            TopFields: ["State"], Fields: ["Phone", "Email", "DeptName", "RoleIds", "Jobs"],
            MetaFields: ["No"], BottomFields: ["TenantName"]
        } } }] }
    };
    const required = getModuleViewFieldNames(selectModuleView(menu, { scene: "Card", device: "Mobile" }));
    const params = { _SelectFields: ["ReplacementApiField"], _Where: [["State", "=", 1]] };
    appendPresentationSelectFields(params, menu, required);
    for (const field of ["Id", "CreateTime", "UpdateTime", "Name", "State", "Account", "Phone", "Email", "DeptName", "RoleIds", "Jobs", "No", "TenantName", "ExistingBusinessField", "ReplacementApiField"]) {
        assert.ok(params._SelectFields.includes(field), `missing field: ${field}`);
    }
    assert.equal(new Set(params._SelectFields).size, params._SelectFields.length);
    assert.deepEqual(params._Where, [["State", "=", 1]]);
    assert.deepEqual(menu.SelectFields, [{ Name: "Name" }, "State", { Name: "ExistingBusinessField" }]);
});

test("legacy all-column queries and menus without view dependencies keep their original projection", () => {
    const allColumns = {};
    appendPresentationSelectFields(allColumns, {}, ["Name"]);
    assert.deepEqual(allColumns, {});
    const wildcard = { _SelectFields: ["*"] };
    appendPresentationSelectFields(wildcard, {}, ["Name"]);
    assert.deepEqual(wildcard, { _SelectFields: ["*"] });
    const noView = { _SelectFields: ["Account"] };
    appendPresentationSelectFields(noView, { SelectFields: ["Name"] }, []);
    assert.deepEqual(noView, { _SelectFields: ["Account"] });
});

test("regular refresh and lazy tree requests both apply presentation fields after request overrides", () => {
    const data = readFileSync(new URL("../src/views/form-engine/mixins/diy-table-data.mixin.js", import.meta.url), "utf8");
    const call = "appendPresentationSelectFields(param, self.SysMenuModel, self.PresentationRequiredFieldNames)";
    assert.equal(data.split(call).length - 1, 2);
    assert.ok(data.lastIndexOf(call) > data.indexOf("if (self.PropsRequestParams"));
    assert.ok(data.indexOf("self.DiyCommon.Post(", data.lastIndexOf(call)) > data.lastIndexOf(call));
});

test("cards hide formatted empty selections while preserving zero, false and inline editing", () => {
    const context = fieldContext();
    context.CardContentFieldList = [{ Id: "roles", Name: "Roles", Component: "MultipleSelect", Config: { SelectLabel: "Name" } }];
    assert.deepEqual(context.GetVisibleCardContentFields({ Roles: [] }), []);
    assert.deepEqual(context.GetVisibleCardContentFields({ Roles: "[]" }), []);
    assert.equal(context.GetVisibleCardContentFields({ Roles: [{ Id: "one", Name: "运营" }] }).length, 1);
    assert.equal(context.GetPresentationFieldValue({ Roles: [{ Id: "one", Name: "运营" }] }, context.CardContentFieldList[0]), "运营");
    assert.equal(context.HasPresentationFieldValue({ Value: 0 }, { Name: "Value" }), true);
    assert.equal(context.HasPresentationFieldValue({ Value: false }, { Name: "Value" }), true);
    assert.equal(context.HasPresentationFieldValue({ Value: "  " }, { Name: "Value", Component: "Select" }), false);
    assert.equal(context.HasPresentationFieldValue({ Value: "  " }, { Name: "Value", Component: "Text" }), true);
    context.SysMenuModel.InTableEdit = true;
    assert.equal(context.GetVisibleCardContentFields({ Roles: [] }).length, 1);
});

test("attachments without filenames keep their special cell even when GetColValue has no text", () => {
    const context = fieldContext();
    for (const component of ["ImgUpload", "FileUpload"]) {
        const field = { Id: component, Name: "Asset", Component: component };
        const row = { Asset: JSON.stringify({ Path: "/tenant/files/asset.png" }) };
        context.CardContentFieldList = [field];
        assert.equal(context.GetPresentationFieldValue(row, field), "", `${component} has no text filename`);
        assert.equal(context.HasPresentationFieldValue(row, field), true);
        assert.deepEqual(context.GetVisibleCardContentFields(row), [field]);
    }
    // 非文本控件的可见性由原值与专用渲染器决定，不能再次要求文本格式化成功。
    context.GetPresentationFieldValue = () => { throw new Error("special cell must not depend on a text formatter"); };
    for (const component of ["Map", "DevComponent", "TableChild", "RichText"]) {
        const field = { Name: "Content", Component: component };
        assert.equal(context.HasPresentationFieldValue({ Content: { configured: true } }, field), true);
        assert.equal(context.HasPresentationFieldValue({ Content: "" }, field), false);
        assert.equal(context.HasPresentationFieldValue({ Content: null }, field), false);
    }
});

test("card template compiles and honors subtitle labels, icons and keyboard isolation", () => {
    const { descriptor, errors } = parse(component);
    assert.deepEqual(errors, []);
    const result = compileTemplate({ source: descriptor.template.content, filename: "diy-table.vue", id: "card-regression" });
    assert.deepEqual(result.errors, []);
    assert.match(component, /subtitleField\.ShowLabel.*card-subtitle-label/);
    assert.match(component, /subtitleField\.Icon/);
    assert.match(component, /@keydown\.enter\.self\.prevent/);
    assert.match(component, /card-title-tags" v-if="HasAnyPresentationFieldValue/);
});

test("compiled card styles leave More visible and desktop spacing cannot override mobile anatomy", () => {
    const source = readFileSync(new URL("../src/styles/diy-table.scss", import.meta.url), "utf8");
    const result = compileStyle({ source, filename: "diy-table.scss", id: "data-v-card-regression", scoped: true, preprocessLang: "scss" });
    assert.deepEqual(result.errors, []);
    const labelBlock = result.code.match(/\.card-action-more-label\[data-v-card-regression\]\s*\{([^}]+)\}/)?.[1];
    assert.ok(labelBlock);
    assert.match(labelBlock, /position: static/);
    assert.doesNotMatch(labelBlock, /clip:|width: 1px|height: 1px|display: none/);
    assert.match(result.code, /\.card-wrapper-desktop \.card-title-main\[data-v-card-regression\]\s*\{[^}]+flex-direction: column;/);
    assert.match(result.code, /\.card-wrapper-desktop \.card-actions\[data-v-card-regression\]\s*\{[^}]+margin-top: auto;[^}]+border: 0;/);
    assert.doesNotMatch(source, /flex-direction:\s*column-reverse/);
});
