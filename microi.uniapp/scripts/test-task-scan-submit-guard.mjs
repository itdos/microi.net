import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { taskScanSubmitAccess } from '../src/tenants/xjy/task-scan-permission.mjs'

const scanPageSource = fs.readFileSync(new URL('../src/pages/task/scan.vue', import.meta.url), 'utf8')
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

test('提交接口和统一完成接口都在服务端失败关闭', () => {
  assert.match(scanSubmitSource, /String\(task\.ShouhouRYID \|\| ''\) != String\(V8\.CurrentUser\.Id \|\| ''\)/)
  assert.match(scanSubmitSource, /V8\.ApiEngine\.Run\('shouhoudd_finish', \{ Id: taskId \}, V8\.DbTrans\)/)
  assert.doesNotMatch(scanSubmitSource, /\.forEach\(/)
  assert.match(finishTaskSource, /FuwuZT IS NULL OR FuwuZT <> @completedState/)
  assert.ok(finishTaskSource.indexOf('pendingTaskDevice') < finishTaskSource.indexOf("Zhuangtai : '待商家验收'"))
})
