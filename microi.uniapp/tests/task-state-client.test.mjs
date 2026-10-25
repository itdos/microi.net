import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { buildTaskScopeWhere, normalizeTaskScope } from '../src/tenants/xjy/task-responsibility.mjs'

const source = fs.readFileSync(new URL('../src/utils/xjy-task.js', import.meta.url), 'utf8')
const range = ['2026-10-01 00:00:00', '2026-10-31 23:59:59']

function client(fail = false) {
  const calls = []
  let active = 0, maximum = 0
  const sandbox = {
    PERIOD_OPTIONS: [], buildTaskScopeWhere, normalizeTaskScope,
    getUser: () => ({ Id: 'ordinary-user', Level: 1 }),
    findMenu: async () => ({ Id: 'task-menu' }),
    buildPeriodRange: () => range,
    cachedRequest: async (_key, request) => ({ data: await request() }),
    callApiEngine: () => { throw new Error('状态计数不应访问旧统计或卡片明细接口') },
    post: async (url, query) => {
      calls.push({ url, query }); maximum = Math.max(maximum, ++active)
      await new Promise(resolve => setTimeout(resolve, 1))
      active--
      if (fail) return { Code: 0, Msg: '无权访问' }
      const state = query._Where.find(item => item.Name === 'Zhuangtai')?.Value
      return { Code: 1, Data: [], DataCount: state === '已结束' ? 1 : state === '待接单' ? 4 : 0 }
    }
  }
  vm.runInNewContext(source.replace(/^import[\s\S]*?from ['"][^'"]+['"]\s*\r?\n/gm, '')
    .replace(/export default[\s\S]*$/, '').replace(/\bexport /g, ''), sandbox)
  return { sandbox, calls, maximum: () => maximum }
}

test('普通账号的已结束卡片与顶部状态统计共用真实列表查询，五条任务按4和1计数', async () => {
  const { sandbox, calls, maximum } = client()
  const counts = await sandbox.loadTaskStateCounts({ keyword: '全功能测试', period: 'month', scope: 'all' })
  assert.equal(counts.FinishCount, 1)
  assert.equal(counts.pending, 4)
  assert.equal(counts.TodoCount, 0)
  assert.equal(calls.length, 8)
  assert.ok(maximum() <= 3)
  for (const { url, query } of calls) {
    assert.equal(url, '/apiengine/platform-module-data')
    assert.equal(query._SysMenuId, 'task-menu')
    assert.equal(query._Keyword, '全功能测试')
    assert.equal(query._PageSize, 1)
    assert.deepEqual(Array.from(query._SelectFields), ['Id'])
    assert.ok(query._Where.some(item => item.Name === 'YujiSHSJ' && item.Value === range[0]))
  }
})

test('状态统计保留类型、客户、扩展筛选和当前责任范围，不叠加当前选中状态', async () => {
  const { sandbox, calls } = client()
  await sandbox.loadTaskStateCounts({ state: '待接单', type: '安装', customerId: 'customer', scope: 'participated',
    extraWhere: [{ Name: 'TenantId', Type: '=', Value: 'authorized-tenant' }] })
  const finished = calls.find(({ query }) => query._Where.some(item => item.Name === 'Zhuangtai' && item.Value === '已结束')).query
  assert.equal(finished._Where.filter(item => item.Name === 'Zhuangtai').length, 1)
  for (const name of ['Leixing', 'KehuID', 'TenantId', 'ShouhouRYID', 'HouxuFZRID']) {
    assert.ok(finished._Where.some(item => item.Name === name), name)
  }
})

test('权限或查询失败时显示统计未知，不把失败伪装成八个零', async () => {
  const { sandbox } = client(true)
  assert.deepEqual(Object.keys(await sandbox.loadTaskStateCounts({ scope: 'all' })), [])
})
