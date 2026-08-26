import assert from 'node:assert/strict'
import { hasTaskFlowCapability, normalizeTaskFlowCapabilities } from '../src/tenants/xjy/task-flow-capability.mjs'

const tests = [
  ['只保留服务端声明的受支持动作', () => {
    const actions = normalizeTaskFlowCapabilities({ Code: 1, Data: { Actions: ['merchantPass', 'unsupported', 'merchantPass'] } })
    assert.deepEqual(actions, ['merchantPass'])
  }],
  ['接口失败时前端关闭全部后流程按钮', () => {
    assert.deepEqual(normalizeTaskFlowCapabilities({ Code: 0, Msg: '无权限' }), [])
    assert.deepEqual(normalizeTaskFlowCapabilities(null), [])
  }],
  ['空能力不授权', () => {
    assert.equal(hasTaskFlowCapability([], 'evaluate'), false)
  }],
  ['精确动作才授权', () => {
    assert.equal(hasTaskFlowCapability(['customerPass'], 'customerPass'), true)
    assert.equal(hasTaskFlowCapability(['customerPass'], 'customerReject'), false)
  }]
]

let passed = 0
for (const [name, test] of tests) {
  test()
  passed += 1
  console.log(`PASS ${name}`)
}
console.log(`task flow capability tests: ${passed}/${tests.length}`)
