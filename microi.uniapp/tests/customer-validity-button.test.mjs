import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import * as presentationRuntime from '../../Microi.Client/src/views/form-engine/form-view-blocks/module-presentation-runtime.js'
import { requestMenuBadge } from '../../Microi.Client/src/layout/components/Sidebar/menu-badge-batch.js'

// 现有平台 mixin 由 Vite 解析别名；直接执行源码中的方法，保留实际分组与请求辅助函数。
const platformSource = fs.readFileSync(new URL('../../Microi.Client/src/views/form-engine/mixins/diy-table-presentation.mixin.js', import.meta.url), 'utf8')
const platformSandbox = { ...presentationRuntime, requestMenuBadge, console, Map, Set }
vm.runInNewContext(platformSource.replace(/^import\s[\s\S]*?from\s+["'][^"']+["'];?\r?$/gm, '').replace('export default {', 'globalThis.mixin = {'), platformSandbox)
const presentationMixin = platformSandbox.mixin

const source = fs.readFileSync(new URL('../src/tenants/xjy/module-buttons/customer-validity-toggle.js', import.meta.url), 'utf8')
const metadata = JSON.parse(fs.readFileSync(new URL('../profiles/xjy/metadata/customer-validity-button.json', import.meta.url), 'utf8'))
const metrics = JSON.parse(fs.readFileSync(new URL('../profiles/xjy/metadata/customer-list-statistics.json', import.meta.url), 'utf8')).metrics

function page(asObject = false) {
  const schema = { Views: [
    { Scene: 'Detail', Device: 'All', Layout: { Hero: { Metrics: [{ Key: 'detail' }] } } },
    { Scene: 'List', Device: 'PC', Enabled: true, Layout: { Hero: { Metrics: structuredClone(metrics) } } },
    { Scene: 'Card', Device: 'Mobile', Layout: { Hero: { Metrics: structuredClone(metrics) } } }
  ] }
  return { Id: metadata.moduleId, ViewSchema: asObject ? schema : JSON.stringify(schema), PageBtns: [structuredClone(metadata.button), { Id: 'existing', Name: '全部分享', V8Code: 'existing-code' }] }
}

function toggle(menu) {
  const refreshes = []
  vm.runInNewContext(`(function(){${source}\n})()`, { V8: { SysMenuModel: menu, RefreshTable: (...args) => refreshes.push(args) } })
  assert.deepEqual(refreshes, [[]])
  return JSON.parse(typeof menu.ViewSchema === 'string' ? menu.ViewSchema : JSON.stringify(menu.ViewSchema))
}

test('顶部按钮往返切换全部三个统计参数，保留移动端、其它按钮和预期金额配置', () => {
  for (const asObject of [false, true]) {
    const menu = page(asObject)
    const original = typeof menu.ViewSchema === 'string' ? JSON.parse(menu.ViewSchema) : structuredClone(menu.ViewSchema)
    const off = toggle(menu)
    assert.equal(menu.PageBtns[0].Name, '仅有效期内：关闭')
    assert.equal(menu.PageBtns[0].Icon, 'fas fa-toggle-off')
    assert.ok(off.Views[1].Layout.Hero.Metrics.slice(0, 3).every(metric => metric.ParamMap.ValidOnly === false))
    assert.deepEqual(off.Views[0], original.Views[0])
    assert.deepEqual(off.Views[2], original.Views[2])
    assert.deepEqual(off.Views[1].Layout.Hero.Metrics[3], original.Views[1].Layout.Hero.Metrics[3])
    assert.deepEqual(menu.PageBtns[1], { Id: 'existing', Name: '全部分享', V8Code: 'existing-code' })
    const on = toggle(menu)
    assert.equal(menu.PageBtns[0].Name, '仅有效期内：开启')
    assert.ok(on.Views[1].Layout.Hero.Metrics.slice(0, 3).every(metric => metric.ParamMap.ValidOnly === true))
  }
})

test('各页面实例独立，不通过数据库或持久缓存共享用户开关', () => {
  const first = page()
  const second = page()
  toggle(first)
  assert.equal(second.PageBtns[0].Name, '仅有效期内：开启')
  assert.equal(JSON.parse(second.ViewSchema).Views[1].Layout.Hero.Metrics[0].ParamMap.ValidOnly, undefined)
})

test('运行现有平台统计请求方法，按钮参数与原搜索范围一起送达接口且三个指标合并请求', async () => {
  const menu = page()
  const schema = toggle(menu)
  const requests = []
  const host = {
    ModuleHero: schema.Views[1].Layout.Hero, SysMenuModel: menu, SysMenuId: menu.Id, TableId: 'customer-table',
    CurrentDiyTableModel: { Name: 'Diy_Kehu' }, _presentationRequestGeneration: 7,
    DiyCommon: { GetOsClient: () => 'xjy', ApiEngine: { Run: async (key, params) => {
      requests.push({ key, params }); return { Code: 1, Data: { Metrics: { rental: '350.30', buyout: '220.20', annualFilter: '35.03' } } }
    } } },
    _presentationContext: presentationMixin.methods._presentationContext
  }
  const query = { _Keyword: '学校', _Where: [['Zhuangtai', '=', '合作客户']], _Search: { KehuMC: '学校' } }
  await presentationMixin.methods.RefreshModulePresentationData.call(host, [{ Id: 'current-page-only' }], query, 7)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].params.ValidOnly, false)
  assert.deepEqual(JSON.parse(JSON.stringify(requests[0].params.Filters)), query)
  assert.equal(requests[0].params.SysMenuId, menu.Id)
  assert.deepEqual(JSON.parse(JSON.stringify(host.ModuleMetricValues)), { rental: '350.30', buyout: '220.20', annualFilter: '35.03' })
})

test('配置缺失时不刷新或修改其它页面', () => {
  assert.throws(() => toggle({ ViewSchema: JSON.stringify({ Views: [] }), PageBtns: [] }), /未配置合同金额统计/)
})
