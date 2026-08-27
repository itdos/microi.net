import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.resolve(testDir, '../..')
const componentSource = await readFile(
  path.join(testDir, '../docs/.vitepress/theme/components/ProductShowcase.vue'),
  'utf8'
)
const engineSource = await readFile(
  path.join(
    workspaceRoot,
    'Microi-V8-Engine',
    'Microi吾码 (api.itdos.com)',
    'iTdos.Product.Internal',
    '接口引擎',
    '系统',
    '[官网]AI应用列表(official_ai_apps).js'
  ),
  'utf8'
)
const favoriteEngineSource = await readFile(
  path.join(
    workspaceRoot,
    'Microi-V8-Engine',
    'Microi吾码 (api.itdos.com)',
    'iTdos.Product.Internal',
    '接口引擎',
    '系统',
    '[官网]AI应用收藏(official_ai_app_favorite).js'
  ),
  'utf8'
)
const recommendEngineSource = await readFile(
  path.join(
    workspaceRoot,
    'Microi-V8-Engine',
    'Microi吾码 (api.itdos.com)',
    'iTdos.Product.Internal',
    '接口引擎',
    '系统',
    '[官网]AI应用推荐设置(official_ai_app_recommend).js'
  ),
  'utf8'
)
const previewUrlSource = await readFile(
  path.join(testDir, '../docs/.vitepress/theme/utils/app-preview-url.js'),
  'utf8'
)

test('推荐是紧跟全部的虚拟分类，并转换为独立接口筛选参数', () => {
  const categories = componentSource.match(/const defaultBusinessCategories = \[[\s\S]*?\n\]/)?.[0] || ''
  const allIndex = categories.indexOf("value: 'all'")
  const recommendedIndex = categories.indexOf("value: 'recommended'")

  assert.ok(allIndex >= 0)
  assert.ok(recommendedIndex > allIndex)
  assert.ok(categories.indexOf("value: 'platform'") > recommendedIndex)
  assert.ok(categories.indexOf("value: 'game'") > categories.indexOf("value: 'platform'"))
  assert.ok(categories.indexOf("value: 'business'") > categories.indexOf("value: 'game'"))
  assert.match(componentSource, /activeCategory\.value === 'recommended'\) payload\.Recommended = true/)
  assert.match(componentSource, /else if \(activeCategory\.value !== 'all'\) payload\.Category = activeCategory\.value/)
  assert.match(componentSource, /!\['all', 'recommended'\]\.includes\(item\.value\.toLowerCase\(\)\)/)
})

test('推荐标签在应用卡片左上角常亮显示', () => {
  assert.match(componentSource, /v-if="app\.IsRecommend" class="ai-app-recommend-tag"/)
  assert.match(componentSource, /\.ai-app-recommend-tag \{ position: absolute; z-index: 4; top: 10px; left: 10px;/)
  assert.doesNotMatch(componentSource, /hover[^\n]*ai-app-recommend-tag/)
})

test('应用列表同时提供 observer、滚动兜底、手动加载和明确结束态', () => {
  assert.match(componentSource, /new IntersectionObserver/)
  assert.match(componentSource, /window\.addEventListener\('scroll', scheduleVisibleSentinelCheck/)
  assert.match(componentSource, /window\.addEventListener\('resize', scheduleVisibleSentinelCheck/)
  assert.match(componentSource, /class="ai-app-load-more"/)
  assert.match(componentSource, /class="ai-app-finished"/)
  assert.match(componentSource, /aria-live="polite"/)
  assert.match(componentSource, /const pageSize = 24/)
})

test('应用接口失败后停止自动触底重试，只保留用户主动重试入口', () => {
  assert.match(
    componentSource,
    /if \(!hasMore\.value \|\| isLoading\.value \|\| loadError\.value \|\| typeof window === 'undefined'\) return/
  )
  assert.match(componentSource, /v-else-if="loadError && liveApps\.length"[^>]*@click="loadApplications"/)
  assert.match(componentSource, /v-if="!showInitialSkeleton && loadError && !displayApps\.length"/)
})

test('Unity 桃源立即体验使用固定永久壳而不是不可变版本产物', () => {
  const stableEntry = previewUrlSource.match(/'microi-unity-taoyuan':\s*'([^']+)'/)?.[1] || ''
  assert.equal(
    stableEntry,
    'https://static.itdos.com/itdos/micro-app/microi-unity-taoyuan/index.html?stable-entry=current'
  )
  assert.doesNotMatch(stableEntry, /\/releases\/|\/requests\/|\/versions\/|v\d+\.\d+\.\d+/i)
})

test('official_ai_apps only returns recommended published applications when requested', () => {
  const rows = [
    {
      Id: 'recommended', AppKey: 'recommended-app', AppName: '推荐应用',
      ApplicationType: 'Platform', Category: 'business', IsApprove: 1, IsRecommend: 1
    },
    {
      Id: 'ordinary', AppKey: 'ordinary-app', AppName: '普通应用',
      ApplicationType: 'Platform', Category: 'office', IsApprove: 1, IsRecommend: 0
    },
    {
      Id: 'draft', AppKey: 'draft-app', AppName: '未发布推荐应用',
      ApplicationType: 'Web', Category: 'tools', Status: 'Draft', BuildStatus: 'Success', IsRecommend: 1
    }
  ]
  const V8 = {
    Param: { PageIndex: 1, PageSize: 24, Recommended: true },
    SysConfig: { FileServer: 'https://file.example.test' },
    FormEngine: {
      GetTableData() {
        return { Code: 1, Data: rows, DataCount: rows.length }
      }
    }
  }

  const result = new Function('V8', engineSource)(V8)

  assert.equal(result.Code, 1)
  assert.equal(result.DataCount, 1)
  assert.deepEqual(result.Data.map(item => item.AppKey), ['recommended-app'])
  assert.equal(result.Data[0].IsRecommend, 1)
  assert.equal(result.DataAppend.RecommendedOnly, true)
  assert.equal(result.DataAppend.Categories.some(item => item.Key === 'recommended'), false)
})

test('official_ai_apps 精确 AppKey 走单条快速通道，不读取全量列表', () => {
  let tableReads = 0
  let formReads = 0
  const V8 = {
    Param: { ExactAppKey: 'fast-app' },
    SysConfig: { FileServer: 'https://file.example.test' },
    FormEngine: {
      GetFormData(_table, query) {
        formReads += 1
        assert.ok(query._SelectFields.includes('IsRecommend'))
        return { Code: 1, Data: { Id: 'fast', AppKey: 'fast-app', AppName: '快速应用', ApplicationType: 'Platform', IsApprove: 1, IsRecommend: 1 } }
      },
      GetTableData() {
        tableReads += 1
        throw new Error('精确查询不应读取全量列表')
      }
    }
  }

  const result = new Function('V8', engineSource)(V8)

  assert.equal(result.Code, 1)
  assert.equal(result.DataCount, 1)
  assert.equal(result.Data[0].AppKey, 'fast-app')
  assert.equal(formReads, 1)
  assert.equal(tableReads, 0)
})

test('official_ai_apps 在普通分类内始终推荐优先，再按所选条件排序', () => {
  const rows = [
    { Id: 'ordinary-new', AppKey: 'ordinary-new', AppName: '普通新应用', ApplicationType: 'Platform', Category: 'business', IsApprove: 1, IsRecommend: 0, AppUpdateTime: '2026-08-27' },
    { Id: 'recommended-old', AppKey: 'recommended-old', AppName: '推荐旧应用', ApplicationType: 'Platform', Category: 'business', IsApprove: 1, IsRecommend: 1, AppUpdateTime: '2026-01-01' },
    { Id: 'ordinary-old', AppKey: 'ordinary-old', AppName: '普通旧应用', ApplicationType: 'Platform', Category: 'business', IsApprove: 1, IsRecommend: 0, AppUpdateTime: '2026-01-01' }
  ]
  const V8 = {
    Param: { PageIndex: 1, PageSize: 24, Category: 'business', SortBy: 'AppUpdateTime', SortOrder: 'DESC' },
    SysConfig: { FileServer: '' },
    FormEngine: { GetTableData: () => ({ Code: 1, Data: rows, DataCount: rows.length }) }
  }

  const result = new Function('V8', engineSource)(V8)

  assert.deepEqual(result.Data.map(item => item.AppKey), ['recommended-old', 'ordinary-new', 'ordinary-old'])
})

test('收藏状态按 FavoriteKey 查询，收藏总数使用参数化 SQL', () => {
  let statusWhere = []
  const statusV8 = {
    Param: { Action: 'Status', AppIds: ['app-1'] },
    CurrentUser: { Id: 'user-1' },
    FormEngine: {
      GetTableData(_table, query) {
        statusWhere = query._Where
        return { Code: 1, Data: [{ TargetId: 'app-1' }] }
      }
    }
  }
  const statusResult = new Function('V8', favoriteEngineSource)(statusV8)
  assert.equal(statusResult.Code, 1)
  assert.deepEqual(statusResult.Data.FavoriteIds, ['app-1'])
  assert.ok(statusWhere.some(item => item[1] === 'FavoriteKey'))
  assert.ok(!statusWhere.some(item => item[1] === 'TargetId'))

  const sqlParameters = []
  let storeUpdate = null
  const scalarQuery = {
    AddInParameter(name, value) { sqlParameters.push([name, value]); return this },
    ToScalar() { return 7 }
  }
  const setV8 = {
    Param: { Action: 'Set', AppId: 'app-1', IsFavorite: true },
    CurrentUser: { Id: 'user-1' },
    FormEngine: {
      GetFormData(table) {
        if (table === 'sys_microistore') return { Code: 1, Data: { Id: 'app-1', AppKey: 'key-1', AppName: '应用1', ApplicationType: 'Platform', IsApprove: 1 } }
        return { Code: 1, Data: { Id: 'favorite-1', Status: 'Active' } }
      },
      UptFormData(table, form) {
        if (table === 'sys_microistore') storeUpdate = form
        return { Code: 1 }
      }
    },
    Db: { FromSql(sql) { assert.match(sql, /TargetId = @p2/); return scalarQuery } }
  }
  const setResult = new Function('V8', favoriteEngineSource)(setV8)
  assert.equal(setResult.Code, 1)
  assert.equal(setResult.Data.FavoriteCount, 7)
  assert.deepEqual(sqlParameters.map(item => item[0]), ['@p0', '@p1', '@p2', '@p3'])
  assert.deepEqual(storeUpdate._NotSaveField, ['AppVersion'])
})

test('推荐设置接口同时执行 Level 9999 后端鉴权并保护应用版本', () => {
  const denied = new Function('V8', recommendEngineSource)({ CurrentUser: { Id: 'user-1', Level: 100 }, Param: {} })
  assert.equal(denied.Code, 0)

  let update = null
  const allowed = new Function('V8', recommendEngineSource)({
    CurrentUser: { Id: 'admin-1', Level: 9999 },
    Param: { AppId: 'app-1', IsRecommend: true },
    FormEngine: {
      GetFormData: () => ({ Code: 1, Data: { Id: 'app-1', AppKey: 'key-1', ApplicationType: 'Platform', IsApprove: 1 } }),
      UptFormData(_table, form) { update = form; return { Code: 1 } }
    },
    Method: { AddSysLog() {} }
  })
  assert.equal(allowed.Code, 1)
  assert.equal(allowed.Data.IsRecommend, 1)
  assert.equal(update.IsRecommend, 1)
  assert.deepEqual(update._NotSaveField, ['AppVersion'])
})
