import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const commonSource = fs.readFileSync(new URL('../src/utils/diy.common.js', import.meta.url), 'utf8')

test('removed browser SQL APIs fail with an actionable migration message', () => {
  assert.match(commonSource, /RunSqlGetModel\s*:\s*DiyCommon\.CreateRemovedV8Api\("RunSqlGetModel"\)/)
  assert.match(commonSource, /RunSqlGetList\s*:\s*DiyCommon\.CreateRemovedV8Api\("RunSqlGetList"\)/)
  assert.match(commonSource, /浏览器端不再允许直接执行 SQL/)
  assert.match(commonSource, /V8\.ApiEngine\.Run/)
  assert.match(commonSource, /V8\.FormEngine\.GetFormData\/GetTableData/)
})
