import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { findSyncedXjyEngine } = require('./lib/workspace-paths.js')
const source = fs.readFileSync(process.env.IOT_SNAPSHOT_SOURCE || findSyncedXjyEngine(fileURLToPath(new URL('..', import.meta.url)), 'xjy-device-iot-snapshot'), 'utf8')
const run = new Function('V8', source)
const parentId = 'c3dc60a5-2702-495e-b819-3afb1be78d28'
const parent = { Id: parentId, TenantId: 'merchant-a', UserId: 'user-a', ShebeiBH: 'business-code', ShangpinMC: '饮水设备', ShebeiXH: '型号甲', AnzhuangWZ: '大厅' }

// 执行真实接口源码；查询替身只返回授权设备及指定快照，写库方法刻意不提供。
function snapshot({ provider = '', telemetry = null, yunque = null, filters = [], user = { Id: 'user-a', TenantId: 'merchant-a', Level: 1 }, linked = null, id = parentId } = {}) {
  const queries = []
  const iot = linked || { Id: 'iot-id', Provider: provider, DeviceCode: 'vendor-code', DeviceName: '厂商设备', IMEI: 'imei-code', VendorDeviceId: 'vendor-id', TenantId: 'merchant-a', KehuSBID: parentId }
  const V8 = {
    Param: { ParentId: id }, CurrentUser: user,
    Db: { FromSql(sql) {
      assert.match(sql, /^SELECT /)
      const parameters = {}
      queries.push({ sql, parameters })
      return {
        AddInParameter(key, value) { parameters[key] = value; return this },
        First() {
          if (sql.includes('FROM Diy_KehuSB')) return { ...parent, IoTDeviceId: provider ? 'iot-id' : '' }
          if (sql.includes('FROM diy_iot_device')) return iot
          if (sql.includes('FROM diy_yuelong_device')) return telemetry
          if (sql.includes('FROM diy_yunque_device ')) return yunque
          throw new Error(`意外查询：${sql}`)
        },
        ToArray() { assert.ok(sql.includes('FROM diy_yunque_device_filter')); return filters }
      }
    } }
  }
  return { result: run(V8), queries }
}

function fields(result) { return result.Data.Sections.flatMap(section => section.Fields) }
function value(result, label) { return fields(result).find(item => item.Label === label)?.Value }
function labels(result) { return fields(result).map(item => item.Label) }

for (const provider of ['xinjiyuan', 'yuelong', 'yunque', '']) {
  test(`${provider || '未关联'}设备没有快照时保留完整字段，未知状态不伪造`, () => {
    const { result, queries } = snapshot({ provider })
    assert.equal(result.Code, 1)
    assert.equal(result.Data.Bound, Boolean(provider))
    assert.equal(result.Data.DataStatus, provider ? 'bound' : 'unbound')
    assert.equal(result.Data.Provider, provider)
    assert.equal(value(result, '在线状态'), '--')
    assert.equal(result.Data.LastPushTime, '')
    assert.ok(result.Data.Sections.length >= 5)
    assert.ok(fields(result).length >= 24)
    assert.ok(labels(result).includes(provider === 'yunque' ? 'TDS' : '纯水TDS'))
    assert.ok(labels(result).includes(provider === 'yunque' ? '累计流量' : '累计用水'))
    assert.equal(result.Data.Sections.find(section => section.Name === '滤芯寿命').Fields.length, 5)
    if (provider) assert.equal(value(result, 'IoT设备编号'), 'vendor-code')
    if (provider === 'xinjiyuan') assert.equal(value(result, '冰水温度'), '--')
    if (provider === 'yunque') assert.equal(value(result, '报警状态'), '--')
    assert.ok(queries.length <= 3, '空快照不额外查滤芯、不写库')
  })
}

test('零数值、离线状态和滤芯零剩余保持有效，普通用户ICCID继续脱敏', () => {
  const { result } = snapshot({ provider: 'xinjiyuan', telemetry: {
    Remark: JSON.stringify({ Provider: 'xinjiyuan', ColdTemperature: 0 }), LastPushTime: '2026-10-12 12:00:00',
    IMEI: 'imei-code', IsOnline: 0, DeviceState: 0, RawTDS: 0, PurityTDS: 0, UsedFlow: 0, F1Flux: 0, F1FluxMax: 100, ICCID: '1234567890123456'
  } })
  assert.equal(result.Code, 1)
  assert.equal(result.Data.DataStatus, 'synced')
  assert.equal(value(result, '在线状态'), '离线')
  for (const label of ['状态码', '原水TDS', '纯水TDS', '累计用水', '冰水温度']) assert.equal(value(result, label), 0)
  assert.equal(value(result, '一级滤芯'), '0 / 100')
  assert.equal(value(result, 'ICCID'), '1234****3456')
})

test('云雀实测零数据和正常报警保持原义，缺少滤芯时仍展示五级', () => {
  const { result } = snapshot({ provider: 'yunque', yunque: { Id: 'cloud-id', EquipNo: 'vendor-code', LastDataUpdateTime: '2026-10-12 12:00:00', IsOnline: 1, AlarmStatus: 0, Tsd: 0, Flow: 0 } })
  assert.equal(value(result, '在线状态'), '在线')
  assert.equal(value(result, '报警状态'), '正常')
  assert.equal(value(result, 'TDS'), 0)
  assert.equal(value(result, '累计流量'), 0)
  assert.equal(result.Data.Sections.find(section => section.Name === '滤芯寿命').Fields.length, 5)
})

test('无登录、无权限、参数非法和关联归属变化继续拒绝', () => {
  for (const options of [
    { user: null }, { id: "' OR 1=1" }, { user: { Id: 'other', TenantId: 'other', Level: 1 } },
    { provider: 'xinjiyuan', linked: { TenantId: 'other', KehuSBID: parentId } }
  ]) {
    const { result } = snapshot(options)
    assert.equal(result.Code, 0)
    assert.equal(result.Data, null)
  }
})

test('PC模板显示空快照的全部字段并转义厂商设备名称', async () => {
  const template = fs.readFileSync(new URL('../../Microi-V8-Engine/集福鲤平台 (api.jifulii.com)/xjy.Product.Internal/表单引擎/客户设备（Diy_KehuSB）/字段V8事件/IoT物联网（JoinForm184）/模板V8引擎（表单）（V8TmpEngineForm）.js', import.meta.url), 'utf8')
  const result = snapshot({ provider: 'xinjiyuan' }).result
  result.Data.Sections[0].Fields[2].Value = '<script>unsafe</script>'
  const V8 = { Form: { Id: parentId }, FormMode: 'View', ApiEngine: { async Run() { return result } } }
  await new (Object.getPrototypeOf(async function () {}).constructor)('V8', template)(V8)
  for (const label of ['纯水TDS', '累计用水', '一级滤芯', '冰水温度']) assert.ok(V8.Result.includes(label))
  assert.ok(V8.Result.includes('&lt;script&gt;'))
  assert.ok(!V8.Result.includes('<script>'))
})

test('小程序关联组件无需发版即可消费同一完整空快照；接口错误仍独立显示', async () => {
  const vue = fs.readFileSync(new URL('../src/components/mci-join-form/mci-join-form.vue', import.meta.url), 'utf8')
  const script = vue.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '').replace('export default', 'return')
  const result = snapshot({ provider: 'xinjiyuan' }).result
  const component = new Function('V8', script)({ ApiEngine: { async Run() { return result } } })
  const context = { ...component.data(), parentForm: { Id: parentId }, snapshotApiEngineKey: 'xjy-device-iot-snapshot' }
  await component.methods.loadSnapshot.call(context)
  assert.equal(context.snapshotError, '')
  assert.deepEqual(component.computed.snapshotSections.call(context), result.Data.Sections)
  assert.ok(component.computed.snapshotSections.call(context).some(section => section.Name === '水质'))
  const failed = new Function('V8', script)({ ApiEngine: { async Run() { return { Code: 0, Msg: '无权限' } } } })
  await failed.methods.loadSnapshot.call(context)
  assert.equal(context.snapshotError, '无权限')
})
