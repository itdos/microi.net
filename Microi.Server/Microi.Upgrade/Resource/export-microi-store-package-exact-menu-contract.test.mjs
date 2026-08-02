import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const packageModel = JSON.parse(await readFile(new URL('./app.microi.store.json', import.meta.url), 'utf8'))
const exporter = (packageModel.SysApiEngines || [])
  .find(item => item.ApiEngineKey === 'export-microi-store-package')
const source = String(exporter?.ApiV8Code || '')

test('application-store package preserves its release version while the exporter is v1.1.4', () => {
  assert.match(String(packageModel.PackageInfo?.Version || ''), /^v\d+\.\d+\.\d+$/)
  assert.equal(exporter.Version, 'v1.1.4')
  assert.match(String(exporter.ChangeHistory || ''), /v1\.1\.4[\s\S]*?ExactMenuIds/)
  assert.match(source, /ApiEngineKey: export-microi-store-package/)
  assert.match(source, /Version: v1\.1\.4/)
})

test('ExactMenuIds is opt-in and normal exports keep recursive descendants', () => {
  assert.match(
    source,
    /var ExactMenuIds = V8\.Param\.ExactMenuIds === true \|\| V8\.Param\.ExactMenuIds === 1 \|\| String\(V8\.Param\.ExactMenuIds \|\| ''\)\.toLowerCase\(\) == 'true';/,
  )
  assert.match(
    source,
    /var childIds = ExactMenuIds \? \[menuId\] : getAllChildMenuIds\(menuId, allMenus\);/,
  )
  assert.match(source, /var getAllChildMenuIds = function \(parentId, allMenus, visited\)/)
})

test('exact exports reject missing menu ids and skip TableChild menu expansion', () => {
  assert.match(
    source,
    /if \(ExactMenuIds && exportMenus\.length != allRelatedMenuIds\.length\) \{\s*throw new Error\('精确菜单导出失败：部分指定 MenuId 不存在/,
  )
  assert.match(
    source,
    /if \(!ExactMenuIds && tableIds\.length > 0\) \{\s*var tableChildFieldsResult/,
  )
  assert.doesNotMatch(
    source,
    /if \(tableIds\.length > 0\) \{\s*var tableChildFieldsResult/,
    'TableChild expansion must never bypass the exact-mode guard',
  )
})
