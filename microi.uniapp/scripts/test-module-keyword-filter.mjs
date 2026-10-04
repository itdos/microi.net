import assert from 'node:assert/strict'
import test from 'node:test'

import { buildModuleKeywordWhere } from '../src/platform/module-keyword-filter.mjs'

test('configured mobile keyword fields become one grouped OR Like filter', () => {
  assert.deepEqual(buildModuleKeywordWhere(['DakaD', 'KaoqinZ'], 'CODEX_POINT'), [
    { AndOr: 'AND', GroupStart: true, Name: 'DakaD', Type: 'Like', Value: 'CODEX_POINT', GroupEnd: false },
    { AndOr: 'OR', GroupStart: false, Name: 'KaoqinZ', Type: 'Like', Value: 'CODEX_POINT', GroupEnd: true }
  ])
})

test('keyword filters trim values, remove duplicates and reject sensitive fields', () => {
  assert.deepEqual(buildModuleKeywordWhere(['Name', 'name', 'DiyToken'], '  测试  '), [
    { AndOr: 'AND', GroupStart: true, Name: 'Name', Type: 'Like', Value: '测试', GroupEnd: true }
  ])
  assert.deepEqual(buildModuleKeywordWhere(['Name'], '   '), [])
})
