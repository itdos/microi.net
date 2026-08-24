import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  formatChangeLogDate,
  getChangeTypeMeta,
  isSameAppVersion,
  normalizeChangeLogResponse
} from './app-changelog.js'

const detailSource = await readFile(new URL('../components/AppDetail.vue', import.meta.url), 'utf8')

test('normalizes the marketplace changelog capability contract without inventing records', () => {
  const normalized = normalizeChangeLogResponse({
    DataAppend: {
      ChangeLogAvailable: true,
      ChangeLogCount: 3,
      ChangeLogs: [{
        Id: 'log-1',
        Version: 'v7.1.0',
        Title: '完整版本说明',
        ChangeType: 'Optimization',
        Content: '降低响应体积并补齐观测能力。',
        ReleaseTime: '2026-08-24 09:00:00'
      }]
    }
  })

  assert.equal(normalized.available, true)
  assert.equal(normalized.total, 3)
  assert.equal(normalized.logs.length, 1)
  assert.equal(normalized.logs[0].Version, 'v7.1.0')
})

test('distinguishes an unsupported source from an available source with no logs', () => {
  assert.deepEqual(normalizeChangeLogResponse({ DataAppend: {} }), {
    available: false,
    total: 0,
    logs: []
  })
  assert.deepEqual(normalizeChangeLogResponse({
    DataAppend: { ChangeLogAvailable: true, ChangeLogCount: 0, ChangeLogs: [] }
  }), {
    available: true,
    total: 0,
    logs: []
  })
})

test('maps real marketplace change types and formats release dates', () => {
  assert.deepEqual(getChangeTypeMeta('Optimization'), { label: '优化', tone: 'improvement' })
  assert.deepEqual(getChangeTypeMeta('Compatibility'), { label: '兼容', tone: 'compatibility' })
  assert.deepEqual(getChangeTypeMeta('自定义'), { label: '自定义', tone: 'default' })
  assert.equal(formatChangeLogDate('2026-08-24 09:00:00'), '2026年8月24日 · 09:00')
  assert.equal(isSameAppVersion('v7.1.0', '7.1.0'), true)
  assert.equal(isSameAppVersion('v7.1.0', 'v7.0.9'), false)
})

test('the public app detail page reads the lightweight model and renders safe timeline states', () => {
  assert.match(detailSource, /\/apiengine\/get-microi-store-model\?OsClient=/)
  assert.match(detailSource, /JSON\.stringify\(\{ Id: storeId, IncludePackage: false \}\)/)
  assert.match(detailSource, /class="app-detail-changelog"/)
  assert.match(detailSource, /v-for="\(log, index\) in visibleChangeLogs"/)
  assert.match(detailSource, /当前应用尚未补录独立更新日志/)
  assert.match(detailSource, /当前商城源尚未提供更新日志能力/)
  assert.match(detailSource, /更新日志暂时未能读取/)
  assert.doesNotMatch(detailSource, /v-html="log\.Content"/)
})
