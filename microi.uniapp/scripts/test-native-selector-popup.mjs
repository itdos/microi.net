import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'
import { positionNativeSelector } from '../src/platform/native-selector-position.mjs'

const require = createRequire(import.meta.url)
const Vue = require('vue')
const { parse } = require('@vue/compiler-sfc')
const { compile } = require('@vue/compiler-dom')
const { preprocess } = require('@dcloudio/uni-cli-shared/lib/preprocess')
const source = readFileSync(new URL('../src/components/mci-native-field/mci-native-field.vue', import.meta.url), 'utf8')
const { descriptor } = parse(source)
const template = preprocess(descriptor.template.content, { H5: true }, { type: 'html' })
const renderCode = compile(template, { mode: 'function', prefixIdentifiers: true, isCustomElement: tag => tag !== 'Teleport' }).code
const script = descriptor.script.content.replace(/^import[\s\S]*?from ['"][^'"]+['"]\s*$/gm, '').replace('export default', 'const component =')

function fixture({ count = 1, portal = true, remote = false, load = async () => ({ options: [], total: 0, totalKnown: true }) } = {}) {
  const listeners = new Set()
  const events = []
  const calls = []
  let keyboardHidden = 0
  const uni = {
    onKeyboardHeightChange: handler => listeners.add(handler),
    offKeyboardHeightChange: handler => listeners.delete(handler),
    hideKeyboard: () => keyboardHidden++,
    getWindowInfo: () => ({ windowHeight: 844 }),
    createSelectorQuery() { return { in() { return this }, select() { return this }, boundingClientRect(callback) { this.callback = callback; return this }, exec() { this.callback({ left: 160, top: 470, width: 210, height: 43, bottom: 513 }) } } }
  }
  const component = vm.runInNewContext(`${script}\ncomponent`, {
    uni, setTimeout, clearTimeout,
    parseJson(value, fallback) { try { return typeof value === 'string' ? JSON.parse(value) : value } catch { return fallback } },
    createRegionPickerState: () => ({}),
    isNativeFieldMultiple: () => false,
    isRemoteNativeFieldOptions: () => remote,
    filterNativeFieldOptions: (options, keyword) => options.filter(option => option.label.includes(keyword)),
    getSafeAreaMetrics: () => ({ windowWidth: 390, windowHeight: 844, top: 47, bottom: 34, capsuleTop: 51, capsuleHeight: 32 }),
    positionNativeSelector,
    loadNativeFieldOptionPage: (...args) => { calls.push(args); return load(...args) }
  })
  // The host below exercises Vue's real Teleport tree and events without a browser.
  // Native input binding is provided by UniApp on devices; this host changes the model directly.
  component.render = vm.runInNewContext(`(() => { ${renderCode} })()`, { Vue: { ...Vue, vModelText: {} } })
  const node = (type, text = '') => ({ type, text, children: [], props: {}, parent: null })
  const body = node('body')
  function remove(child) {
    if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1)
    child.parent = null
  }
  const renderer = Vue.createRenderer({
    createElement: node, createText: text => node('#text', text), createComment: text => node('#comment', text),
    setText: (target, text) => { target.text = text },
    setElementText: (target, text) => { target.text = text; target.children = [] },
    patchProp: (target, key, old, value) => { target.props[key] = value },
    parentNode: target => target.parent,
    nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] || null,
    querySelector: selector => selector === 'body' ? body : null,
    remove,
    insert(child, parent, anchor = null) {
      remove(child)
      const index = anchor ? parent.children.indexOf(anchor) : -1
      parent.children.splice(index < 0 ? parent.children.length : index, 0, child)
      child.parent = parent
    }
  })
  const controls = []
  const app = renderer.createApp({ render: () => Vue.h('view', { class: 'page' }, [
    Vue.h('view', { class: 'page-header' }, '需求方案'),
    Vue.h('scroll-view', { class: 'child-list', style: { overflow: 'hidden', transform: 'translateY(0)' } },
      Array.from({ length: count }, (_, index) => Vue.h(component, {
        key: index, ref: control => { controls[index] = control }, selectorPortal: portal,
        field: { Name: 'Model', Label: '设备型号', component: 'Select', config: {}, options: [
          { value: 'A100', label: 'A100', raw: { Id: 'device-1', Name: '设备一' } },
          { value: 'B200', label: 'B200', raw: { Id: 'device-2', Name: '设备二' } }
        ] },
        formData: { Id: `point-${index}` }, menuId: 'authorized-menu', tableChildAuth: { ParentRowId: 'proposal-1' },
        'onUpdate:modelValue': value => events.push(['change', value]),
        onSelect: selection => events.push(['select', selection])
      }))),
    Vue.h('view', { class: 'page-footer' }, '编辑')
  ]) })
  app.mount(body)
  const find = (className, root = body) => {
    if (String(root.props.class || '').split(' ').includes(className)) return root
    return root.children.map(child => find(className, child)).find(Boolean)
  }
  return { app, body, controls, events, calls, listeners, find, get keyboardHidden() { return keyboardHidden } }
}

for (const count of [1, 3]) {
  test(`${count} child rows: original dropdown and search escape clipping with a page-wide dismissal mask`, async () => {
    const f = fixture({ count })
    try {
      await f.controls[0].openSelector()
      await Vue.nextTick()
      const mask = f.find('native-select__backdrop--portal')
      const dropdown = f.find('native-select--portal')
      assert.equal(mask.parent, f.body)
      assert.equal(dropdown.parent, f.body)
      assert.equal(dropdown.props.style.top, '470px')
      assert.equal(dropdown.props.style.left, '160px')
      assert.equal(dropdown.props.style.width, '210px')
      assert.equal(f.find('native-select__anchor').props.style.height, '43px')
      assert.ok(f.find('native-select__inline-search', dropdown))
      assert.ok(f.find('native-select__pointer', dropdown))
      assert.equal(f.find('native-select__popup-header'), undefined)
      assert.equal(f.find('native-select__popover', f.find('child-list')), undefined)
      mask.props.onTap({ stopPropagation() {} })
      await Vue.nextTick()
      assert.equal(f.find('native-select__popover'), undefined)
      assert.equal(f.listeners.size, 0)
      assert.equal(f.keyboardHidden, 1)
      assert.deepEqual(f.events, [])
    } finally { f.app.unmount() }
  })
}

test('inline search filters options and selection emits the existing value/raw payload then closes', async () => {
  const f = fixture()
  try {
    const field = f.controls[0]
    await field.openSelector()
    field.searchKeyword = 'B200'
    await field.loadOptionPage(true)
    await Vue.nextTick()
    assert.equal(field.selectorOptions.length, 1)
    f.find('native-select__option').props.onTap()
    await Vue.nextTick()
    assert.equal(f.events[0][1], 'B200')
    assert.equal(f.events[1][1].raw.Id, 'device-2')
    assert.equal(f.find('native-select__popover'), undefined)
  } finally { f.app.unmount() }
})

test('keyboard keeps the anchored search visible and unmount discards a late remote response', async () => {
  let resolve
  const f = fixture({ remote: true, load: () => new Promise(done => { resolve = done }) })
  const field = f.controls[0]
  const opening = field.openSelector()
  await Vue.nextTick()
  assert.equal(f.calls[0][1].Id, 'point-0')
  assert.equal(f.calls[0][2].menuId, 'authorized-menu')
  assert.equal(f.calls[0][2].tableChildAuth.ParentRowId, 'proposal-1')
  for (const listener of f.listeners) listener({ height: 300 })
  assert.equal(field.selectorKeyboardHeight, 300)
  assert.ok(field.selectorPortalLayout.top + field.selectorPortalLayout.height <= 844 - 300 - 8)
  f.app.unmount()
  resolve({ options: [{ value: 'late', label: 'late' }], total: 1, totalKnown: true })
  await opening
  assert.equal(f.listeners.size, 0)
  assert.equal(f.find('native-select__popover'), undefined)
  assert.equal(field.selectorOptions.length, 0)
  assert.deepEqual(f.events, [])
})

test('ordinary dropdowns retain their inline presentation', async () => {
  const f = fixture({ portal: false })
  try {
    await f.controls[0].openSelector()
    await Vue.nextTick()
    assert.ok(f.find('native-select__popover', f.find('child-list')))
    assert.ok(f.find('native-select__inline-search'))
    assert.equal(f.find('native-select--portal'), undefined)
    assert.equal(f.listeners.size, 0)
  } finally { f.app.unmount() }
})

test('dropdown stays aligned to its input and fits above or below it on small screens', () => {
  for (const windowWidth of [375, 390, 430]) {
    const viewport = { windowWidth, windowHeight: 667, top: 44, bottom: 34 }
    for (const inputTop of [120, 470, 590]) {
      for (const keyboardHeight of [0, 280]) {
        const rect = { left: 140, top: inputTop, width: 210, height: 42 }
        const layout = positionNativeSelector(rect, viewport, keyboardHeight)
        const listTop = layout.placement === 'top'
          ? layout.top - layout.gap - layout.listHeight - 2
          : layout.top + layout.height + layout.gap
        assert.equal(layout.width, rect.width)
        assert.ok(listTop >= 52 - 0.01)
        assert.ok(listTop + layout.listHeight + 2 <= viewport.windowHeight - Math.max(34, keyboardHeight) - 8 + 0.01)
        assert.ok(layout.listHeight > 0)
      }
    }
  }
})
