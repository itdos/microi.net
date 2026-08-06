const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(path.join(root, 'src', 'custom-tab-bar', 'index.js'), 'utf8')
let definition = null
let currentRoute = 'pages/workspace/index'
let shouldFail = false
let timerId = 0

const tabBar = {
  color: '#999999',
  selectedColor: '#E54625',
  backgroundColor: '#ffffff',
  list: [
    { pagePath: 'pages/workspace/index', text: '首页' },
    { pagePath: 'pages/mall/index', text: '商城' },
    { pagePath: 'pages/profile/index', text: '我的' }
  ]
}

vm.runInNewContext(source, {
  Component(value) { definition = value },
  getApp() { return { globalData: { mciTabBar: tabBar } } },
  getCurrentPages() { return [{ route: currentRoute }] },
  setTimeout(callback) { callback(); return ++timerId },
  clearTimeout() {},
  console: { log: console.log, warn: console.warn, error() {} },
  wx: {
    getWindowInfo() { return { windowWidth: 375, windowHeight: 812, safeAreaInsets: { bottom: 24 } } },
    switchTab(options) {
      if (shouldFail) {
        options.fail(new Error('expected navigation failure'))
      } else {
        currentRoute = String(options.url || '').replace(/^\/+/, '')
        options.success()
      }
      options.complete()
    },
    showToast() {}
  }
}, { filename: 'src/custom-tab-bar/index.js' })

assert(definition, 'custom tabBar component must register itself')

const instance = {
  data: JSON.parse(JSON.stringify(definition.data)),
  setData(next) { Object.assign(this.data, next) }
}
Object.entries(definition.methods).forEach(([name, method]) => {
  instance[name] = method.bind(instance)
})

definition.lifetimes.attached.call(instance)
assert.strictEqual(instance.data.selected, 0, 'refresh must select the visible workspace route')

instance.applyExternalState({ selected: 2 })
assert.strictEqual(instance.data.selected, 0, 'external stale selected state must be ignored')

currentRoute = 'pages/profile/index'
definition.pageLifetimes.show.call(instance)
assert.strictEqual(instance.data.selected, 2, 'page show must resync selection from the visible route')

instance.switchTab({ currentTarget: { dataset: { index: 1 } } })
assert.strictEqual(currentRoute, 'pages/mall/index', 'switchTab must navigate to the requested route')
assert.strictEqual(instance.data.selected, 1, 'successful navigation must select the route now visible')
assert.strictEqual(instance.data.switching, false, 'successful navigation must release the switching guard')

shouldFail = true
instance.switchTab({ currentTarget: { dataset: { index: 2 } } })
assert.strictEqual(instance.data.selected, 1, 'failed navigation must retain the visible route selection')
assert.strictEqual(instance.data.switching, false, 'failed navigation must release the switching guard')

definition.lifetimes.detached.call(instance)
console.log('Custom tabBar route-state checks passed.')
