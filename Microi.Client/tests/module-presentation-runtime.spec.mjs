import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
    buildAutomaticPresentationMetrics,
    collectBadgeApiGroups,
    formatBadgeValue,
    getValueByPath,
    normalizeButtonBadge,
    normalizeMenuBadgeConfig,
    resolveButtonBadgeValue,
    resolveListPresentationHeader,
    resolveMetricValue
} from "../src/views/form-engine/form-view-blocks/module-presentation-runtime.js";

test("top-level desktop lists receive a compact default header without enabling ViewSchema", () => {
    const header = resolveListPresentationHeader({
        menu: { Name: "全量测试(勿删)", EnableViewSchema: 0 },
        table: { Description: "测试模块" },
        fields: [
            { Name: "TotalAmount", Label: "总金额", Component: "NumberText", Type: "decimal(18,2)" },
            { Name: "Status", Label: "状态", Component: "Select", Type: "varchar(25)" }
        ],
        statistics: { TotalAmount: 320.5 },
        rows: [{ Status: "待处理" }, { Status: "已完成" }],
        rowCount: 18
    });
    assert.equal(header.Visible, true);
    assert.equal(header.IsDefault, true);
    assert.equal(header.Title, "全量测试(勿删)");
    assert.equal(header.Description, "测试模块");
    assert.deepEqual(header.Metrics.map((metric) => metric.Label), ["总金额合计", "筛选结果", "本页待处理"]);

    assert.equal(resolveListPresentationHeader({ menu: { Name: "子表" }, isTableChild: true }).Visible, false);
    assert.equal(resolveListPresentationHeader({ menu: { Name: "嵌入表" }, embedded: true }).Visible, false);
    assert.equal(resolveListPresentationHeader({ menu: { Name: "关联表" }, isJoinTable: true }).Visible, false);
    assert.equal(resolveListPresentationHeader({ menu: { Name: "移动端" }, isPhoneView: true }).Visible, true);
});

test("legacy metric fallback uses real aggregates or labelled current-page values and never fabricates random data", () => {
    const fields = [
        { Name: "Amount", Label: "金额", Component: "NumberText", Type: "decimal(18,2)" },
        { Name: "Status", Label: "状态", Component: "Select", Type: "varchar(25)" }
    ];
    const aggregated = buildAutomaticPresentationMetrics({
        fields,
        statistics: { Amount: 99.5 },
        rows: [{ Amount: 10, Status: "待审核" }, { Amount: 20, Status: "待审核" }]
    });
    assert.equal(aggregated[0].DefaultValue, 99.5);
    assert.equal(aggregated[0].Label, "金额合计");

    const currentPage = buildAutomaticPresentationMetrics({ fields, rows: [{ Amount: 10 }, { Amount: "20.5" }] });
    assert.equal(currentPage[0].DefaultValue, 30.5);
    assert.equal(currentPage[0].Label, "本页金额");
    assert.doesNotMatch(JSON.stringify(currentPage), /random|随机/i);

    const generic = buildAutomaticPresentationMetrics({ fields: [{ Name: "Name", Label: "名称", Type: "varchar(200)" }], rows: [] });
    assert.deepEqual(generic.map((metric) => metric.Source), ["DataCount", "PageCount"]);
});

test("configured list presentation overrides the default title and mobile receives truthful fallback metrics", () => {
    const view = {
        Layout: {
            Hero: {
                Title: "采购合同",
                Description: "采购合同统计",
                Metrics: [{ Key: "total", Label: "数量", Field: "Id" }]
            }
        }
    };
    const desktop = resolveListPresentationHeader({ menu: { Name: "合同" }, view });
    assert.equal(desktop.Visible, true);
    assert.equal(desktop.IsDefault, false);
    assert.equal(desktop.Title, "采购合同");

    const mobile = resolveListPresentationHeader({ menu: { Name: "合同" }, view, isPhoneView: true });
    assert.equal(mobile.Visible, true);
    assert.equal(mobile.Metrics.length, 1);
    const titleOnlyMobile = resolveListPresentationHeader({
        menu: { Name: "合同" },
        view: { Layout: { Hero: { Title: "仅标题", Metrics: [] } } },
        isPhoneView: true
    });
    assert.equal(titleOnlyMobile.Visible, true);
    assert.deepEqual(titleOnlyMobile.Metrics.map((metric) => metric.Source), ["DataCount", "PageCount"]);
});

test("menu badge configuration is disabled unless both switch and ApiEngine are configured", () => {
    assert.equal(normalizeMenuBadgeConfig({ Enabled: 1 }).Enabled, false);
    const config = normalizeMenuBadgeConfig({ Enabled: 1, ApiEngineKey: "inventory_badge" });
    assert.equal(config.Enabled, true);
    assert.equal(config.ValuePath, "Data.Value");
    assert.equal(formatBadgeValue(210, config), "99+");
    assert.equal(formatBadgeValue(0, config), null);
});

test("safe response paths support arrays and reject prototype traversal", () => {
    const response = { Data: { Rows: [{ Value: 7 }] } };
    assert.equal(getValueByPath(response, "Data.Rows[0].Value"), 7);
    assert.equal(getValueByPath(response, "Data.__proto__.polluted", "blocked"), "blocked");
});

test("button badge accepts visual flattened fields and resolves page and row values", () => {
    const button = {
        Name: "附件",
        BadgeEnabled: 1,
        BadgeApiEngineKey: "attachment_counts",
        BadgeTone: "warning",
        BadgeMax: 999,
        BadgeRefreshSeconds: 60
    };
    const badge = normalizeButtonBadge(button);
    const response = {
        Data: {
            Buttons: { "附件": 12 },
            Rows: { row1: { "附件": 3 } }
        }
    };
    assert.equal(badge.Enabled, true);
    assert.equal(badge.RefreshSeconds, 60);
    assert.equal(resolveButtonBadgeValue(response, badge, "附件"), 12);
    assert.equal(resolveButtonBadgeValue(response, badge, "附件", "row1"), 3);
    assert.equal(collectBadgeApiGroups([[button]]).get("attachment_counts").length, 1);
});

test("metric values can be selected explicitly or inferred by metric key", () => {
    assert.equal(resolveMetricValue({ Data: { Total: 176 } }, { ValuePath: "Data.Total" }), 176);
    assert.equal(resolveMetricValue({ Data: { Metrics: { unpaid: 23 } } }, { Key: "unpaid" }), 23);
});

test("PageTabs badges stay inside the tabs layout instead of using clipped negative offsets", () => {
    const source = fs.readFileSync(new URL("../src/styles/diy-table.scss", import.meta.url), "utf8");
    const block = source.match(/\.page-tab-stat-badge\s*\{([\s\S]*?)\n\}/)?.[1] || "";
    assert.match(block, /position:\s*relative/);
    assert.match(block, /inset:\s*auto/);
    assert.doesNotMatch(block, /(?:top|inset-block-start):\s*-\d/);
});

test("templated trailing fields render their own visual without a second chip or descriptor icon", () => {
    const source = fs.readFileSync(new URL("../src/views/form-engine/diy-table.vue", import.meta.url), "utf8");
    const start = source.indexOf('v-for="trailingField in GetListColumnTrailingFields(field)"');
    const block = start >= 0 ? source.slice(start, start + 1800) : "";
    const templateEnd = block.indexOf("v-else");
    const templateBranch = templateEnd >= 0 ? block.slice(0, templateEnd) : block;
    assert.match(templateBranch, /v-if="isMuban\(trailingField, scope\)"/);
    assert.match(templateBranch, /class="module-composite-template-result"/);
    assert.doesNotMatch(templateBranch, /<fa-icon/);
    assert.match(block.slice(templateEnd), /class="module-composite-chip"/);
    assert.match(block.slice(templateEnd), /<fa-icon v-if="trailingField\.Icon"/);
});

test("mobile cards hide empty configured regions and avoid duplicate field suffixes", () => {
    const tableSource = fs.readFileSync(new URL("../src/views/form-engine/diy-table.vue", import.meta.url), "utf8");
    const mixinSource = fs.readFileSync(new URL("../src/views/form-engine/mixins/diy-table-presentation.mixin.js", import.meta.url), "utf8");

    assert.match(tableSource, /HasAnyPresentationFieldValue\(item, CardRightFieldList\)/);
    assert.match(tableSource, /GetVisibleCardContentFields\(item\)/);
    assert.match(tableSource, /GetPresentationDecoratedFieldValue\(item, rightField\)/);
    assert.match(mixinSource, /valueTrimmed\.endsWith\(suffix\.trim\(\)\)/);
    assert.match(mixinSource, /canInlineEdit \|\| this\.HasPresentationFieldValue\(row, field\)/);
});

test("module header, metric strip and compound search consume runtime theme tokens", () => {
    const styleSource = fs.readFileSync(new URL("../src/styles/diy-table.scss", import.meta.url), "utf8");
    const buttonSource = fs.readFileSync(new URL("../src/styles/itdos.diy.scss", import.meta.url), "utf8");
    const headerStart = styleSource.indexOf(".module-presentation-header {");
    const headerBlock = headerStart >= 0 ? styleSource.slice(headerStart, headerStart + 9000) : "";
    const searchStart = styleSource.indexOf(".keyword-search {");
    const searchBlock = searchStart >= 0 ? styleSource.slice(searchStart, searchStart + 6500) : "";

    assert.match(headerBlock, /--mci-presentation-header-bg/);
    assert.match(headerBlock, /--metric-surface/);
    assert.match(headerBlock, /--metric-icon-surface/);
    assert.match(headerBlock, /--mci-presentation-accent-gradient/);
    assert.match(headerBlock, /grid-template-columns:\s*minmax\(250px,\s*0\.78fr\)\s*minmax\(0,\s*2\.22fr\)/);
    assert.match(headerBlock, /\.module-presentation-header \.module-metric-strip[\s\S]*?border:\s*0/);
    assert.match(headerBlock, /\.module-presentation-header \.module-metric-item[\s\S]*?background:\s*var\(--metric-surface\)/);
    assert.doesNotMatch(headerBlock, /background:\s*rgba\(248,\s*250,\s*252,\s*0\.68\)/);
    assert.match(searchBlock, /focus-within/);
    assert.match(searchBlock, /--mci-gradient-primary/);
    assert.match(searchBlock, /overflow:\s*hidden/);
    assert.match(buttonSource, /height:\s*100%[\s\S]*?border-radius:\s*inherit/);
});

test("composite MinWidth remains the flex minimum and unconfigured fields receive semantic widths", () => {
    const source = fs.readFileSync(new URL("../src/views/form-engine/mixins/diy-table-ui.mixin.js", import.meta.url), "utf8");
    const start = source.indexOf("GetColWidth(field, fieldIndex)");
    const block = start >= 0 ? source.slice(start, start + 2600) : "";
    assert.match(block, /presentationColumn\.MinWidth/);
    assert.doesNotMatch(block, /fieldIndex\s*==\s*visibleFields\.length\s*-\s*1/);
    assert.match(block, /return 200/);
    assert.match(block, /return 170/);
    assert.match(block, /return 140/);
});
