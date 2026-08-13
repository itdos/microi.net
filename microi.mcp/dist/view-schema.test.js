import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDefaultModulePresentation, inferTableColumnWidth, normalizeAllMenuJson, normalizeViewSchemaJson, } from './advanced-tools.js';
test('builds mandatory List/Card presentation without enabling or inventing custom forms', () => {
    const schema = buildDefaultModulePresentation('订单管理', [
        { Id: 'f1', Name: 'OrderTitle', Label: '订单标题', Component: 'Text', Type: 'varchar(200)' },
        { Id: 'f2', Name: 'CustomerName', Label: '客户名称', Component: 'Text', Type: 'varchar(200)' },
        { Id: 'f3', Name: 'Status', Label: '状态', Component: 'Select', Type: 'varchar(25)' },
        { Id: 'f4', Name: 'TotalAmount', Label: '订单金额', Component: 'NumberText', Type: 'decimal(18,2)' },
        { Id: 'f5', Name: 'OwnerName', Label: '负责人', Component: 'Text', Type: 'varchar(100)' },
        { Id: 'f6', Name: 'CreateTime', Label: '创建时间', Component: 'DateTime', Type: 'varchar(25)' },
    ], '订单业务台账');
    const views = schema.Views;
    assert.deepEqual(views.map((view) => view.Scene), ['List', 'Card']);
    assert.equal(views.some((view) => ['Detail', 'Edit'].includes(view.Scene)), false);
    const list = views[0].Layout.List;
    const hero = views[0].Layout.Hero;
    assert.equal(list.Density, 'Compact');
    assert.ok(list.Columns[0].MinWidth >= 340);
    assert.ok(list.Columns[0].Lines.length >= 1);
    assert.ok(list.Columns[0].TrailingFields.length >= 1);
    assert.deepEqual(hero.Metrics.map((metric) => metric.Source), ['Field', 'DataCount', 'PageCount']);
    const card = views[1].Layout.Card;
    assert.equal(card.TitleField, 'OrderTitle');
    assert.ok(card.SubtitleFields.length >= 1);
    assert.ok(card.StatusFields.length >= 1);
    assert.ok(card.RightFields.length >= 1);
    assert.ok(card.MetaFields.length >= 1);
    assert.equal(normalizeViewSchemaJson(schema).ok, true);
});
test('default presentation without numeric fields uses truthful counts and semantic field widths', () => {
    const schema = buildDefaultModulePresentation('客户管理', [
        { Name: 'CustomerName', Label: '客户名称', Component: 'Text', Type: 'varchar(200)' },
        { Name: 'Phone', Label: '手机号', Component: 'Text', Type: 'varchar(25)' },
    ]);
    const views = schema.Views;
    assert.deepEqual(views[0].Layout.Hero.Metrics.map((metric) => metric.Source), ['DataCount', 'PageCount']);
    assert.doesNotMatch(JSON.stringify(schema), /random|随机/i);
    assert.equal(inferTableColumnWidth({ Name: 'CustomerName', Label: '客户名称', Component: 'Text' }), 200);
    assert.equal(inferTableColumnWidth({ Name: 'CreateTime', Label: '创建时间', Component: 'DateTime' }), 170);
    assert.equal(inferTableColumnWidth({ Name: 'Amount', Label: '金额', Component: 'NumberText', Type: 'decimal(18,2)' }), 140);
});
test('normalizes a declarative cross-client view schema', () => {
    const result = normalizeViewSchemaJson({
        Views: [{
                Scene: 'Detail',
                Device: 'All',
                Layout: {
                    Actions: [{
                            ActionType: 'ApiEngine',
                            ApiEngineKey: 'customer_archive',
                            ParamMap: { Id: '$form.Id' },
                        }],
                },
            }],
    });
    assert.equal(result.ok, true);
    assert.match(result.value || '', /customer_archive/);
});
test('rejects executable frontend code in ViewSchema', () => {
    const result = normalizeViewSchemaJson({
        Views: [{
                Scene: 'Detail',
                Layout: {
                    Actions: [{
                            ActionType: 'ApiEngine',
                            ApiEngineKey: 'customer_archive',
                            V8Code: 'V8.ApiEngine.Run("customer_archive")',
                        }],
                },
            }],
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /不允许包含可执行前端脚本字段/);
});
test('rejects unregistered actions and missing ApiEngineKey', () => {
    const invalidAction = normalizeViewSchemaJson({
        Views: [{
                Scene: 'List',
                Layout: { Actions: [{ ActionType: 'RunJavaScript' }] },
            }],
    });
    const missingKey = normalizeViewSchemaJson({
        Views: [{
                Scene: 'Detail',
                Layout: { Actions: [{ ActionType: 'ApiEngine' }] },
            }],
    });
    assert.equal(invalidAction.ok, false);
    assert.match(invalidAction.errors.join('\n'), /ActionType 不受支持/);
    assert.equal(missingKey.ok, false);
    assert.match(missingKey.errors.join('\n'), /必须配置 ApiEngineKey/);
});
test('preserves declarative List and Card presentation configuration', () => {
    const schema = {
        Views: [
            {
                Scene: 'List',
                Device: 'PC',
                Layout: {
                    Hero: {
                        Title: '采购合同',
                        Metrics: [{
                                Key: 'pending',
                                Label: '待付款',
                                ApiEngineKey: 'purchase_contract_metrics',
                                ValuePath: 'Data.Pending',
                                TrendPath: 'Data.Trend',
                                RefreshSeconds: 60,
                            }],
                    },
                    List: {
                        Density: 'Comfortable',
                        Columns: [{
                                Field: 'ContractName',
                                Lines: [
                                    { Name: 'ContractName', FontWeight: '600' },
                                    { Name: 'SignerName', Prefix: '签约：', Tone: 'muted' },
                                ],
                                TrailingFields: [{ Name: 'StockStatus', Icon: 'Warning', DisplayStyle: 'Tag' }],
                                RequiredFields: ['SignerName', 'StockStatus'],
                            }],
                    },
                },
            },
            {
                Scene: 'Card',
                Device: 'Mobile',
                Layout: {
                    Card: {
                        AvatarTextField: 'CustomerName',
                        TitleField: 'CustomerName',
                        SubtitleFields: ['CustomerNo', 'OwnerName'],
                        StatusFields: [{ Name: 'Status', DisplayStyle: 'Tag' }],
                        TopFields: [{ Name: 'Category', DisplayStyle: 'Tag' }],
                        RightFields: [{ Name: 'Receivable', Format: 'currency', Tone: 'danger' }],
                        Fields: ['ContactName'],
                        MetaFields: [{ Name: 'CreateTime', Format: 'datetime' }],
                        BottomFields: ['ContractCount'],
                    },
                },
            },
        ],
    };
    const result = normalizeViewSchemaJson(schema);
    assert.equal(result.ok, true);
    assert.deepEqual(JSON.parse(result.value || '{}'), schema);
});
test('canonicalizes menu badge aliases while retaining the complete ViewSchema', () => {
    const viewSchema = {
        Views: [{ Scene: 'List', Layout: { List: { Columns: [{ Field: 'Name', Lines: ['Name', 'Code'] }] } } }],
    };
    const result = normalizeAllMenuJson({
        menuBadgeEnabled: 1,
        menuBadgeApiEngineKey: 'inventory_low_stock_count',
        enableViewSchema: 1,
        viewSchema,
    });
    assert.deepEqual(result.errors, []);
    assert.equal(result.data.MenuBadgeEnabled, 1);
    assert.equal(result.data.MenuBadgeApiEngineKey, 'inventory_low_stock_count');
    assert.equal(result.data.EnableViewSchema, 1);
    assert.deepEqual(JSON.parse(String(result.data.ViewSchema)), viewSchema);
    assert.equal(result.data.menuBadgeEnabled, undefined);
    assert.equal(result.data.menuBadgeApiEngineKey, undefined);
});
test('retains ApiEngine statistic badge configuration on PageTabs', () => {
    const result = normalizeAllMenuJson({
        PageTabs: [{
                Id: 'pending-tab',
                Name: '待处理',
                V8Code: "V8.SearchSet({ Status: 'Pending' });",
                BadgeEnabled: true,
                BadgeApiEngineKey: 'order_tab_counts',
                BadgeValuePath: 'Data.Buttons.pending-tab',
                BadgeTone: 'danger',
                BadgeColor: '#d92d20',
                BadgeMax: 999,
                BadgeShowZero: false,
                BadgeRefreshSeconds: 60,
            }],
    });
    assert.deepEqual(result.errors, []);
    const [tab] = JSON.parse(String(result.data.PageTabs));
    assert.equal(tab.BadgeEnabled, true);
    assert.equal(tab.BadgeApiEngineKey, 'order_tab_counts');
    assert.equal(tab.BadgeValuePath, 'Data.Buttons.pending-tab');
    assert.equal(tab.BadgeColor, '#d92d20');
    assert.equal(tab.BadgeRefreshSeconds, 60);
});
//# sourceMappingURL=view-schema.test.js.map