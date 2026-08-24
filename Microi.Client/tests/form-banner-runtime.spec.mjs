import assert from "node:assert/strict";
import test from "node:test";

import { hasFormBannerConfig } from "../src/views/form-engine/field-display-value.js";
import {
    buildFormBannerRelatedMetrics,
    collectFormBannerMetricApiGroups,
    firstBannerFilePath,
    getFormBannerChildRelationFields,
    isMeaningfulFormBannerMetricField,
    isPrivateBannerUploadField,
    migrateLegacyModuleHeroBanner,
    normalizeFormBannerConfig,
    resolveFormBannerMetricValue
} from "../src/views/form-engine/form-banner-runtime.js";
import { resolveFormPresentationConfig } from "../src/views/form-engine/form-presentation-runtime.js";

const fields = [
    { Name: "OrderNo", Label: "订单编号", Component: "AutoNumber", Type: "varchar(50)", Visible: 1 },
    { Name: "CustomerName", Label: "客户名称", Component: "Text", Type: "varchar(100)", Visible: 1 },
    { Name: "Cover", Label: "订单图片", Component: "ImgUpload", Type: "mediumtext", Visible: 1 },
    { Name: "Status", Label: "订单状态", Component: "Select", Type: "varchar(50)", Visible: 1 },
    { Name: "Amount", Label: "订单金额", Component: "NumberText", Type: "decimal(18,2)", Visible: 1 }
];

test("legacy tables show Banner and infer business fields", () => {
    assert.equal(hasFormBannerConfig(undefined), true);
    const banner = normalizeFormBannerConfig(undefined, fields, { Description: "订单" });
    assert.equal(banner.Enabled, true);
    assert.equal(banner.TitleField, "OrderNo");
    assert.equal(banner.SubtitleField, "CustomerName");
    assert.equal(banner.ImageField, "Cover");
    assert.deepEqual(banner.Tags.map((item) => item.Field), ["Status"]);
    assert.deepEqual(banner.Metrics.map((item) => item.Field), ["Amount"]);
});

test("explicit disable and empty lists override smart defaults", () => {
    assert.equal(hasFormBannerConfig({ Enabled: 0 }), false);
    const banner = normalizeFormBannerConfig({ Enabled: 0, Tags: [], Metrics: [] }, fields);
    assert.equal(banner.Enabled, false);
    assert.deepEqual(banner.Tags, []);
    assert.deepEqual(banner.Metrics, []);
    assert.equal(banner._MetricsInferred, false);
});

test("default metrics reject technical integers instead of fabricating statistics", () => {
    const technicalFields = [
        { Name: "Sort", Label: "排序", Component: "NumberText", Type: "int", Visible: 1 },
        { Name: "PageSize", Label: "本页加载", Component: "NumberText", Type: "int", Visible: 1 },
        { Name: "ApiType", Label: "接口类型", Component: "Select", Type: "int", Visible: 1 },
        { Name: "V8Limit", Label: "V8运行限制", Component: "Switch", Type: "tinyint", Visible: 1 },
        { Name: "Amount", Label: "订单金额", Component: "NumberText", Type: "decimal(18,2)", Visible: 1 }
    ];
    assert.deepEqual(normalizeFormBannerConfig(undefined, technicalFields).Metrics.map((item) => item.Field), ["Amount"]);
    assert.equal(isMeaningfulFormBannerMetricField(technicalFields[0]), false);
    assert.equal(isMeaningfulFormBannerMetricField(technicalFields[4]), true);
});

test("legacy module Hero keeps visuals but drops list-wide metrics from record Banner", () => {
    const migrated = migrateLegacyModuleHeroBanner({
        TitleField: "ApiName",
        Background: "linear-gradient(red, blue)",
        Metrics: [
            { Key: "System", Label: "系统", Source: "DataCount" },
            { Key: "Business", Label: "业务", Source: "Statistics", Field: "ApiType" }
        ]
    });
    assert.equal(migrated.TitleField, "ApiName");
    assert.equal(migrated.Background, "linear-gradient(red, blue)");
    assert.equal(Object.hasOwn(migrated, "Metrics"), false);
});

test("legacy module Hero only migrates metrics explicitly scoped to the current record", () => {
    const migrated = migrateLegacyModuleHeroBanner({
        Metrics: [
            { Key: "Amount", Field: "Amount", Source: "Field" },
            { Key: "Related", ApiEngineKey: "record_metrics", ParamMap: { RecordId: "Form.Id" } },
            { Key: "Global", ApiEngineKey: "global_metrics", ParamMap: { Type: "all" } }
        ]
    });
    assert.deepEqual(migrated.Metrics.map((item) => item.Key), ["Amount", "Related"]);
});

test("authorized child results become record-related sums and counts", () => {
    const relation = {
        Id: "relation-1",
        Name: "PaymentLines",
        Label: "付款明细",
        Component: "TableChild",
        Visible: 1,
        Config: {
            TableChildTableId: "child-table",
            TableChildSysMenuId: "child-menu",
            TableChildFkFieldName: "OrderId"
        }
    };
    assert.equal(getFormBannerChildRelationFields([relation]).length, 1);
    const related = buildFormBannerRelatedMetrics(relation, [
        { Name: "Amount", Label: "付款金额", Component: "NumberText", Type: "decimal(18,2)" },
        { Name: "Sort", Label: "排序", Component: "NumberText", Type: "int" }
    ], {
        Code: 1,
        DataCount: 4,
        DataAppend: { StatisticsFields: { Amount: 1280.5, Sort: 10 } }
    });
    assert.deepEqual(related.map((item) => [item.Label, item.Value]), [
        ["付款金额合计", 1280.5],
        ["付款明细数量", 4]
    ]);
});

test("physical diy_table fields normalize into the Banner contract", () => {
    const config = resolveFormPresentationConfig({
        FormBannerEnabled: 1,
        FormBannerTitleField: "OrderNo",
        FormBannerSubtitleField: "CustomerName",
        FormBannerTagFields: '[{"Field":"Status"}]',
        FormBannerMetrics: '[{"Key":"Pending","ApiEngineKey":"order_metrics","ValuePath":"Data.Pending"}]'
    });
    assert.equal(config.Banner.Enabled, 1);
    assert.equal(config.Banner.TitleField, "OrderNo");
    assert.deepEqual(config.Banner.Tags, [{ Field: "Status" }]);
    assert.equal(config.Banner.Metrics[0].ApiEngineKey, "order_metrics");
});

test("ApiEngine metrics group once per engine and resolve standard response paths", () => {
    const metrics = [
        { Key: "Pending", ApiEngineKey: "order_metrics", ValuePath: "Data.Pending" },
        { Key: "Paid", ApiEngineKey: "order_metrics" },
        { Key: "Amount", Field: "Amount" }
    ];
    const groups = collectFormBannerMetricApiGroups(metrics);
    assert.equal(groups.size, 1);
    assert.equal(groups.get("order_metrics").length, 2);
    assert.equal(resolveFormBannerMetricValue({ Code: 1, Data: { Pending: 7 } }, groups.get("order_metrics")[0]), 7);
    assert.equal(resolveFormBannerMetricValue({ Code: 1, Data: { Metrics: { Paid: 3 } } }, groups.get("order_metrics")[1]), 3);
});

test("single and multiple upload values use the first Microi file path", () => {
    assert.equal(firstBannerFilePath('/file/order.png'), '/file/order.png');
    assert.equal(firstBannerFilePath('[{"Id":"1","Path":"/file/first.png"},{"Path":"/file/second.png"}]'), '/file/first.png');
    assert.equal(firstBannerFilePath('[{}, {"FilePathName":"/private/usable.png"}]'), '/private/usable.png');
    assert.equal(isPrivateBannerUploadField({ Config: '{"ImgUpload":{"Limit":true}}' }), true);
    assert.equal(isPrivateBannerUploadField({ Config: { ImgUpload: { Limit: false } } }), false);
});
