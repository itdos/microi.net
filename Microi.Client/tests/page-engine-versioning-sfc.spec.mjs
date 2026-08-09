import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

const pageRoot = new URL('../src/views/page-engine/', import.meta.url)
const headerUrl = new URL('engine/components/form-designer/layout/layout-header.vue', pageRoot)

test('page designer header compiles with real save, history, diff, import, export and rollback UI', async () => {
  const source = await readFile(headerUrl, 'utf8')
  const { descriptor, errors } = parse(source, { filename: headerUrl.pathname })
  assert.deepEqual(errors, [])

  const template = compileTemplate({
    source: descriptor.template.content,
    filename: headerUrl.pathname,
    id: 'page-versioning-test',
  })
  assert.deepEqual(template.errors, [])
  assert.ok(compileScript(descriptor, { id: 'page-versioning-test' }).content.length > 0)

  for (const capability of [
    'PageVersionApi.save',
    'PageVersionApi.listHistory',
    'PageVersionApi.compare',
    'PageVersionApi.export',
    'PageVersionApi.rollback',
    'PageSourceBridge.build',
    'PageSourceBridge.parse',
    'PageVersionApi.listPublishedAssets',
    'PageVersionApi.resolveAsset',
    'rekeyAssetTree',
    'ExpectedCurrentHash',
    'undoDesign',
    'redoDesign',
    'handleHistoryShortcut',
  ]) {
    assert.ok(source.includes(capability), `missing ${capability}`)
  }
  assert.doesNotMatch(source, /message:\s*['"]保存成功!['"]/u)
  assert.doesNotMatch(source, /postMessage\([^)]*,\s*['"]\*['"]\s*\)/u)
  assert.match(source, /window\.location\.origin/u)
})

test('page version api uses authenticated V8Engine controller endpoints', async () => {
  const source = await readFile(new URL('version-api.js', pageRoot), 'utf8')
  for (const endpoint of [
    '/api/V8Engine/GetPageEngineDetail',
    '/api/V8Engine/SavePageEngine',
    '/api/V8Engine/ListPageEngineHistory',
    '/api/V8Engine/GetPageEngineHistory',
    '/api/V8Engine/ComparePageEngineVersions',
    '/api/V8Engine/ExportPageEngine',
    '/api/V8Engine/RollbackPageEngine',
  ]) {
    assert.ok(source.includes(endpoint), `missing ${endpoint}`)
  }
  assert.match(source, /mci_asset_package/u)
  assert.match(source, /mci-asset-resolve/u)
  assert.match(source, /_Where/u)
})

test('page store carries server hash outside editable JsonObj', async () => {
  const source = await readFile(new URL('engine/stores/pageEngine.js', pageRoot), 'utf8')
  assert.match(source, /currentHash:\s*['"]/u)
  assert.match(source, /historyAvailable:\s*false/u)
  assert.match(source, /setVersionState\(/u)
  assert.match(source, /historyLimitBytes:\s*20\s*\*\s*1024\s*\*\s*1024/u)
  assert.match(source, /captureDesignHistory\(/u)
  assert.match(source, /undoDesign\(/u)
  assert.match(source, /redoDesign\(/u)
})

test('page store keeps bounded lossless undo and redo snapshots', async () => {
  const storage = new Map()
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  }
  const { createIsolatedPageEngineStore } = await import(new URL('engine/stores/pageEngine.js', pageRoot))
  const store = createIsolatedPageEngineStore()
  store.updateFormData({ JsonObj: { formConfig: {}, wrapperList: [] } })
  store.formData.JsonObj.wrapperList.push({ wrapperOption: { number: 'w1' }, widgetList: [] })
  assert.equal(store.captureDesignHistory(), true)
  store.formData.JsonObj.wrapperList[0].widgetList.push({ widgetOption: { number: 'x1' } })
  assert.equal(store.captureDesignHistory(), true)
  assert.equal(store.undoDesign(), true)
  assert.equal(store.formData.JsonObj.wrapperList[0].widgetList.length, 0)
  store.finishDesignHistoryApply()
  assert.equal(store.redoDesign(), true)
  assert.equal(store.formData.JsonObj.wrapperList[0].widgetList.length, 1)
  assert.ok(store.undoStack.length <= store.historyLimitCount)
})

test('page designer route imports DiyCommon before using its authentication token', async () => {
  const autopageUrl = new URL('autopage.vue', pageRoot)
  const source = await readFile(autopageUrl, 'utf8')
  const { descriptor, errors } = parse(source, { filename: autopageUrl.pathname })
  assert.deepEqual(errors, [])
  assert.ok(compileScript(descriptor, { id: 'page-autopage-test' }).content.length > 0)
  assert.match(source, /import\s*\{\s*DiyCommon\s*\}\s*from\s*["']@\/utils\/diy\.common["']/u)
  assert.match(source, /setToken\(DiyCommon\.getToken\(\)\)/u)
})
