import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const resourceDir = path.dirname(fileURLToPath(import.meta.url));
const resource = JSON.parse(fs.readFileSync(path.join(resourceDir, "app.microi.module-engine.json"), "utf8"));

test("module engine package version and physical menu badge columns are current", () => {
    assert.equal(resource.PackageInfo.Version, "v6.9.5");
    const physicalNames = new Set((resource.PhysicalColumns || []).map((item) => item.COLUMN_NAME));
    for (const name of ["MenuBadgeEnabled", "MenuBadgeApiEngineKey", "EnableViewSchema", "ViewSchemaVersion", "ViewConfigVersion", "ViewSchema"]) {
        assert.ok(physicalNames.has(name), `missing physical sys_menu column ${name}`);
        assert.match(resource.DDLStatements[0].DDL, new RegExp(`\\b${name}\\b`));
    }
});

function field(name) {
    const result = resource.DiyFields.find((item) => item.Name === name);
    assert.ok(result, `missing diy_field ${name}`);
    return result;
}

function configOf(item) {
    return typeof item.Config === "string" ? JSON.parse(item.Config) : (item.Config || {});
}

test("module presentation is exposed through a visual DevComponent", () => {
    const presentation = field("ViewSchema");
    const config = configOf(presentation);
    assert.equal(presentation.Visible, 1);
    assert.equal(presentation.FormWidth, 24);
    assert.equal(presentation.Component, "DevComponent");
    assert.equal(config.DevComponentName, "DiyModulePresentationDesigner");
    assert.equal(config.DevComponentPath, "/views/form-engine/diy-components/diy-module-presentation-designer.vue");

    for (const name of ["EnableViewSchema", "ViewSchemaVersion", "ViewConfigVersion", "MenuBadgeEnabled", "MenuBadgeApiEngineKey"]) {
        assert.equal(field(name).Visible, 1, `${name} must be visible in sys_menu form design`);
    }

    assert.equal(field("EnableViewSchema").Label, "启用自定义表单视图");
    assert.match(field("EnableViewSchema").Description, /仅控制.*Detail\/Edit/);
    assert.match(field("EnableViewSchema").V8TmpEngineTable, /自定义表单视图/);
    assert.doesNotMatch(field("EnableViewSchema").V8TmpEngineTable, /传统视图|跨端视图/);
    assert.equal(field("ViewSchemaVersion").NotEmpty, 0);
    assert.match(field("ViewSchemaVersion").Placeholder, /默认 1\.0/);
    assert.equal(field("ViewConfigVersion").NotEmpty, 0);
    assert.match(field("ViewConfigVersion").Placeholder, /默认 1/);
});

test("menu badge engine selector uses bounded remote keyword search", () => {
    const config = configOf(field("MenuBadgeApiEngineKey"));
    assert.equal(config.DataSource, "Sql");
    assert.equal(config.DataSourceSqlRemote, true);
    assert.match(config.Sql, /ApiName\s+like\s+'%\$Keyword\$%'/i);
    assert.match(config.Sql, /ApiEngineKey\s+like\s+'%\$Keyword\$%'/i);
    assert.match(config.Sql, /limit\s+0\s*,\s*50/i);
});

test("all button collections and PageTabs expose the complete badge contract", () => {
    const expected = [
        "BadgeEnabled",
        "BadgeApiEngineKey",
        "BadgeField",
        "BadgeValuePath",
        "BadgeTone",
        "BadgeColor",
        "BadgeMax",
        "BadgeShowZero",
        "BadgeRefreshSeconds"
    ];
    const expectedComponents = {
        BadgeEnabled: "Switch",
        BadgeApiEngineKey: "Select",
        BadgeField: "Text",
        BadgeValuePath: "Text",
        BadgeTone: "Select",
        BadgeColor: "ColorPicker",
        BadgeMax: "NumberText",
        BadgeShowZero: "Switch",
        BadgeRefreshSeconds: "NumberText"
    };
    for (const name of ["PageTabs", "MoreBtns", "PageBtns", "BatchSelectMoreBtns", "ExportMoreBtns", "FormBtns"]) {
        const columns = configOf(field(name)).JsonTable.Columns;
        const keys = columns.map((item) => item.Key);
        for (const key of expected) assert.ok(keys.includes(key), `${name} missing ${key}`);
        const badgeColumns = expected.map((key) => columns.find((item) => item.Key === key));
        assert.equal(new Set(badgeColumns.map((item) => item.Id)).size, expected.length, `${name} badge Ids must be unique`);
        assert.deepEqual(badgeColumns.map((item) => Number(item.Sort)), [...badgeColumns.map((item) => Number(item.Sort))].sort((left, right) => left - right));
        badgeColumns.forEach((item) => assert.equal(item.Component, expectedComponents[item.Key], `${name}.${item.Key} component`));
    }
});

test("sys_menu form tabs have deterministic unique ordering", () => {
    const table = resource.DiyTables.find((item) => item.Name === "sys_menu");
    assert.ok(table);
    const tabs = JSON.parse(table.Tabs);
    const sorts = tabs.map((item) => Number(item.Sort));
    assert.ok(sorts.every(Number.isFinite));
    assert.equal(new Set(sorts).size, sorts.length);
    assert.deepEqual(sorts, [...sorts].sort((left, right) => left - right));
    const buttonTabId = tabs.find((item) => item.Name === "按钮")?.Id;
    assert.ok(buttonTabId);
    for (const name of ["PageTabs", "MoreBtns", "PageBtns", "BatchSelectMoreBtns", "ExportMoreBtns", "FormBtns"]) {
        assert.equal(field(name).Tab, buttonTabId, `${name} must use the stable button Tab Id`);
    }
});
