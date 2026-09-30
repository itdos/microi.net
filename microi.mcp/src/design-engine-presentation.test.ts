import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPageDesign } from './design-engine.js';

test('AI dashboards follow host theme and avoid legacy fixed-height statistic gaps', () => {
  const page = buildPageDesign({prompt:'销售进度看板'}) as any;
  assert.equal(page.formConfig.themeMode,'system');
  assert.equal(page.formConfig.density,'compact');
  assert.equal(page.formConfig.shadow,false);
  assert.ok(page.wrapperList.every((x:any)=>x.wrapperOption.heightMode==='content'));
  assert.ok(page.wrapperList.every((x:any)=>x.wrapperOption.pannelColor==='var(--el-bg-color)'));
  const statistic = page.wrapperList.flatMap((x:any)=>x.widgetList).find((x:any)=>x.type==='statistic');
  assert.equal(statistic.widgetParams[24].value,'summary');
  assert.ok(statistic.widgetOption.height < 100);
  assert.ok(statistic.widgetParams[0].typeOptions.dataJson.data.length > 0);
});

test('theme is explicit only when requested, not inferred from dashboard vocabulary', () => {
  for (const prompt of ['运营驾驶舱','设备大屏']) assert.equal((buildPageDesign({prompt}) as any).formConfig.themeMode,'system');
  assert.equal((buildPageDesign({prompt:'深色销售报表'}) as any).formConfig.themeMode,'dark');
  assert.equal((buildPageDesign({prompt:'浅色销售报表'}) as any).formConfig.themeMode,'light');
});

test('platform home uses native authorized widgets and a compact task page without sample business data', () => {
  const page = buildPageDesign({prompt:'设计平台首页，保留 AI 创作中心'}) as any;
  assert.deepEqual(page.wrapperList.map((w:any)=>w.wrapperOption.span),[14,10,16,8]);
  const widgets = page.wrapperList.flatMap((w:any)=>w.widgetList);
  assert.deepEqual(widgets.map((w:any)=>w.type),['aiengine','homeoverview','workcenter','diycalendar']);
  assert.equal(widgets[1].widgetParams[0].value,'platform-home-overview');
  assert.equal(widgets[1].widgetParams[1].value,'compact');
  assert.equal(widgets[2].widgetParams[5].value,5);
  assert.ok(widgets[2].widgetParams.slice(1,5).every((p:any)=>p.value===''));
  assert.ok(page.wrapperList.every((w:any)=>w.wrapperOption.heightMode==='content'));
  assert.equal((buildPageDesign({prompt:'深色智能工作台'}) as any).formConfig.themeMode,'dark');
});
