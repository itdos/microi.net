import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
    buildFormPresentationSections,
    collectFormSectionBadgeApiGroups,
    formatPresentationText,
    getFormSectionBadgeRefreshSeconds,
    getPresentationValueByPath,
    resolveFormPresentationConfig,
    resolveFormSectionBadgeValue
} from "../src/views/form-engine/form-presentation-runtime.js";

test("forms default to the modern workbench while classic remains an explicit escape", () => {
    const defaults = resolveFormPresentationConfig({}, {}, "");
    assert.equal(defaults.Presentation, "ControlCenter");
    assert.equal(defaults.Navigation.Title, "表单分组");
    assert.equal(defaults.Navigation.CountText, "{count} 项");

    const classic = resolveFormPresentationConfig(
        { FormPresentation: { Presentation: "ControlCenter" } },
        { Presentation: "SettingsCenter" },
        "Classic"
    );
    assert.equal(classic.Presentation, "Classic");
});

test("legacy SettingsCenter is canonicalized to the shared ControlCenter contract", () => {
    const resolved = resolveFormPresentationConfig({}, { Presentation: "SettingsCenter" }, "");
    assert.equal(resolved.Presentation, "ControlCenter");
});

test("diy_table presentation and Tabs metadata override the legacy module configuration", () => {
    const config = resolveFormPresentationConfig({
        FormPresentation: JSON.stringify({
            NavigationTitle: "业务分组",
            Sections: [{ Key: "base", Title: "表级标题", CountSuffix: "个配置" }]
        })
    }, {
        NavigationTitle: "旧配置分组",
        Sections: [{ Key: "base", Title: "旧模块标题", Icon: "far fa-star" }]
    });
    const sections = buildFormPresentationSections({
        table: {
            Description: "测试表",
            Tabs: [{ Id: "base", Name: "基础", Title: "表级 Tab 标题", SubtitleHtml: "表级共 {count} 项" }]
        },
        config,
        tabs: [{ Id: "base", Name: "基础" }],
        groupedFields: { base: [{ Name: "Name", Component: "Text", NotEmpty: 1 }] }
    });

    assert.equal(config.Navigation.Title, "业务分组");
    assert.equal(sections[0].Title, "表级 Tab 标题");
    assert.equal(sections[0].Icon, "far fa-star");
    assert.equal(sections[0].NavigationSubtitleHtml, "表级共 1 项");
    assert.equal(sections[0].RequiredCount, 1);
});

test("semantic diy_table fields override legacy FormPresentation JSON", () => {
    const config = resolveFormPresentationConfig({
        FormPresentation: JSON.stringify({
            Presentation: "Classic",
            NavigationTitle: "旧分组",
            WorkbenchEyebrow: "OLD WORKBENCH",
            RecordSelector: {
                Placeholder: "旧占位",
                LabelFields: ["OldName"]
            }
        }),
        FormPresentationMode: "ControlCenter",
        FormNavigationTitle: "业务分组",
        FormWorkbenchEyebrow: "FORM WORKBENCH",
        FormWorkbenchDescription: "<b>统一表单工作台</b>",
        FormRecordSelectorPlaceholder: "搜索并切换记录",
        FormRecordSelectorLabelFields: "[\"Name\",\"Code\"]"
    }, {}, "");

    assert.equal(config.Presentation, "ControlCenter");
    assert.equal(config.Navigation.Title, "业务分组");
    assert.equal(config.WorkbenchEyebrow, "FORM WORKBENCH");
    assert.equal(config.WorkbenchDescription, "<b>统一表单工作台</b>");
    assert.equal(config.RecordSelector.Placeholder, "搜索并切换记录");
    assert.deepEqual(config.RecordSelector.LabelFields, ["Name", "Code"]);
});

test("record selector label fields also accept designer-friendly comma separated values", () => {
    const config = resolveFormPresentationConfig({
        FormRecordSelectorLabelFields: "Name，Code\nAccount"
    }, {}, "");

    assert.deepEqual(config.RecordSelector.LabelFields, ["Name", "Code", "Account"]);
});

test("section counts exclude layout controls and expose field and required tags", () => {
    const [section] = buildFormPresentationSections({
        table: { Description: "系统设置" },
        config: resolveFormPresentationConfig({}, {}),
        tabs: [{ Id: "info", Name: "info", CountSuffix: "项" }],
        groupedFields: {
            info: [
                { Name: "Divider1", Component: "Divider", NotEmpty: 1 },
                { Name: "Name", Component: "Text", NotEmpty: "true" },
                { Name: "Hidden", Component: "Text", NotEmpty: 1, _isShow: false },
                { Name: "Remark", Component: "Textarea", NotEmpty: 0 }
            ]
        }
    });

    assert.equal(section.Title, "系统设置");
    assert.equal(section.FieldCount, 2);
    assert.equal(section.RequiredCount, 1);
    assert.equal(section.CountLabel, "2 项");
    assert.equal(section.RequiredLabel, "1 必填项");
});

test("badge requests are grouped by ApiEngineKey and values resolve per section", () => {
    const config = resolveFormPresentationConfig({}, {});
    const sections = buildFormPresentationSections({
        config,
        tabs: [
            {
                Id: "base",
                Name: "基础",
                BadgeApiEngineKey: "form_section_counts",
                BadgeParamMap: "{\"Scope\":\"current\"}",
                BadgeRefreshSeconds: 30
            },
            { Id: "security", Name: "安全", BadgeApiEngineKey: "form_section_counts", BadgeValuePath: "Data.Values.{SectionKey}", BadgeRefreshSeconds: 60 },
            { Id: "mobile", Name: "移动端", BadgeApiEngineKey: "mobile_count" }
        ],
        groupedFields: {}
    });
    const groups = collectFormSectionBadgeApiGroups(sections);

    assert.equal(groups.size, 2);
    assert.deepEqual(groups.get("form_section_counts").map((item) => item.section.Key), ["base", "security"]);
    assert.deepEqual(groups.get("form_section_counts")[0].badge.ParamMap, { Scope: "current" });
    assert.equal(getFormSectionBadgeRefreshSeconds(sections), 30);
    assert.equal(resolveFormSectionBadgeValue(
        { Data: { Sections: { base: 23 } } },
        groups.get("form_section_counts")[0]
    ), 23);
    assert.equal(resolveFormSectionBadgeValue(
        { Data: { Values: { security: 3 } } },
        groups.get("form_section_counts")[1]
    ), 3);
});

test("presentation value paths reject prototype traversal and text templates keep unknown tokens", () => {
    const source = { Data: { Rows: [{ Value: 8 }] } };
    assert.equal(getPresentationValueByPath(source, "Data.Rows[0].Value"), 8);
    assert.equal(getPresentationValueByPath(source, "Data.__proto__.polluted", "blocked"), "blocked");
    assert.equal(formatPresentationText("{count} 项 / {unknown}", { count: 5 }), "5 项 / {unknown}");
});

test("form presentation HTML is sanitized before the safe HTML directive renders it", async () => {
    const root = new URL("../", import.meta.url);
    const [form, state] = await Promise.all([
        readFile(new URL("src/views/form-engine/diy-form.vue", root), "utf8"),
        readFile(new URL("src/views/form-engine/mixins/diy-form-state.mixin.js", root), "utf8")
    ]);
    assert.doesNotMatch(form, /\bv-html\s*=/);
    assert.equal((form.match(/v-safe-html=/g) || []).length >= 3, true);
    assert.match(state, /import \{ sanitizeHtml \} from "@\/utils\/safe-html\.js"/);
    assert.match(state, /NavigationSubtitleHtml:\s*sanitizeHtml/);
    assert.match(state, /SectionSubtitleHtml:\s*sanitizeHtml/);
    assert.match(state, /FooterDescriptionHtml:\s*sanitizeHtml/);
});
