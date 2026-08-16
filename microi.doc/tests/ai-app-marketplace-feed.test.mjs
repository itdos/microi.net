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
  assert.match(componentSource, /activeCategory\.value === 'recommended'\) payload\.Recommended = true/)
  assert.match(componentSource, /else if \(activeCategory\.value !== 'all'\) payload\.Category = activeCategory\.value/)
  assert.match(componentSource, /!\['all', 'recommended'\]\.includes\(item\.value\.toLowerCase\(\)\)/)
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
