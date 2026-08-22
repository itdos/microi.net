import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const resourceUrl = new URL("./app.microi.form-engine.json", import.meta.url);
const moduleResourceUrl = new URL("./app.microi.module-engine.json", import.meta.url);
const modelUrl = new URL("../../Microi.Core/Model/DiyTable.cs", import.meta.url);
const tableId = "39bc4abe-98ee-46a7-b9d1-a7d649691193";
const expectedFieldsByTab = {
    "工作台与分组": [
        "TabsPosition",
        "FormPresentationMode",
        "FormPresentationDensity",
        "FormNavigationTitle",
        "FormNavigationCountText",
        "FormSectionNavigation",
        "FormSectionEyebrow",
        "FormRequiredCountText"
    ],
    "标题、说明与记录切换": [
        "FormWorkbenchEyebrow",
        "FormWorkbenchDescription",
        "FormNavigationFooterTitle",
        "FormNavigationFooterHtml",
        "FormRecordSelectorPlaceholder",
        "FormRecordSelectorLabelFields"
    ],
    "表单 Banner": [
        "FormBannerEnabled",
        "FormBannerTitleField",
        "FormBannerSubtitleField",
        "FormBannerImageField",
        "FormBannerIcon",
        "FormBannerBackgroundField",
        "FormBannerTagFields",
        "FormBannerMetrics"
    ]
};

const parseResource = (url) => JSON.parse(fs.readFileSync(url, "utf8"));

function assertPresentationResource(resource, moduleResource) {
    const table = resource.DiyTables.find((item) => item.Id === tableId);
    assert.ok(table, "diy_table definition must exist");
    assert.equal(String(table.TabsPosition).toLowerCase(), "top");

    const tabs = typeof table.Tabs === "string" ? JSON.parse(table.Tabs) : table.Tabs;
    const tabsByName = new Map(tabs.map((item) => [item.Name, item]));
    for (const name of ["表单信息", "工作台与分组", "标题、说明与记录切换", "表单 Banner", "事件"]) {
        assert.ok(tabsByName.has(name), `missing diy_table property tab: ${name}`);
    }

    const fields = resource.DiyFields.filter((item) => item.TableId === tableId);
    const fieldsByName = new Map(fields.map((item) => [item.Name, item]));
    for (const [tabName, names] of Object.entries(expectedFieldsByTab)) {
        const tab = tabsByName.get(tabName);
        for (const name of names) {
            const field = fieldsByName.get(name);
            assert.ok(field, `missing diy_table physical field: ${name}`);
            assert.equal(field.Tab, tab.Id, `${name} must render inside ${tabName}`);
            assert.equal(Number(field.Visible), 1, `${name} must be visible on PC`);
            assert.equal(Number(field.AppVisible), 1, `${name} must be visible on mobile`);
            assert.equal(Number(field.IsLockField), 1, `${name} must keep its physical identity`);
        }
    }

    const legacy = fieldsByName.get("FormPresentation");
    assert.ok(legacy, "legacy FormPresentation must remain for old data compatibility");
    assert.equal(Number(legacy.Visible), 0);
    assert.equal(Number(legacy.AppVisible), 0);
    assert.equal(fieldsByName.has("OpenFirstRecord"), false, "default-first-record belongs to sys_menu only");

    const tabsField = fieldsByName.get("Tabs");
    assert.ok(tabsField, "diy_table.Tabs metadata must exist");
    const tabsConfig = typeof tabsField.Config === "string" ? JSON.parse(tabsField.Config) : tabsField.Config;
    const badgeApiEngineColumn = tabsConfig.JsonTable?.Columns?.find((item) => item.Key === "BadgeApiEngineKey");
    assert.ok(badgeApiEngineColumn, "diy_table.Tabs must expose BadgeApiEngineKey");
    const menuBadgeApiEngineField = moduleResource.DiyFields.find((item) => (
        item.TableName === "sys_menu" && item.Name === "MenuBadgeApiEngineKey"
    ));
    assert.ok(menuBadgeApiEngineField, "module engine package must own sys_menu.MenuBadgeApiEngineKey metadata");
    assert.equal(
        badgeApiEngineColumn.Config?.DataSourceFieldId,
        menuBadgeApiEngineField.Id,
        "diy_table.Tabs.BadgeApiEngineKey must proxy a real diy_field"
    );
    assert.equal(badgeApiEngineColumn.Config?.DataSource, "Sql");
    assert.equal(badgeApiEngineColumn.Config?.DataSourceSqlRemote, true);
    assert.match(badgeApiEngineColumn.Config?.Sql || "", /\$Keyword\$/);
    assert.match(badgeApiEngineColumn.Config?.Sql || "", /limit\s+0\s*,\s*50/i);

    const ddl = resource.DDLStatements.find((item) => item.TableId === tableId)?.DDL || "";
    for (const names of Object.values(expectedFieldsByTab)) {
        for (const name of names.filter((item) => item !== "TabsPosition")) {
            assert.match(ddl, new RegExp("`" + name + "`", "i"), `${name} must be a diy_table physical column`);
        }
    }
}

test("form designer presentation is stored in semantic diy_table fields and peer property tabs", () => {
    assertPresentationResource(parseResource(resourceUrl), parseResource(moduleResourceUrl));
});

test("DiyTable model projects every semantic presentation field", () => {
    const model = fs.readFileSync(modelUrl, "utf8");
    for (const names of Object.values(expectedFieldsByTab)) {
        for (const name of names.filter((item) => item !== "TabsPosition")) {
            const type = name === "FormBannerEnabled" ? "int\\?" : "string";
            assert.match(model, new RegExp(`\\[Field\\("${name}"\\)\\][\\s\\S]{0,160}public ${type} ${name}\\b`));
        }
    }
});
