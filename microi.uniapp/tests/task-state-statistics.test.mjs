import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import test from 'node:test'
import workspacePaths from '../scripts/lib/workspace-paths.js'

const source = fs.readFileSync(workspacePaths.findSyncedXjyEngine(fileURLToPath(new URL('..', import.meta.url)), 'service_statusStatistics'), 'utf8')
const canonicalSource = fs.readFileSync(new URL('../src/tenants/xjy/api-engines/service_statusStatistics.js', import.meta.url), 'utf8')

test('应用内持久源码与当前租户同步的接口正文一致', () => {
  assert.equal(canonicalSource.trimEnd(), source.trimEnd())
})

function execute(groups, options = {}) {
  const queries = []
  const V8 = {
    Param: options.hostParam || { taskScope: 'all', ...options.params },
    CurrentUser: { Id: 'admin', Level: 9999 },
    Db: { FromSql(sql) {
      queries.push(sql)
      return { AddInParameter() { return this }, ToArray() {
        // 真实故障为额外的 Leixing 条件把分组清空；不能始终返回正常结果掩盖错误条件。
        return options.rejectTypeFilter && sql.includes('Leixing =') ? [] : groups
      } }
    } },
    ModuleEngine: { GetTableData() { throw new Error('unexpected module fallback') } }
  }
  vm.runInNewContext(source, { V8, console })
  return { result: V8.Result, queries }
}

test('状态聚合兼容数据库返回的大小写别名，已结束安装任务计为一条', () => {
  for (const row of [
    { GroupValue: '已结束', GroupCount: 1 },
    { groupValue: '已结束', groupCount: '1' },
    { groupvalue: '已结束', groupcount: '1' }
  ]) {
    const { result } = execute([row])
    assert.equal(result.Code, 1)
    assert.equal(result.Data.FinishCount, 1)
  }
})

test('缺省类型不能读取参数宿主的 Type 属性而把本月五个任务筛成零条', () => {
  const hostParam = Object.assign(Object.create({ type: 'Object' }), { taskScope: 'all', keyword: '客户', YujiSHSJ: ['2026-10-01', '2026-10-31'] })
  const { result, queries } = execute([
    { GroupValue: '待接单', GroupCount: 4 },
    { GroupValue: '已结束', GroupCount: 1 }
  ], { hostParam, rejectTypeFilter: true })
  assert.equal(result.Data.pending, 4)
  assert.equal(result.Data.FinishCount, 1)
  assert.doesNotMatch(queries[0], /Leixing =/)
  assert.match(queries[0], /YujiSHSJ >= @p/)
})

test('显式空类型不筛选，选择安装仍保留参数化类型过滤', () => {
  assert.doesNotMatch(execute([], { params: { type: '' } }).queries[0], /Leixing =/)
  assert.match(execute([], { params: { type: '安装' } }).queries[0], /Leixing = @p\d+/)
})

test('空结果保留真实零值，多组相同状态累加且不混入其它状态', () => {
  assert.equal(execute([]).result.Data.FinishCount, 0)
  const { result } = execute([
    { GroupValue: '已结束', GroupCount: 1 },
    { GroupValue: '已结束', GroupCount: 2 },
    { GroupValue: '待接单', GroupCount: 4 }
  ])
  assert.equal(result.Data.FinishCount, 3)
  assert.equal(result.Data.pending, 4)
  assert.equal(result.Data.cancel, 0)
})
