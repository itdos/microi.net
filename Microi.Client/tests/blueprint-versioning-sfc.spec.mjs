import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

const base = new URL('../src/views/blueprint/', import.meta.url)

test('blueprint designer compiles with history, semantic diff and safe rollback UI', async () => {
  const filename = new URL('BlueprintDesigner.vue', base)
  const source = await readFile(filename, 'utf8')
  const { descriptor, errors } = parse(source, { filename: filename.pathname })
  assert.deepEqual(errors, [])

  const template = compileTemplate({
    source: descriptor.template.content,
    filename: filename.pathname,
    id: 'blueprint-versioning-test',
  })
  assert.deepEqual(template.errors, [])
  assert.ok(compileScript(descriptor, { id: 'blueprint-versioning-test' }).content.length > 0)

  assert.match(source, /BlueprintApi\.listHistory/)
  assert.match(source, /BlueprintApi\.compare/)
  assert.match(source, /BlueprintApi\.rollback/)
  assert.match(source, /this\.currentHash/)
  assert.match(source, /ElMessageBox\.confirm/)
  assert.match(source, /\/api\/V8Engine\/GetApiEngineList/)
  assert.doesNotMatch(source, /\/api\/V8Engine\/ListApiEngine/)
  assert.doesNotMatch(source, /\/api\/DiyTable\/GetTableData/)
  assert.match(source, /FormEngine\.GetTableData\("diy_table"/)
  assert.match(source, /engineRes\?\.Data\?\.List/)
  assert.doesNotMatch(source, /window\.(?:alert|confirm|prompt)\s*\(/)
  assert.match(source, /align-center draggable append-to-body/)
})

test('blueprint api keeps history endpoints on the protected V8Engine controller', async () => {
  const source = await readFile(new URL('api.js', base), 'utf8')
  for (const endpoint of [
    '/api/V8Engine/ListBlueprintHistory',
    '/api/V8Engine/GetBlueprintHistory',
    '/api/V8Engine/CompareBlueprintVersions',
    '/api/V8Engine/RollbackBlueprint',
  ]) {
    assert.ok(source.includes(endpoint), `missing ${endpoint}`)
  }
})
