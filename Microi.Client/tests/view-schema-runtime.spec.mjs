import assert from "node:assert/strict";
import test from "node:test";
import {
    filterStandaloneListFields,
    getModuleViewFieldNames,
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

test("selectModuleView falls back to All and rejects disabled custom form views", () => {
    const selected = selectModuleView(menu, {
        scene: "Detail",
        device: "PC",
        user: { RoleIds: ["sales"] }
    });
    assert.equal(selected.Key, "default-detail");
    assert.equal(hasModuleDetailView({ ...menu, EnableViewSchema: 0 }, {}), false);
    assert.equal(selectModuleView({ ...menu, EnableViewSchema: 0 }, { scene: "Edit", device: "PC" }), null);
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

test("List and Card layouts preserve composite presentation fields", () => {
    const presentationMenu = {
        EnableViewSchema: 0,
        ViewSchema: {
            Views: [
                {
                    Key: "contract-list",
                    Scene: "List",
                    Device: "All",
                    Layout: {
                        Hero: {
                            Eyebrow: "PURCHASE CONTRACT",
                            Title: "采购合同",
                            Metrics: [{ Key: "total", Label: "数量", ApiEngineKey: "contract_stats", ValuePath: "Data.Total" }]
                        },
                        List: {
                            Columns: [{
                                Field: "ContractName",
                                Lines: [{ Name: "Signer", Label: "签约", ShowLabel: true, Tone: "info" }],
                                TrailingFields: [{ Name: "StockWarning", Icon: "fas fa-triangle-exclamation", Tone: "danger" }]
                            }]
                        }
                    }
                },
                {
                    Key: "contract-card",
                    Scene: "Card",
                    Device: "Mobile",
                    Layout: {
                        Card: {
                            AvatarTextField: "CustomerName",
                            TitleField: "ContractName",
                            TopFields: [{ Name: "Status", DisplayStyle: "Tag" }],
                            RightFields: [{ Name: "Amount", Prefix: "¥", Tone: "danger" }],
                            MetaFields: ["ContractNo", "CreateUserName"],
                            BottomFields: ["ContactCount"]
                        }
                    }
                }
            ]
        }
    };
    const listView = selectModuleView(presentationMenu, { scene: "List", device: "PC" });
    const cardView = selectModuleView(presentationMenu, { scene: "Card", device: "Mobile" });
    assert.equal(listView.Layout.Hero.Eyebrow, "PURCHASE CONTRACT");
    assert.equal(listView.Layout.List.Columns[0].Lines[0].ShowLabel, true);
    assert.equal(cardView.Layout.Card.RightFields[0].Prefix, "¥");
    assert.deepEqual(getModuleViewFieldNames(listView), ["ContractName", "Signer", "StockWarning"]);
    assert.deepEqual(
        getModuleViewFieldNames(cardView),
        ["CustomerName", "ContractName", "Status", "Amount", "ContractNo", "CreateUserName", "ContactCount"]
    );
});

test("List hero accepts safe built-in total and current-page metrics", () => {
    const builtInMenu = {
        EnableViewSchema: 0,
        ViewSchema: {
            Views: [{
                Key: "built-in-metrics",
                Scene: "List",
                Device: "All",
                Layout: {
                    Hero: {
                        Metrics: [
                            { Source: "DataCount" },
                            { Source: "PageCount", Label: "当前页" },
                            { Source: "Unknown" }
                        ]
                    }
                }
            }]
        }
    };
    const view = selectModuleView(builtInMenu, { scene: "List", device: "PC" });
    assert.deepEqual(view.Layout.Hero.Metrics.map((item) => item.Source), ["DataCount", "PageCount"]);
    assert.deepEqual(view.Layout.Hero.Metrics.map((item) => item.Key), ["DataCount", "PageCount"]);
    assert.equal(view.Layout.Hero.Metrics[0].Label, "总记录数");
});

test("composite list auxiliaries do not repeat as ordinary columns and primary fields always win", () => {
    const view = {
        Layout: {
            List: {
                Columns: [
                    {
                        Field: "ContractName",
                        Lines: [{ Name: "Signer" }],
                        TrailingFields: [{ Name: "StockWarning" }]
                    },
                    {
                        Field: "Signer",
                        Lines: [{ Name: "ContractNo" }]
                    }
                ]
            }
        }
    };
    const fields = [
        { Id: "f1", Name: "ContractName" },
        { Id: "f2", Name: "Signer" },
        { Id: "f3", Name: "StockWarning" },
        { Id: "f4", Name: "ContractNo" },
        { Id: "f5", Name: "Amount" }
    ];

    assert.deepEqual(
        filterStandaloneListFields(fields, view).map((field) => field.Name),
        ["ContractName", "Signer", "Amount"]
    );
    assert.equal(filterStandaloneListFields(fields, null), fields);
});
