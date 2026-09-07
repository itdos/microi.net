import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveWidgetMenuId } from './widget-menu-context.js';

test('跨租户模板 Id 优先解析为当前账号可用的同表模块，保留隐藏模块上下文', () => {
    const routes = [{children:[{Id:'local-work',Display:0,name:'menu_work',meta:{Id:'local-work',DiyTableName:'WF_Work'}}]}];
    assert.equal(resolveWidgetMenuId(routes,'source-work','wf_work'),'local-work');
    assert.equal(resolveWidgetMenuId(routes,'LOCAL-WORK','wf_work'),'local-work');
});

test('显式可用模块优先，缺少日程模块不猜测外部租户 Id 或合成网格入口', () => {
    const routes = [
        {Id:'first',name:'menu_first',meta:{Id:'first',DiyTableName:'wf_work'}},
        {Id:'chosen',name:'menu_chosen',meta:{Id:'chosen',DiyTableName:'wf_work'}},
        {Id:'grid_missing',name:'menu_grid_missing',meta:{Id:'missing',DiyTableName:'microi_calendar'}}
    ];
    assert.equal(resolveWidgetMenuId(routes,'chosen','wf_work'),'chosen');
    assert.equal(resolveWidgetMenuId(routes,'foreign-calendar','microi_calendar'),'');
    assert.equal(resolveWidgetMenuId([], 'foreign-work','wf_work'),'');
});
