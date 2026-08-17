import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const uniRoot = path.join(root, 'microi.uniapp')
const enginePath = path.join(
  root,
  'Microi-V8-Engine',
  '集福鲤平台 (api.jifulii.com)',
  'xjy.Product.Internal',
  '接口引擎',
  '未分类',
  '小程序客户跨商家查重(xjy-search-private-customers).js'
)
const source = fs.readFileSync(enginePath, 'utf8')
const execute = new Function('V8', 'DateNow', source)

function runEngine({ keyword = '测试客户', level = 10, tenantId = 'tenant-a', allow = true } = {}) {
  const calls = []
  const candidates = [
    {
      KehuMC: '测试客户', TenantId: 'tenant-a', TenantName: '甲商家', FuzeR: '张负责人',
      FuzeRID: 'owner-a', XiezuoR: '[{"Name":"李协作","Id":"collab-a"}]',
      Chengshi: '浙江省杭州市', XiangxiDZ: '西湖区一号', KehuGJZTZ: 1, UserId: 'creator-a'
    },
    {
      KehuMC: '测试客户外地门店', TenantId: 'tenant-b', TenantName: '乙商家', FuzeR: '王负责人',
      FuzeRID: 'owner-b', XiezuoR: '[{"Name":"赵协作","Id":"collab-b"}]',
      Chengshi: '上海市', XiangxiDZ: '浦东新区二号', KehuGJZTZ: 2, UserId: 'creator-b'
    },
    {
      KehuMC: '测试客户公海', TenantId: 'tenant-a', TenantName: '甲商家', FuzeR: '',
      FuzeRID: '', XiezuoR: '', Chengshi: '杭州市', XiangxiDZ: '三号', KehuGJZTZ: 2, UserId: 'creator-c'
    },
    {
      KehuMC: '测试客户本人负责', TenantId: 'tenant-a', TenantName: '甲商家', FuzeR: '当前用户',
      FuzeRID: 'user-a', XiezuoR: '', Chengshi: '杭州市', XiangxiDZ: '四号', KehuGJZTZ: 1, UserId: 'creator-d'
    }
  ]
  const V8 = {
    CurrentUser: {
      Id: 'user-a', Account: 'tester', TenantId: tenantId, Level: level,
      RoleIds: '["role-a"]'
    },
    Param: { Keyword: keyword, MenuId: 'customer-menu', Limit: 10 },
    FormEngine: {
      GetFormData(table) {
        calls.push({ method: 'one', table })
        if (String(table).toLowerCase() === 'sys_menu') {
          return { Code: 1, Data: { Id: 'customer-menu', DiyTableName: 'Diy_Kehu' } }
        }
        return { Code: 2 }
      },
      GetTableData(table, options) {
        calls.push({ method: 'list', table, options })
        if (String(table).toLowerCase() === 'sys_rolelimit') {
          return { Code: 1, Data: allow ? [{ Id: 'menu-limit-a' }] : [] }
        }
        if (String(table).toLowerCase() === 'diy_kehu') return { Code: 1, Data: candidates }
        if (String(table).toLowerCase() === 'sys_user') {
          return { Code: 1, Data: [
            { Id: 'creator-a', Level: 20 }, { Id: 'owner-a', Level: 20 },
            { Id: 'creator-b', Level: 20 }, { Id: 'owner-b', Level: 20 },
            { Id: 'creator-c', Level: 20 }, { Id: 'creator-d', Level: 20 }
          ] }
        }
        throw new Error(`unexpected table ${table}`)
      }
    },
    Method: {
      AddSysLog() {},
      NewUlid() { return 'trace-test' }
    },
    EncryptHelper: { Sha256Hex(value) { return `hash-${value.length}` } }
  }
  return { result: execute(V8, () => '2026-08-17 12:00:00'), calls }
}

const normal = runEngine()
assert.equal(normal.result.Code, 1)
assert.equal(normal.result.Data.Matches.length, 2, '应只返回普通列表不可见的同商家私有客户和其他商家客户')
assert.deepEqual(normal.result.Data.Matches.map((row) => row.RelationType), [
  'OWN_TENANT_PRIVATE',
  'OTHER_TENANT'
])
assert.equal(normal.result.Data.Matches[1].ScopeLabel, '其他商家正在跟进')
assert.equal(normal.result.Data.Matches[0].CollaboratorNames, '李协作')

const customerCall = normal.calls.find((call) => String(call.table).toLowerCase() === 'diy_kehu')
assert.ok(customerCall, '应查询客户表')
assert.equal(customerCall.options._Where.length, 1, '查重查询不应附加 TenantId 条件')
assert.equal(customerCall.options._Where[0][0], 'KehuMC')
assert.equal(customerCall.options._Where[0][1], 'Like')
assert.ok(!JSON.stringify(customerCall.options._Where).includes('TenantId'))

const shortKeyword = runEngine({ keyword: '测试' })
const shortCall = shortKeyword.calls.find((call) => String(call.table).toLowerCase() === 'diy_kehu')
assert.equal(shortCall.options._Where[0][1], '=', '2-3 字关键词必须精确匹配')

const denied = runEngine({ allow: false })
assert.equal(denied.result.Code, 0)
assert.match(denied.result.Msg, /无权查看客户页数据/)
assert.ok(!denied.calls.some((call) => String(call.table).toLowerCase() === 'diy_kehu'))

const admin = runEngine({ level: 999, tenantId: '' })
assert.equal(admin.result.Code, 1)
assert.equal(admin.result.Data.Matches.length, 0, '全局管理员已有普通查看权限，不应产生受限卡片')

const serialized = JSON.stringify(normal.result.Data)
for (const forbidden of ['"Id"', 'TenantId', 'Phone', 'ShoujiH', 'Longitude', 'Latitude']) {
  assert.ok(!serialized.includes(forbidden), `响应中不应包含 ${forbidden}`)
}

const listSource = fs.readFileSync(path.join(uniRoot, 'src/pages/business/list.vue'), 'utf8')
const configSource = fs.readFileSync(path.join(uniRoot, 'src/tenants/xjy/business.js'), 'utf8')
const runtimeSource = fs.readFileSync(path.join(uniRoot, 'src/platform/business-runtime.js'), 'utf8')
const cardSource = fs.readFileSync(path.join(uniRoot, 'src/components/mci-restricted-record-card/mci-restricted-record-card.vue'), 'utf8')

assert.match(configSource, /apiEngineKey:\s*'xjy-search-private-customers'/)
assert.match(listSource, /loadRestrictedLookup/)
assert.match(listSource, /mci-restricted-record-card/)
assert.match(runtimeSource, /export async function loadRestrictedLookup/)
assert.ok(!cardSource.includes('@tap="open'), '受限卡片不得打开客户详情')
assert.ok(!cardSource.includes('callPhone'), '受限卡片不得提供电话动作')
assert.ok(!cardSource.includes("label: '所在城市'"), '受限客户卡片不得展示格式不稳定的城市字段')

console.log('customer duplicate search checks passed')
