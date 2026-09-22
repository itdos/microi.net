import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { compileModuleFilterFields } from '../src/platform/list-filter-fields.mjs'

const source = fs.readFileSync(new URL('../src/platform/native-form.js', import.meta.url), 'utf8')
  .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\r?$/gm, '')
  .replace(/export default\s*\{[\s\S]*?\}\s*$/m, '')
  .replace(/\bexport\s+/g, '')
  .concat('\nglobalThis.nativeFormApi = { loadNativeModuleFields };')

function setup(rawFields) {
  const calls = []
  const sandbox = {
    V8: {
      FormEngine: {
        GetDiyFieldByDiyTables: async (params) => {
          calls.push(params)
          return { Code: 1, Data: rawFields }
        }
      }
    },
    getUser: () => ({ Id: 'user-1', RoleIds: ['role-1'] }),
    cachedRequest: async (key, loader) => ({ data: await loader(), fromCache: false }),
    dedupeRequest: async (key, loader) => loader(),
    readCache: () => null,
    removeCachePrefix: () => {},
    writeCache: () => {},
    nativeControls: {
      layout: ['Divider', 'CollapseGroup', 'Tabs'],
      related: ['OpenTable', 'JoinTable', 'JoinForm', 'TableChild'],
      readonly: ['Guid', 'AutoNumber'],
      guarded: ['Button', 'DevComponent']
    },
    formatRegionValue: () => '',
    formatStructuredValue: () => '',
    nativeTreeConfig: () => ({}),
    serializeNativeTreeValue: (value) => value,
    filterFieldsByHiddenCollapseScope: (fields) => fields,
    nativeFieldRoleVisibility: () => ({ visible: true, bindRoleIds: [] }),
    nativeRoleCacheKey: () => 'role-1',
    uni: {}
  }
  vm.runInNewContext(source, sandbox)
  return { api: sandbox.nativeFormApi, calls }
}

test('Join 查询字段加载完整控件和选项元数据，并携带菜单与 TableChild 授权', async () => {
  const rawFields = [{
    Id: 'service-type',
    TableId: 'service-order-table',
    TableName: 'Diy_ShouhouDD',
    Name: 'Leixing',
    Label: '服务类型',
    Component: 'Select',
    Config: JSON.stringify({ SelectSaveField: 'Value', SelectLabel: 'Name' }),
    Data: JSON.stringify([{ Value: '安装', Name: '安装' }, { Value: '维修', Name: '维修' }]),
    Visible: 1,
    AppVisible: 1
  }]
  const { api, calls } = setup(rawFields)
  const auth = { ParentFieldId: 'field-1', ParentRowId: 'device-1' }
  const fields = await api.loadNativeModuleFields({
    Id: 'service-goods-menu',
    DiyTableId: 'service-goods-table',
    ModuleEngineKey: 'service-goods-module',
    JoinTables: JSON.stringify([{ Id: 'service-order-table' }]),
    SearchFieldIds: JSON.stringify([{ Id: 'service-type', TableId: 'service-order-table' }])
  }, { tableChildAuth: auth })

  assert.equal(calls.length, 1)
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].TableIds)), ['service-goods-table', 'service-order-table'])
  assert.equal(calls[0]._SysMenuId, 'service-goods-menu')
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0]._TableChildAuth)), auth)
  assert.equal(fields[0].component, 'Select')
  assert.deepEqual(JSON.parse(JSON.stringify(fields[0].options.map((item) => [item.value, item.label]))), [['安装', '安装'], ['维修', '维修']])
  const filters = compileModuleFilterFields([{
    Id: 'service-type',
    TableId: 'service-order-table',
    TableName: 'Diy_ShouhouDD',
    DisplayType: 'Out'
  }], fields, { primaryTableId: 'service-goods-table', primaryTableName: 'diy_shouhousp' })
  assert.equal(filters[0].type, 'options')
  assert.equal(filters[0].presentation, 'dropdown')
  assert.equal(filters[0].formEngineKey, 'Diy_ShouhouDD')
})
