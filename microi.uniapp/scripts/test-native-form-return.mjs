import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'

// 执行实际页面生命周期、导航与提交方法；只替换平台和网络边界，不写真实业务数据。
const source = fs.readFileSync(new URL('../src/pages/native-form/index.vue', import.meta.url), 'utf8')
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*/g, '')
  .replace('export default', 'const component =')
const clone = (value) => JSON.parse(JSON.stringify(value))
const tick = () => new Promise(resolve => setImmediate(resolve))

function setup(overrides = {}) {
  const calls = { reads: [], saves: [], events: [], toasts: [], navigation: [], tabs: [] }
  const timers = new Map()
  const rows = { 'row-1': { Id: 'row-1', Title: '原始标题', Nested: { value: '原值' } } }
  const stack = [{ source: 'list' }]
  let component
  let timerId = 0
  const sandbox = {
    themeMixin: {}, MciBusinessRelatedList: {}, MciCustomerPicker: {}, MciPosterDetail: {}, MciVisitTargetFields: {},
    console, getUser: () => ({}), setUser() {}, V8: { FormEngine: {} },
    parseJson: (value, fallback) => { try { return JSON.parse(value) } catch { return fallback } },
    normalizeFormRecordAdapter: value => value,
    isFormEngineRecordAdapter: value => value === 'form-engine',
    createChildDraftSession() {}, disposeChildDraftSession() {}, disposeTenantForm() {},
    createTenantFormState: () => ({}), refreshTenantFormDerivedValues: async () => {},
    loadModuleViewManifest: async () => ({}), compileFormConfig: () => ({}),
    loadNativeFormRecordDefinition: async () => ({ fields: [{ Name: 'Title' }], groups: [] }),
    scopeNativeFormDefinition: value => value, applyNativeFormViewDefinition: value => value,
    defaultFormData: (_, row) => clone(row), hydrateNativeFormOptions: async () => {}, initializeTenantForm: async () => {},
    loadNativeFormRecord: async (options) => {
      calls.reads.push(clone(options))
      return { Code: 1, Data: clone(rows[options.rowId] || {}) }
    },
    validateNativeForm: () => '', tenantFormBusyMessage: () => '',
    prepareTenantFormSubmit: async () => ({}), nativeFormDefaultSubmitValues: () => ({}),
    flushChildDrafts: async () => {}, buildTableChildDefaultValues() {}, notifyTenantFormSaved: async () => {},
    saveNativeFormRecord: async (options) => {
      calls.saves.push(clone(options))
      const id = options.rowId || 'added-row'
      rows[id] = { ...clone(options.form), Id: id, Title: `${options.form.Title}（已保存）` }
      return { Code: 1, Data: clone(rows[id]) }
    },
    setTimeout: (callback) => { timers.set(++timerId, callback); return timerId },
    clearTimeout: id => timers.delete(id),
    ...overrides
  }
  const uni = sandbox.uni = {
    showToast: value => calls.toasts.push(value),
    $emit: (name, event) => calls.events.push({ name, event: clone(event) }),
    switchTab: value => calls.tabs.push(value),
    navigateTo(options) {
      calls.navigation.push(options)
      if (uni.navigationFailure) { options.fail?.({ errMsg: '页面栈已满' }); options.complete?.(); return }
      if (uni.deferNavigation) return
      const query = Object.fromEntries(options.url.split('?')[1].split('&').map(pair => {
        const index = pair.indexOf('=')
        return [pair.slice(0, index), pair.slice(index + 1)]
      }))
      createPage(query, options.events)
      options.success?.({})
      options.complete?.()
    },
    navigateBack(options = {}) {
      if (stack.length <= 1) { options.fail?.(); return }
      const page = stack.pop()
      component.onUnload.call(page)
      if (stack.at(-1).mode) component.onShow.call(stack.at(-1))
    }
  }
  component = vm.runInNewContext(`${script}; component`, sandbox)
  function createPage(query = {}, events = {}) {
    const page = {
      ...component.data(), ...component.methods,
      canEditRecord: true, hasRelatedFields: false,
      $nextTick: async callback => callback?.(),
      refreshTenantFloatingActionMetrics() {}, ensureTenantFloatingActionPosition() {},
      scheduleRelatedViewportMeasure() {}, refreshRelatedChildLists() {},
      initializeGroupExpansion() {}, initializeFormTabs() {},
      tenantFieldPresentation: () => ({}),
      getOpenerEventChannel: () => ({ emit: (name, data) => events[name]?.(data) })
    }
    stack.push(page)
    component.onLoad.call(page, { table: 'Cases', id: 'row-1', mode: 'View', ...query })
    return page
  }
  async function runTimers() {
    for (const [id, callback] of [...timers]) { timers.delete(id); callback() }
    await tick()
  }
  return { calls, rows, stack, uni, createPage, component, timers, runTimers }
}

for (const action of ['cancel', 'system-back']) {
  test(`详情进入编辑后 ${action} 回到同一详情，丢弃未保存字段并保留详情 Tab`, async () => {
    const app = setup()
    const detail = app.createPage()
    await tick()
    detail.activeFormTabKey = '原详情Tab'
    const reads = app.calls.reads.length
    await detail.switchToEdit()
    await tick()
    assert.equal(app.stack.length, 3)
    const edit = app.stack.at(-1)
    assert.equal(detail.mode, 'View')
    assert.equal(edit.mode, 'Edit')
    edit.form.Title = '未保存'
    edit.form.Nested.value = '未保存的嵌套值'
    if (action === 'cancel') edit.goBack()
    else app.uni.navigateBack()
    await tick()
    assert.equal(app.stack.at(-1), detail)
    assert.equal(detail.form.Title, '原始标题')
    assert.equal(detail.form.Nested.value, '原值')
    assert.equal(detail.activeFormTabKey, '原详情Tab')
    assert.equal(app.calls.reads.length, reads + 1, '取消不应重新加载详情或重置详情状态')
    assert.equal(app.calls.saves.length, 0)
    detail.goBack()
    assert.equal(app.stack.at(-1).source, 'list')
  })
}

test('保存成功回到详情并回读服务端结果，仍发送原有列表刷新事件', async () => {
  const app = setup()
  const detail = app.createPage()
  await tick()
  await detail.switchToEdit()
  await tick()
  const edit = app.stack.at(-1)
  edit.form.Title = '新标题'
  await edit.submit()
  await app.runTimers()
  assert.equal(app.stack.at(-1), detail)
  assert.equal(detail.mode, 'View')
  assert.equal(detail.form.Title, '新标题（已保存）')
  assert.equal(app.calls.reads.at(-1).refresh, true)
  assert.equal(app.calls.events[0].name, 'microi:data-changed')
  assert.equal(app.calls.events[0].event.id, 'row-1')
  assert.equal(app.calls.saves.length, 1)
})

test('编辑保留授权菜单、上传菜单、字段范围、关联表及适配器参数，中文和特殊字符正确往返', async () => {
  const app = setup()
  const encode = value => encodeURIComponent(JSON.stringify(value))
  const detail = app.createPage({
    table: encodeURIComponent('Cases & 测试'), menuId: 'menu-1', fileMenuId: 'file-menu',
    title: encodeURIComponent('客户详情 & 100%'), fields: encode(['Title', '中文字段']),
    excludeFields: encode(['Hidden']), readonlyFields: encode(['Owner']),
    related: '0', stayAfterAdd: '1', defaults: encode({ ParentName: '中文 & + ? %' }),
    recordAdapter: 'api-engine', moduleEngineKey: 'case-module', draftRelation: 'draft-1',
    tableChildAuth: encode({ ParentRowId: 'parent-1', ParentSysMenuId: 'parent-menu', ParentFieldId: 'child-1' })
  })
  await tick()
  await detail.switchToEdit()
  await tick()
  const edit = app.stack.at(-1)
  assert.notEqual(edit, detail)
  for (const key of ['tableName', 'menuId', 'fileMenuId', 'rowId', 'title', 'showRelated', 'stayAfterAdd',
    'includeNames', 'excludeNames', 'readonlyNames', 'defaultValues', 'recordAdapter', 'moduleEngineKey', 'draftRelation', 'tableChildAuth']) {
    assert.deepEqual(clone(edit[key]), clone(detail[key]), key)
  }
  await edit.submit()
  assert.equal(app.calls.saves[0].menuId, 'menu-1')
  assert.equal(app.calls.saves[0].tableChildAuth.ParentSysMenuId, 'parent-menu')
  assert.equal(app.calls.events[0].event.parentRowId, 'parent-1')
  assert.equal(app.calls.events[0].event.draftRelation, 'draft-1')
})

for (const mode of ['Add', 'Edit']) {
  for (const action of ['cancel', 'save']) {
    test(`直接进入 ${mode} 后 ${action} 仍返回来源列表`, async () => {
      const app = setup()
      const page = app.createPage({ mode, id: mode === 'Add' ? '' : 'row-1' })
      await tick()
      if (action === 'save') { page.form.Title = '直接保存'; await page.submit(); await app.runTimers() }
      else page.goBack()
      assert.equal(app.stack.length, 1)
      assert.equal(app.stack.at(-1).source, 'list')
      assert.equal(app.calls.saves.length, action === 'save' ? 1 : 0)
    })
  }
}

test('新增后继续维护子表的 stayAfterAdd 行为保留', async () => {
  const app = setup()
  const page = app.createPage({ mode: 'Add', id: '', stayAfterAdd: '1' })
  await tick()
  page.hasRelatedFields = true
  await page.submit()
  await app.runTimers()
  assert.equal(app.stack.at(-1), page)
  assert.equal(page.mode, 'Edit')
  assert.equal(page.rowId, 'added-row')
  assert.equal(app.calls.reads.at(-1).refresh, true)
})

test('无编辑权限不跳转；重复点击和导航失败不替换或丢失详情', async () => {
  const app = setup()
  const detail = app.createPage()
  await tick()
  detail.canEditRecord = false
  await detail.switchToEdit()
  assert.equal(app.calls.navigation.length, 0)
  assert.match(app.calls.toasts.at(-1).title, /没有编辑权限/)
  detail.canEditRecord = true
  app.uni.navigationFailure = true
  await detail.switchToEdit()
  assert.equal(app.stack.at(-1), detail)
  assert.equal(detail.mode, 'View')
  assert.match(app.calls.toasts.at(-1).title, /失败|页面栈/)
  app.uni.navigationFailure = false
  app.uni.deferNavigation = true
  await detail.switchToEdit()
  await detail.switchToEdit()
  assert.equal(app.calls.navigation.length, 2, '失败后的重试只允许打开一次')
})

test('保存失败停留编辑；取消仍返回未改动的详情', async () => {
  const app = setup({ saveNativeFormRecord: async () => { throw new Error('保存拒绝') } })
  const detail = app.createPage()
  await tick()
  await detail.switchToEdit()
  await tick()
  const edit = app.stack.at(-1)
  edit.form.Title = '失败的修改'
  await edit.submit()
  await app.runTimers()
  assert.equal(app.stack.at(-1), edit)
  assert.equal(app.calls.events.length, 0)
  assert.match(app.calls.toasts.at(-1).title, /保存拒绝/)
  edit.goBack()
  await tick()
  assert.equal(app.stack.at(-1), detail)
  assert.equal(detail.form.Title, '原始标题')
})

test('主表已保存但子表提交失败时，取消返回的详情也应回读已落库主表', async () => {
  const app = setup({ flushChildDrafts: async () => { throw new Error('子表失败') } })
  const detail = app.createPage()
  await tick()
  await detail.switchToEdit()
  await tick()
  const edit = app.stack.at(-1)
  edit.form.Title = '主表成功'
  await edit.submit()
  assert.match(app.calls.toasts.at(-1).title, /主表已保存/)
  edit.goBack()
  await tick()
  assert.equal(app.stack.at(-1), detail)
  assert.equal(detail.form.Title, '主表成功（已保存）')
})

test('保存后的延迟返回不会在用户提前返回时再次弹出详情，也不会重复保存', async () => {
  const app = setup()
  const detail = app.createPage()
  await tick()
  await detail.switchToEdit()
  await tick()
  const edit = app.stack.at(-1)
  await edit.submit()
  await edit.submit()
  assert.equal(app.calls.saves.length, 1)
  edit.goBack()
  await app.runTimers()
  assert.equal(app.stack.at(-1), detail)
  assert.equal(app.stack.length, 2)
})

test('取消、顶部返回仍绑定同一个返回方法；无上一页仍使用工作台兜底', () => {
  assert.match(source, /@back="goBack"/)
  assert.match(source, /@tap="goBack"><text>取消<\/text>/)
  const app = setup()
  app.component.methods.goBack.call({ saveReturnTimer: null })
  assert.equal(app.calls.tabs[0].url, '/pages/workspace/index')
})

test('详情刷新失败停留详情显示错误，重新加载后恢复；不会跳回列表', async () => {
  let failRead = false
  const app = setup({ loadNativeFormRecord: async () => {
    if (failRead) throw new Error('详情网络不可用')
    return { Code: 1, Data: { Id: 'row-1', Title: '回读标题' } }
  } })
  const detail = app.createPage()
  await tick()
  await detail.switchToEdit()
  await tick()
  await app.stack.at(-1).submit()
  failRead = true
  await app.runTimers()
  assert.equal(app.stack.at(-1), detail)
  assert.equal(detail.mode, 'View')
  assert.equal(detail.error, '详情网络不可用')
  assert.equal(detail.loading, false)
  failRead = false
  await detail.loadForm(true)
  assert.equal(detail.error, '')
  assert.equal(detail.form.Title, '回读标题')
})

test('系统返回同样清理保存计时器，不会延迟退出来源详情', async () => {
  const app = setup()
  const detail = app.createPage()
  await tick()
  await detail.switchToEdit()
  await tick()
  await app.stack.at(-1).submit()
  app.uni.navigateBack()
  await app.runTimers()
  assert.equal(app.stack.at(-1), detail)
  assert.equal(app.timers.size, 0)
})

test('保存后的租户钩子等待期间卸载编辑页，迟到完成不能再次返回', async () => {
  let finishHook
  const app = setup({ notifyTenantFormSaved: () => new Promise(resolve => { finishHook = resolve }) })
  const detail = app.createPage()
  await tick()
  await detail.switchToEdit()
  await tick()
  const saving = app.stack.at(-1).submit()
  await tick()
  app.uni.navigateBack()
  finishHook()
  await saving
  await app.runTimers()
  assert.equal(app.stack.at(-1), detail)
  assert.equal(app.timers.size, 0)
})

test('没有记录、正在加载或已经处于编辑时，不额外打开编辑页', async () => {
  for (const values of [{ rowId: '' }, { loading: true }, { mode: 'Edit' }]) {
    const app = setup()
    const page = app.createPage()
    await tick()
    Object.assign(page, values)
    await page.switchToEdit()
    assert.equal(app.calls.navigation.length, 0)
  }
})

test('用户先返回详情后保存响应才到达，详情立即回读且不再退出', async () => {
  let completeSave
  let storedTitle = '原始标题'
  const app = setup({
    saveNativeFormRecord: () => new Promise(resolve => {
      completeSave = () => { storedTitle = '迟到的保存'; resolve({ Code: 1, Data: { Id: 'row-1', Title: storedTitle } }) }
    }),
    loadNativeFormRecord: async () => ({ Code: 1, Data: { Id: 'row-1', Title: storedTitle } })
  })
  const detail = app.createPage()
  await tick()
  await detail.switchToEdit()
  await tick()
  const saving = app.stack.at(-1).submit()
  await tick()
  app.uni.navigateBack()
  completeSave()
  await saving
  await app.runTimers()
  assert.equal(app.stack.at(-1), detail)
  assert.equal(detail.form.Title, '迟到的保存')
  assert.equal(app.timers.size, 0)
})
