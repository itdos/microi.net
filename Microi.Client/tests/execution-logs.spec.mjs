import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { ref, computed } from 'vue';

// 直接执行组件脚本，验证隐藏页签、跨任务竞争和游标请求的行为；真实 DOM 在 Full 浏览器中验收。
const source = fs.readFileSync(new URL('../src/views/job-engine/ExecutionLogs.vue', import.meta.url), 'utf8');
const script = source.match(/<script setup>([\s\S]*?)<\/script>/)[1]
  .replace(/import .*? from 'vue';/, '');
function create(post) {
  const calls = [];
  let mounted, intersection;
  const props = { field: { Config: {} }, FormDiyTableModel: { JobName: 'job-a' }, ParentV8: {
    Http: { Post: async request => { calls.push(request); return post(request, calls.length); } }
  } };
  const context = vm.createContext({
    defineProps: () => props, ref, computed, watch: () => {}, onBeforeUnmount: () => {},
    onMounted: callback => { mounted = callback; },
    IntersectionObserver: class { constructor(callback) { intersection = callback; } observe() {} disconnect() {} }
  });
  vm.runInContext(script + '\nglobalThis.state={rows,loading,error,cursors,nextCursor,load,reset,next,previous,month};', context);
  mounted();
  return { ...context.state, props, calls, show: visible => intersection([{ isIntersecting: visible }]) };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const result = (data = [], append = {}) => JSON.stringify({ Code: 1, Data: data, DataAppend: append });

test('隐藏日志页签不查询，显示后按任务月份读取且不发送总数/偏移/租户', async () => {
  const state = create(() => result([{ Id: 'a' }]));
  await tick(); assert.equal(state.calls.length, 0);
  state.show(true); await tick();
  assert.equal(state.calls.length, 1);
  assert.equal(state.calls[0].PostParam.Action, 'logs');
  assert.equal(state.calls[0].PostParam.JobName, 'job-a');
  assert.match(state.calls[0].PostParam.SearchMonth, /^\d{6}$/);
  for (const key of ['OsClient', '_PageIndex', 'Skip', 'Count']) assert.equal(state.calls[0].PostParam[key], undefined);
});

test('下一页使用稳定游标，上一页回到原游标；历史表使用独立动作', async () => {
  const state = create((_, count) => result([{ Id: String(count) }], count === 1 ? {
    HasMore: true, BeforeLogTime: '2026-09-15T01:00:00Z', BeforeLogId: 'event-20'
  } : {}));
  state.props.field.Config.ScheduleLogSource = 'History';
  state.show(true); await tick(); state.next(); await tick();
  assert.equal(state.calls[1].PostParam.Action, 'historylogs');
  assert.equal(state.calls[1].PostParam.BeforeLogId, 'event-20');
  assert.equal(state.cursors.value.length, 1);
  state.previous(); await tick();
  assert.equal(state.calls[2].PostParam.BeforeLogId, undefined);
});

test('隐藏时重置不会被旧请求的 loading 锁住，旧响应不得覆盖新任务', async () => {
  let finishOld;
  const state = create((_, count) => count === 1 ? new Promise(resolve => { finishOld = resolve; }) : result([{ Id: 'new' }]));
  state.show(true); await tick(); assert.equal(state.loading.value, true);
  state.show(false); state.reset(); assert.equal(state.loading.value, false);
  state.show(true); await tick(); assert.equal(state.calls.length, 2);
  finishOld(result([{ Id: 'old' }])); await tick();
  assert.equal(state.rows.value[0].Id, 'new');
});

test('服务端故障和非法响应明确报错，不显示成功空表状态', async () => {
  const state = create(() => JSON.stringify({ Code: 0, Msg: 'Mongo unavailable' }));
  state.show(true); await tick();
  assert.equal(state.error.value, 'Mongo unavailable');
  assert.equal(state.nextCursor.value, null);
  assert.match(source, /error \? '日志读取失败'/);
  const invalid = create(() => '<html>Gateway Timeout</html>');
  invalid.show(true); await tick(); assert.match(invalid.error.value, /未返回有效结果/);
  const malformed = create(() => JSON.stringify({ Code: 1, Data: {} }));
  malformed.show(true); await tick(); assert.match(malformed.error.value, /数据格式不正确/);
  const cursorMissing = create(() => result([], { HasMore: true }));
  cursorMissing.show(true); await tick(); assert.match(cursorMissing.error.value, /完整翻页信息/);
});
