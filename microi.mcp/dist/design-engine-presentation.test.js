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
//# sourceMappingURL=design-engine-presentation.test.js.map