import assert from "node:assert/strict";
import test from "node:test";
import { loadClientModule } from "./helpers/load-client-module.mjs";

test("关闭表格 Banner 时跳过统计接口但保留按钮角标请求", async () => {
    const { default: presentation } = await loadClientModule(new URL(
        "../src/views/form-engine/mixins/diy-table-presentation.mixin.js",
        import.meta.url
    ));
    const calls = [];
    const context = {
        HideTableTopBanner: true,
        ModuleHero: { Metrics: [{ Key: "total", ApiEngineKey: "module-total" }] },
        SysMenuModel: {
            PageTabs: [{ Name: "附件", BadgeEnabled: 1, BadgeApiEngineKey: "attachment_counts" }]
        },
        DiyCommon: { ApiEngine: { Run: async (...args) => {
            calls.push(args);
            return { Code: 1, Data: { Buttons: { "附件": 4 } } };
        } } },
        _presentationContext: () => ({}),
        _presentationRequestGeneration: 1,
        ModuleMetricValues: { old: 1 },
        ButtonBadgeValues: { old: 1 },
        ModuleMetricLoading: true
    };

    await presentation.methods.RefreshModulePresentationData.call(context, [], {}, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], "attachment_counts");
    assert.deepEqual(context.ModuleMetricValues, {});
    assert.equal(context.ModuleMetricLoading, false);
});
