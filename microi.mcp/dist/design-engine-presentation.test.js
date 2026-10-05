import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPageDesign } from './design-engine.js';
test('AI dashboards follow host theme and avoid legacy fixed-height statistic gaps', () => {
    const page = buildPageDesign({ prompt: '销售进度看板' });
    assert.equal(page.formConfig.themeMode, 'system');
    assert.equal(page.formConfig.density, 'compact');
    assert.equal(page.formConfig.shadow, false);
    assert.ok(page.wrapperList.every((x) => x.wrapperOption.heightMode === 'content'));
    assert.ok(page.wrapperList.every((x) => x.wrapperOption.pannelColor === 'var(--el-bg-color)'));
    const statistic = page.wrapperList.flatMap((x) => x.widgetList).find((x) => x.type === 'statistic');
    assert.equal(statistic.widgetParams[24].value, 'summary');
    assert.ok(statistic.widgetOption.height < 100);
    assert.ok(statistic.widgetParams[0].typeOptions.dataJson.data.length > 0);
});
test('theme is explicit only when requested, not inferred from dashboard vocabulary', () => {
    for (const prompt of ['运营驾驶舱', '设备大屏'])
        assert.equal(buildPageDesign({ prompt }).formConfig.themeMode, 'system');
    assert.equal(buildPageDesign({ prompt: '深色销售报表' }).formConfig.themeMode, 'dark');
    assert.equal(buildPageDesign({ prompt: '浅色销售报表' }).formConfig.themeMode, 'light');
});
test('platform home uses native authorized widgets and a compact task page without sample business data', () => {
    const page = buildPageDesign({ prompt: '设计平台首页，保留 AI 创作中心' });
    assert.deepEqual(page.wrapperList.map((w) => w.wrapperOption.span), [14, 10, 16, 8]);
    const widgets = page.wrapperList.flatMap((w) => w.widgetList);
    assert.deepEqual(widgets.map((w) => w.type), ['aiengine', 'homeoverview', 'workcenter', 'diycalendar']);
    assert.equal(widgets[1].widgetParams[0].value, 'platform-home-overview');
    assert.equal(widgets[1].widgetParams[1].value, 'compact');
    assert.equal(widgets[2].widgetParams[5].value, 5);
    assert.ok(widgets[2].widgetParams.slice(1, 5).every((p) => p.value === ''));
    assert.ok(page.wrapperList.every((w) => w.wrapperOption.heightMode === 'content'));
    assert.equal(buildPageDesign({ prompt: '深色智能工作台' }).formConfig.themeMode, 'dark');
});
//# sourceMappingURL=design-engine-presentation.test.js.map