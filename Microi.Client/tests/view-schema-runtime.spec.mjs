import assert from "node:assert/strict";
import test from "node:test";
import {
    hasModuleDetailView,
    isActionVisible,
    selectModuleView
} from "../src/views/form-engine/form-view-blocks/view-schema-runtime.js";

const menu = {
    EnableViewSchema: 1,
    ViewSchema: JSON.stringify({
        Views: [
            {
                Key: "default-detail",
                Scene: "Detail",
                Device: "All",
                Priority: 10,
                Layout: {
                    Hero: { TitleField: "Name" },
                    Blocks: [{ Type: "ResponsiveSection", Title: "基础信息", Fields: ["Name"] }],
                    Actions: [{
                        Key: "archive",
                        Label: "归档",
                        ActionType: "ApiEngine",
                        ApiEngineKey: "archive_record",
                        VisibleWhen: {
                            Mode: "All",
                            Rules: [{ Field: "Status", Operator: "!=", Value: "已归档" }]
                        },
                        V8Code: "throw new Error('must be removed')"
                    }]
                }
            },
            {
                Key: "manager-detail",
                Scene: "Detail",
                Device: "PC",
                RoleIds: ["manager"],
                Priority: 20,
                Layout: { Hero: { Title: "管理视图", TitleField: "Name" } }
            }
        ]
    })
};

test("selectModuleView chooses the role-specific PC detail view", () => {
    const selected = selectModuleView(menu, {
        scene: "Detail",
        device: "PC",
        user: { RoleIds: ["manager"] }
    });
    assert.equal(selected.Key, "manager-detail");
    assert.equal(selected.Layout.Hero.Title, "管理视图");
});

test("selectModuleView falls back to All and rejects disabled protocol", () => {
    const selected = selectModuleView(menu, {
        scene: "Detail",
        device: "PC",
        user: { RoleIds: ["sales"] }
    });
    assert.equal(selected.Key, "default-detail");
    assert.equal(hasModuleDetailView({ ...menu, EnableViewSchema: 0 }, {}), false);
});

test("malformed ViewSchema never enables the renderer", () => {
    assert.equal(hasModuleDetailView({ EnableViewSchema: 1, ViewSchema: "{" }, {}), false);
});

test("physical ViewSchema actions are normalized without executable V8", () => {
    const selected = selectModuleView(menu, {
        scene: "Detail",
        device: "PC",
        user: { RoleIds: ["sales"] }
    });
    assert.equal(selected.Layout.Actions[0].ApiEngineKey, "archive_record");
    assert.equal(Object.hasOwn(selected.Layout.Actions[0], "V8Code"), false);
    assert.equal(isActionVisible(selected.Layout.Actions[0], { Status: "跟进中" }), true);
    assert.equal(isActionVisible(selected.Layout.Actions[0], { Status: "已归档" }), false);
});

test("retired DiyConfig cannot enable the unified view renderer", () => {
    assert.equal(hasModuleDetailView({
        EnableViewSchema: 1,
        DiyConfig: menu.ViewSchema
    }, {}), false);
});
