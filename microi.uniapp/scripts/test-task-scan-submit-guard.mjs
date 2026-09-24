import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { taskScanSubmitAccess } from '../src/tenants/xjy/task-scan-permission.mjs'

const scanPageSource = fs.readFileSync(new URL('../src/pages/task/scan.vue', import.meta.url), 'utf8')

test('process device action keeps the maintenance icon in enabled and disabled states', () => {
  assert.match(scanPageSource, /class="process-icon" src="\/static\/xjy\/business\/sh\.png"/)
  assert.match(scanPageSource, /\.process-action\.is-disabled \.process-icon\{filter:grayscale\(1\);opacity:\.45\}/)
  assert.doesNotMatch(scanPageSource, /<view v-else class="lock-icon"/)
})

const scanQuerySource = fs.readFileSync(new URL('../../Microi-V8-Engine/集福鲤平台 (api.jifulii.com)/xjy.Product.Internal/接口引擎/未分类/根据设备Id（扫码）获取最近任务列表(getrenwu-by-shebeiid).js', import.meta.url), 'utf8')
const scanSubmitSource = fs.readFileSync(new URL('../../Microi-V8-Engine/集福鲤平台 (api.jifulii.com)/xjy.Product.Internal/接口引擎/未分类/扫码做任务的提交任务按钮(scan-code-tasks).js', import.meta.url), 'utf8')
const finishTaskSource = fs.readFileSync(new URL('../../Microi-V8-Engine/集福鲤平台 (api.jifulii.com)/xjy.Product.Internal/接口引擎/未分类/售后服务订单服务完成(shouhoudd_finish).js', import.meta.url), 'utf8')

test('本次修改的三个 V8 接口源码语法有效', () => {
  for (const source of [scanQuerySource, scanSubmitSource, finishTaskSource]) {
    assert.doesNotThrow(() => new Function('V8', 'DateNow', source))
  }
})

const owner = { Id: 'service-user-1' }
const completedTask = {
  Zhuangtai: '待服务',
  ShouhouRYID: owner.Id,
  FuwuZT: '已完成',
  TaskDeviceCount: 2,
  TaskCompletedDeviceCount: 2
}

test('扫码提交按钮仅在当前服务人员完成整单设备后显示', () => {
  assert.equal(taskScanSubmitAccess(completedTask, owner).allowed, true)
  assert.equal(taskScanSubmitAccess({ ...completedTask, FuwuZT: '待服务' }, owner).allowed, false)
  assert.equal(taskScanSubmitAccess({ ...completedTask, TaskCompletedDeviceCount: 1 }, owner).allowed, false)
  assert.equal(taskScanSubmitAccess({ ...completedTask, TaskDeviceCount: undefined }, owner).allowed, false)
  assert.equal(taskScanSubmitAccess(completedTask, { Id: 'other-user' }).allowed, false)
  assert.match(scanPageSource, /v-if="canSubmitTask\(item\)"/)
  assert.match(scanPageSource, /onShow\(\)\{[\s\S]*this\.loadTasks\(\)/)
})

test('扫码查询返回当前设备状态和整单设备完成进度', () => {
  assert.match(scanQuerySource, /A\.FuwuZT/)
  assert.match(scanQuerySource, /TaskDeviceCount/)
  assert.match(scanQuerySource, /TaskCompletedDeviceCount/)
  assert.match(scanQuerySource, /GROUP BY ShouhouDDID/)
})

test('扫码查询分页加载设备全部未完成任务，不再按本月或 15 条截断', () => {
  assert.match(scanQuerySource, /Version: v1\.0\.6/)
  assert.match(scanQuerySource, /ZhuangtaiZ IS NULL OR B\.ZhuangtaiZ NOT IN/)
  assert.match(scanQuerySource, /B\.Zhuangtai IS NULL OR B\.Zhuangtai NOT IN/)
  assert.match(scanQuerySource, /LIMIT @offset, @pageSize/)
  assert.match(scanQuerySource, /if \(hasPaging\) sqlParts\.push\('LIMIT @offset, @pageSize'\)/)
  assert.match(scanQuerySource, /已发布旧客户端不传分页参数/)
  assert.match(scanQuerySource, /TotalCount: totalCount/)
  assert.doesNotMatch(scanQuerySource, /monthStart|DateNow\('yyyy-MM'\)|LIMIT 0, 15/)
  assert.match(scanPageSource, /PageIndex:pageIndex,PageSize:pageSize/)
  assert.match(scanPageSource, /while\(true\)/)
  assert.match(scanPageSource, /查询该设备的全部未完成任务/)
  assert.doesNotMatch(scanPageSource, /本月以来最近 15 个任务|近期没有售后任务/)
})

test('提交接口和统一完成接口都在服务端失败关闭', () => {
  assert.match(scanSubmitSource, /String\(task\.ShouhouRYID \|\| ''\) != String\(V8\.CurrentUser\.Id \|\| ''\)/)
  assert.match(scanSubmitSource, /V8\.ApiEngine\.Run\('shouhoudd_finish', \{ Id: taskId \}, V8\.DbTrans\)/)
  assert.doesNotMatch(scanSubmitSource, /\.forEach\(/)
  assert.match(finishTaskSource, /FuwuZT IS NULL OR FuwuZT <> @completedState/)
  assert.ok(finishTaskSource.indexOf('pendingTaskDevice') < finishTaskSource.indexOf('var updateModel = {'))
  assert.match(finishTaskSource, /Zhuangtai : typePolicy\.needMerchantAcceptance \? '待客服验收'/)
})
