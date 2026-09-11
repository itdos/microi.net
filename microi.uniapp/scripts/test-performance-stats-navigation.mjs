import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { readListEntryPeriod } from '../src/platform/list-entry-period.mjs'
import {
  buildPerformanceMetricRoute,
  buildPerformanceModuleOptions,
  buildPerformanceTaskOptions,
  PERSONAL_FILTER_BY_MODULE
} from '../src/tenants/xjy/performance-stats.mjs'

const statsSource = fs.readFileSync(new URL('../src/pages/business/stats.vue', import.meta.url), 'utf8')
const businessRuntimeSource = fs.readFileSync(new URL('../src/platform/business-runtime.js', import.meta.url), 'utf8')
const businessListSource = fs.readFileSync(new URL('../src/pages/business/list.vue', import.meta.url), 'utf8')
const taskListSource = fs.readFileSync(new URL('../src/pages/task/list.vue', import.meta.url), 'utf8')
const user = { Id: 'user-42', Name: '张三', Account: 'zhangsan' }

test('统计只按约定的负责人或跟进人字段过滤', () => {
  assert.deepEqual(PERSONAL_FILTER_BY_MODULE, {
    customers: { field: 'FuzeRID', userField: 'Id', operation: '=' },
    visits: { field: 'BaifangR', userField: 'Name', operation: 'Like' },
    opportunities: { field: 'FuzeRID', userField: 'Id', operation: '=' }
  })
  assert.deepEqual(buildPerformanceModuleOptions('customers', user).extraWhere, [
    { Name: 'FuzeRID', Type: '=', Value: 'user-42' }
  ])
  assert.deepEqual(buildPerformanceModuleOptions('opportunities', user).extraWhere, [
    { Name: 'FuzeRID', Type: '=', Value: 'user-42' }
  ])
  assert.deepEqual(buildPerformanceModuleOptions('visits', user).extraWhere, [
    { Name: 'BaifangR', Type: 'Like', Value: '张三' }
  ])
  assert.equal(buildPerformanceModuleOptions('orders', user).extraWhere, undefined)
  assert.equal(buildPerformanceModuleOptions('devices', user).extraWhere, undefined)
  assert.equal(buildPerformanceTaskOptions(user).mineOnly, false)
  assert.equal(buildPerformanceTaskOptions(user).dateField, 'YujiSHSJ')
  assert.throws(() => buildPerformanceModuleOptions('customers', {}), /当前账号信息不完整/)
  assert.throws(() => buildPerformanceModuleOptions('visits', {}), /当前账号姓名信息不完整/)
})

test('六个卡片跳转携带时间口径和来源标记，并仅附加约定的个人口径', () => {
  ;['customers', 'orders', 'visits', 'opportunities', 'devices'].forEach((key) => {
    const route = buildPerformanceMetricRoute(key, user, { period: 'month' })
    assert.match(route, new RegExp(`key=${key}`))
    assert.match(route, /from=performance-stats/)
    assert.match(route, /period=month/)
  })

  assert.match(buildPerformanceMetricRoute('customers', user), /whereField=FuzeRID/)
  assert.match(buildPerformanceMetricRoute('customers', user), /whereValue=user-42/)
  assert.match(buildPerformanceMetricRoute('opportunities', user), /whereField=FuzeRID/)
  assert.match(buildPerformanceMetricRoute('visits', user), /whereField=BaifangR/)
  assert.match(buildPerformanceMetricRoute('visits', user), /whereType=Like/)
  assert.match(buildPerformanceMetricRoute('visits', user), /whereValue=%E5%BC%A0%E4%B8%89/)
  assert.doesNotMatch(buildPerformanceMetricRoute('orders', user), /where(Field|Value)=/)
  assert.doesNotMatch(buildPerformanceMetricRoute('devices', user), /where(Field|Value)=/)

  const taskRoute = buildPerformanceMetricRoute('tasks', user, { period: 'month' }, 'pending')
  assert.match(taskRoute, /scope=all/)
  assert.match(taskRoute, /dateField=YujiSHSJ/)
  assert.match(taskRoute, /state=pending/)
  assert.match(taskRoute, /from=performance-stats/)
})

test('跳转支持本日、本周、本月和自定义时间条件', () => {
  ;['today', 'week', 'month'].forEach((period) => {
    assert.match(buildPerformanceMetricRoute('orders', user, { period }), new RegExp(`period=${period}`))
  })
  const customRoute = buildPerformanceMetricRoute('visits', user, {
    period: 'custom',
    customStart: '2026-09-01',
    customEnd: '2026-09-11'
  })
  assert.match(customRoute, /period=custom/)
  assert.match(customRoute, /customStart=2026-09-01/)
  assert.match(customRoute, /customEnd=2026-09-11/)
})

test('统计小页查询仅减少明细传输，总数始终读取服务端 DataCount', () => {
  assert.match(statsSource, /pageIndex:1,pageSize:1/)
  assert.match(businessRuntimeSource, /count:\s*Number\(response\.DataCount \|\| 0\)/)
})

test('列表识别统计入口筛选并阻止旧页面快照覆盖', () => {
  assert.deepEqual(readListEntryPeriod({
    from: 'performance-stats', period: 'custom', customStart: '2026-08-01', customEnd: '2026-08-31'
  }, 'all'), {
    period: 'custom', customStart: '2026-08-01', customEnd: '2026-08-31', forceFresh: true
  })
  assert.equal(readListEntryPeriod({ period: 'invalid' }, 'month').period, 'month')
  assert.match(businessListSource, /entryPeriod\.forceFresh \? false : this\.restoreMciListSnapshot\(\)/)
  assert.match(businessListSource, /Type: this\.whereType, Value: this\.whereValue/)
  assert.match(businessListSource, /if \(this\.entrySnapshotScope\) parts\.push\(this\.entrySnapshotScope\)/)
  assert.match(taskListSource, /\(this\.focusTaskId \|\| entryPeriod\.forceFresh\) \? null : this\.restoreTaskListSession\(\)/)
  assert.match(taskListSource, /if \(entryPeriod\.forceFresh\)/)
  assert.match(taskListSource, /taskListSessionParts\.push\(`performance:\$\{this\.period\}:\$\{this\.customStart \|\| '-'\}:\$\{this\.customEnd \|\| '-'\}`\)/)
})

test('统计页标题、卡片点击与统计查询已接入', () => {
  assert.match(statsSource, /title="业绩统计"/)
  assert.match(statsSource, /`\$\{periodLabel\}业绩概览`/)
  assert.match(statsSource, /@tap="openMetric\(item\)"/)
  assert.match(statsSource, /buildPerformanceModuleOptions/)
  assert.match(statsSource, /buildPerformanceTaskOptions/)
})
