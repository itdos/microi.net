import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import test from 'node:test'
import workspacePaths from './lib/workspace-paths.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const syncRoot = path.join(workspacePaths.findWorkspaceRoot(root), 'Microi-V8-Engine', '集福鲤平台 (api.jifulii.com)', 'xjy.Product.Internal')
const matches = fs.readdirSync(syncRoot, { recursive: true }).filter(name => name.includes('diy_shebeiwz') && name.includes('SubmitBeforeServerV8') && name.endsWith('.js'))
assert.equal(matches.length, 1, '安装点位提交前事件必须具有唯一同步事实源')
const source = fs.readFileSync(path.join(syncRoot, matches[0]), 'utf8')
const oldPosition = {
  Id: 'position-1', DingdanSPID: 'product-1', ShangpinBH: 'device-001',
  AnzhuangWZ: '原安装位置', AnzhuangWZ_Lat: '29.8', AnzhuangWZ_Lng: '121.6',
  IoTDeviceId: null, IoTDeviceNames: '', IsDeleted: 0,
  CreateTime: '2026-10-01 08:00:00', UserId: 'creator-1', UserName: '原创建人'
}

function execute({ form = {}, owner = true, sameTenant = true, sameDevice = true, sameCustomer = true,
  activeUser = true, pending = true, deviceCompleted = false, currentUserId = 'engineer-1',
  action = 'Update', editor = false, old = {}, movedPosition = null, failRead = false } = {}) {
  const original = { ...oldPosition, ...old }
  const submitted = { ...original, AnzhuangWZ: '现场新位置', AnzhuangWZ_Lat: 30, AnzhuangWZ_Lng: 120, ...form }
  const calls = { contract: 0, service: 0, lockedPosition: 0 }
  const V8 = {
    Form: submitted, OldForm: original, FormSubmitAction: action, Param: {},
    CurrentUser: { Id: currentUserId, TenantId: 'untrusted-client-tenant', RoleName: '管理员' },
    DbTrans: {
      FromSql(sql) {
        const parameters = {}
        return {
          AddInParameter(name, value) { parameters[name] = value; return this },
          First() {
            if (sql.includes('FROM diy_shebeiwz')) {
              if (/FOR UPDATE/i.test(sql)) { calls.lockedPosition++; return movedPosition || original }
              return original
            }
            if (sql.includes('FROM Diy_DingdanSP')) return { Id: 'product-1', DingdanID: 'order-1' }
            if (sql.includes('FROM diy_shouhousp')) {
              calls.service++
              // SQL 必须在同一主库事务中校验真实账号、当前责任人、阶段和设备/客户/商家归属。
              for (const fragment of ['sys_user', 'ShouhouRYID', 'ZhuangtaiZ', 'TenantId', 'KehuID', 'DingdanSPID', 'KehuSBID', 'ShebeiBH', 'FOR UPDATE']) assert.ok(sql.includes(fragment), fragment)
              assert.equal(parameters['@userId'], currentUserId)
              assert.equal(parameters['@productId'], 'product-1')
              assert.equal(parameters['@deviceNumber'], 'device-001')
              if (failRead) throw new Error('database-unavailable')
              return currentUserId && owner && sameTenant && sameDevice && sameCustomer && activeUser && pending && !deviceCompleted
                ? { Id: 'task-device-1', TaskId: 'task-1' } : null
            }
            throw new Error('Unexpected SQL: ' + sql)
          }
        }
      }
    },
    ApiEngine: {
      Run(key) {
        assert.equal(key, 'xjy-order-draft-context')
        calls.contract++
        return editor ? { Code: 1, Data: { DingdanID: 'order-1', DingdanZTZ: 2, TenantId: 'tenant-1' } }
          : { Code: 0, Msg: '没有合同订单编辑权限' }
      }
    }
  }
  const result = vm.runInNewContext(`(function () { ${source}\nreturn { Code: 1 }; })()`, { V8, DateNow: () => '2026-10-19 18:00:00' })
  return { result, calls, submitted }
}

test('负责工程师可同步本人待服务任务的设备位置，无需合同编辑权', () => {
  const { result, calls, submitted } = execute()
  assert.equal(result.Code, 1)
  assert.equal(calls.contract, 0)
  assert.equal(calls.service, 1)
  assert.equal(calls.lockedPosition, 1)
  assert.equal(submitted.AnzhuangWZ, '现场新位置')
})

test('兼容旧版 Upt 更新动作，后端默认回归使用真实的 Update', () => {
  const { result, calls } = execute({ action: 'Upt' })
  assert.equal(result.Code, 1)
  assert.equal(calls.contract, 0)
})

test('完整表单快照的未变字段及日期格式兼容，保持现有 IoT 绑定', () => {
  const { result, submitted } = execute({ old: { CreateTime: new Date('2026-10-01T08:00:00'), IoTDeviceId: '01M4EXISTINGIOTDEVICE0001', IoTDeviceNames: '原绑定' },
    form: { CreateTime: '2026-10-01 08:00:00', IoTDeviceId: undefined, IoTDeviceNames: undefined } })
  assert.equal(result.Code, 1)
  assert.equal(submitted.IoTDeviceId, '01M4EXISTINGIOTDEVICE0001')
  assert.equal(submitted.IoTDeviceNames, '原绑定')
})

for (const denied of [
  { owner: false }, { sameTenant: false }, { sameDevice: false }, { sameCustomer: false },
  { activeUser: false }, { pending: false }, { deviceCompleted: true }, { currentUserId: '' }
]) test(`伪造前端管理员或归属参数不能代替真实任务授权：${JSON.stringify(denied)}`, () => {
  const { result } = execute(denied)
  assert.equal(result.Code, 0)
})

for (const form of [
  { ShangpinBH: 'another-device' }, { IoTDeviceId: '01M4FORGEDIOTDEVICE00001' }, { IsDeleted: 1 },
  { ReuseKehuSBID: 'other-device' }, { DeviceUseType: 'Reuse' }, { SourcePositionID: 'other-position' },
  { UserId: 'engineer-1' }, { UserId: ' creator-1 ' }, { ReuseKehuSBID: ' ' },
  { Renshu: 999 }, { UnknownField: 'forged' }
]) test(`售后同步不能修改位置以外的数据：${Object.keys(form)[0]}`, () => {
  const { result, calls } = execute({ form })
  assert.equal(result.Code, 0)
  assert.equal(calls.service, 0)
})

test('不能改挂订单商品', () => {
  assert.equal(execute({ form: { DingdanSPID: 'other-product' } }).result.Code, 0)
})

for (const action of ['Insert', 'Delete', 'Add', 'Del', 'Edit', '', null]) test(`售后同步不开放安装点位动作${JSON.stringify(action)}`, () => {
  const { result, calls } = execute({ action })
  assert.equal(result.Code, 0)
  assert.equal(calls.service, 0)
})

test('普通合同编辑入口继续使用原权限检查', () => {
  const { result, calls } = execute({ owner: false, editor: true })
  assert.equal(result.Code, 1)
  assert.equal(calls.contract, 1)
})

test('授权查询异常时不放行', () => assert.throws(() => execute({ failRead: true }), /database-unavailable/))

test('加锁后设备归属发生变化时拒绝保存', () => {
  const movedPosition = { ...oldPosition, DingdanSPID: 'other-product' }
  assert.equal(execute({ movedPosition }).result.Code, 0)
})

for (const coordinates of [
  { AnzhuangWZ_Lat: 91, AnzhuangWZ_Lng: 120 },
  { AnzhuangWZ_Lat: 30, AnzhuangWZ_Lng: 181 },
  { AnzhuangWZ_Lat: 'invalid', AnzhuangWZ_Lng: 120 },
  { AnzhuangWZ_Lat: '', AnzhuangWZ_Lng: 120 }
]) test(`非法坐标不通过售后同步授权：${JSON.stringify(coordinates)}`, () => {
  assert.equal(execute({ form: coordinates }).result.Code, 0)
})

test('稀疏位置提交不会清空已有 IoT 绑定', () => {
  const { result, submitted } = execute({ old: { IoTDeviceId: '01M4EXISTINGIOTDEVICE0001', IoTDeviceNames: '原绑定' },
    form: { IoTDeviceId: undefined, IoTDeviceNames: undefined } })
  assert.equal(result.Code, 1)
  assert.equal(submitted.IoTDeviceId, '01M4EXISTINGIOTDEVICE0001')
  assert.equal(submitted.IoTDeviceNames, '原绑定')
})
