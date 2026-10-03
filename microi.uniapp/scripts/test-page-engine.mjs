import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  compilePageEngineRecord,
  pageEngineFilterValues,
  pageEngineWidgets,
  parsePageEngineDataSource,
  resolvePageEngineMenuReference
} from '../src/platform/page-engine-core.mjs'
import { moduleEntryUrl } from '../src/platform/module-navigation.mjs'

const menuId = '11111111-1111-1111-1111-111111111111'
const pageId = '22222222-2222-2222-2222-222222222222'

assert.deepEqual(resolvePageEngineMenuReference({
  Id: menuId,
  Name: '经营分析',
  ComponentPath: '/views/page-engine/renderer.vue',
  Url: `/mic/renderer/${pageId}`
}), { menuId, pageId, routePath: '', title: '经营分析' })

assert.deepEqual(resolvePageEngineMenuReference({
  Id: menuId,
  Name: '经营分析',
  ComponentPath: '/page-engine/renderer',
  Url: '/operation-analysis'
}), { menuId, pageId: '', routePath: '/operation-analysis', title: '经营分析' })

assert.equal(resolvePageEngineMenuReference({ Id: menuId, ComponentPath: '/form-engine/diy-table', Url: '/data' }), null)
assert.equal(resolvePageEngineMenuReference({ Id: menuId, ComponentPath: '/page-engine/renderer', Url: 'https://outside.example/page' }), null)

assert.deepEqual(parsePageEngineDataSource('$ApiBase$/apiengine/operation-summary?view=trend&period=month--OsClient--$OsClient$--'), {
  apiEngineKey: 'operation-summary',
  params: { view: 'trend', period: 'month' }
})
assert.deepEqual(parsePageEngineDataSource('/apiengine/operation-summary?view=table'), {
  apiEngineKey: 'operation-summary',
  params: { view: 'table' }
})
assert.equal(parsePageEngineDataSource('https://outside.example/apiengine/operation-summary'), null)
assert.equal(parsePageEngineDataSource('javascript:alert(1)'), null)

const polluted = JSON.parse('{"safe":"yes","__proto__":{"polluted":true}}')
const record = {
  Id: pageId,
  Title: '经营分析',
  Number: 'PAGE-DEMO',
  JsonObj: {
    formConfig: { mobile: false, autoRefresh: 10 },
    wrapperList: [
      {
        type: 'pannel',
        wrapperOption: {
          number: 10001,
          span: 12,
          height: 240,
          titleOption: { hidden: false, title: '核心指标' }
        },
        widgetList: [
          {
            type: 'statistic',
            label: '指标',
            widgetOption: { number: 10002, span: 8, height: 200 },
            widgetParams: [{
              sort: 0,
              value: '$ApiBase$/apiengine/operation-summary?view=summary',
              typeOptions: {
                dataJson: {
                  ...polluted,
                  data: [{ name: '订单数', value: 0 }],
                  searchData: [{ prop: 'period', label: '统计周期', type: 'select', value: 'month', options: [{ label: '本月', value: 'month' }] }]
                }
              }
            }]
          },
          {
            type: 'html',
            label: '远程脚本区',
            widgetOption: { number: 10003, span: 12 },
            widgetParams: [{ sort: 0, value: '<script>forbidden()</script>' }]
          }
        ]
      },
      {
        type: 'tabs',
        wrapperOption: {
          number: 20001,
          span: 12,
          activeTab: 'trend',
          tabs: [{ key: 'trend', label: '趋势' }]
        },
        tabWidgetMap: {
          trend: [{
            type: 'line',
            label: '月度趋势',
            widgetOption: { number: 20002, span: 12 },
            widgetParams: [{ sort: 0, typeOptions: { dataJson: { xAxis: ['一月'], series: [{ name: '新增', data: [2] }] } } }]
          }]
        }
      }
    ]
  }
}

const manifest = compilePageEngineRecord(record)
assert.equal(manifest.config.mobile, true)
assert.equal(manifest.config.singleScroll, true)
assert.equal(manifest.stats.wrapperCount, 2)
assert.equal(manifest.stats.widgetCount, 3)
assert.equal(manifest.stats.supportedWidgetCount, 2)
assert.deepEqual(pageEngineFilterValues(manifest), { period: 'month' })
assert.equal(manifest.wrappers.every((wrapper) => wrapper.span === 24), true)
assert.equal(pageEngineWidgets(manifest).every((widget) => widget.span === 24), true)
assert.equal(pageEngineWidgets(manifest).find((widget) => widget.originalType === 'html')?.type, 'unsupported')
assert.equal(Object.prototype.polluted, undefined)
assert.equal(Object.prototype.hasOwnProperty.call(pageEngineWidgets(manifest)[0].data, '__proto__'), false)
assert.equal(moduleEntryUrl({ target: 'page-engine', menuId }), `/pages/page-engine/index?menuId=${encodeURIComponent(menuId)}`)

const runtimeSource = fs.readFileSync(new URL('../src/platform/page-engine-runtime.js', import.meta.url), 'utf8')
const pageSource = fs.readFileSync(new URL('../src/pages/page-engine/index.vue', import.meta.url), 'utf8')
const rendererSource = fs.readFileSync(new URL('../src/components/mci-page-engine-renderer/mci-page-engine-renderer.vue', import.meta.url), 'utf8')
const combined = `${runtimeSource}\n${pageSource}\n${rendererSource}`
assert.equal(/\beval\s*\(|new\s+Function\s*\(/.test(combined), false)
assert.ok(runtimeSource.includes("V8.FormEngine.Request('getformdata', 'mic_page'"), '界面页面必须通过受控 FormEngine 读取')
assert.ok(runtimeSource.includes('_SysMenuId: menu.Id'), '界面页面读取必须携带已授权菜单上下文')
assert.ok(runtimeSource.includes('V8.ApiEngine.Run(widget.dataSource.apiEngineKey'), '界面数据源必须走稳定 ApiEngineKey 路由')
assert.equal(runtimeSource.includes('RunLegacy'), false, '界面数据源失败后不得重复执行兼容接口')
assert.ok(pageSource.includes('loadAuthorizedPageEngine(this.menuId'), '界面页面必须先校验授权菜单')
assert.ok(rendererSource.includes('mci-page-engine-widget'), '界面页面必须使用包内原生组件注册表')

console.log('Page Engine mobile runtime checks passed.')
