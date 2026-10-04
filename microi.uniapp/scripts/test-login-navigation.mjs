import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import {
  buildLoginReturnPlan, createLoginNavigationGuard, decodeLoginRedirect, executeLoginReturnPlan,
  initializeAuthenticatedPage, installLoginNavigationInterceptors, isLoginPageLocation, normalizeLoginRedirect,
  pageLocation, parsePageLocation, shouldResumePreviousPage
} from '../src/platform/login-navigation.mjs'

test('解析登录重定向页面及查询参数', () => {
  assert.deepEqual(parsePageLocation('/pages/business/detail?key=customers&id=a%2Fb'), {
    route: 'pages/business/detail',
    options: { key: 'customers', id: 'a/b' }
  })
})

const HOME = { route: 'pages/workspace/index', options: {} }
const DETAIL = { route: 'pages/business/detail', options: { key: 'customers', id: 'customer-1' } }
const LOGIN = { route: 'pages/login/index', options: {} }
const DETAIL_URL = pageLocation(DETAIL)

function navigationHarness(initialPages = [HOME, DETAIL]) {
  const pages = [...initialPages]
  const interceptors = {}
  const requests = []
  let loggedIn = false
  const guard = createLoginNavigationGuard({ getPages: () => pages, hasSession: () => loggedIn })
  const runtime = { addInterceptor: (method, interceptor) => { interceptors[method] = interceptor } }
  for (const method of ['navigateTo', 'redirectTo', 'reLaunch']) {
    runtime[method] = (options) => {
      if (interceptors[method]?.invoke(options) === false) return
      requests.push({ method, options })
    }
  }
  installLoginNavigationInterceptors(runtime, guard)
  return { pages, requests, runtime, guard, setLoggedIn: value => { loggedIn = value } }
}

test('首启并发鉴权/分享/业务入口在页面尚未到达时只发起一次登录导航', () => {
  const { runtime, requests } = navigationHarness()
  for (let index = 0; index < 12; index += 1) {
    runtime[['navigateTo', 'redirectTo', 'reLaunch'][index % 3]]({ url: '/pages/login/index' })
  }
  assert.equal(requests.length, 1)
  assert.equal(parsePageLocation(requests[0].options.url).options.redirect, DETAIL_URL)
})

test('导航失败释放锁，保留调用方失败回调，下一次登录允许重试', () => {
  const { runtime, requests } = navigationHarness()
  let failureCount = 0
  runtime.navigateTo({ url: '/pages/login/index', fail: () => { failureCount += 1 } })
  requests[0].options.fail({ errMsg: 'navigateTo:fail page stack is full' })
  runtime.redirectTo({ url: '/pages/login/index' })
  assert.equal(failureCount, 1)
  assert.equal(requests.length, 2)
})

test('登录页 onLoad 释放等待锁，但栈中已有登录页时拒绝追加', () => {
  const { runtime, requests, pages, guard } = navigationHarness()
  runtime.navigateTo({ url: '/pages/login/index' })
  pages.push(LOGIN)
  guard.pageOpened()
  runtime.navigateTo({ url: '/pages/login/index' })
  pages.push({ route: 'pages/privacy/index' })
  runtime.navigateTo({ url: '/pages/login/index' })
  assert.equal(requests.length, 1)
})

test('登录成功返回后，未来一次真正的失效仍可以重新登录', () => {
  const { runtime, requests, pages, guard, setLoggedIn } = navigationHarness()
  runtime.navigateTo({ url: '/pages/login/index' })
  pages.push(LOGIN)
  guard.pageOpened()
  pages.pop()
  setLoggedIn(true)
  runtime.navigateTo({ url: '/pages/login/index' })
  assert.equal(requests.length, 1)
  setLoggedIn(false)
  runtime.navigateTo({ url: '/pages/login/index' })
  assert.equal(requests.length, 2)
})

test('迟到登录引导不打断新会话，但显式退出链接仍可以打开', () => {
  const { runtime, requests, setLoggedIn } = navigationHarness()
  setLoggedIn(true)
  runtime.navigateTo({ url: '/pages/login/index' })
  runtime.navigateTo({ url: '/pages/login/index?logout=1' })
  assert.equal(requests.length, 1)
  assert.equal(parsePageLocation(requests[0].options.url).options.logout, '1')
})

test('登录专属拦截器不阻断普通业务导航且不会重复注册', () => {
  const { runtime, requests, guard } = navigationHarness()
  assert.equal(installLoginNavigationInterceptors(runtime, guard), false)
  runtime.navigateTo({ url: '/pages/business/list?key=customers' })
  runtime.navigateTo({ url: '/pages/mall/detail?id=product-1' })
  assert.equal(requests.length, 2)
})

test('真实分享守卫被去重取消且无 complete 后，下一次仍可发起登录', () => {
  const sharedPage = { ...DETAIL, options: { ...DETAIL.options, fromShare: '1' } }
  const harness = navigationHarness([HOME, sharedPage])
  // 模拟鉴权入口先抢到导航锁。UniApp invoke(false) 会直接终止，不调用任何完成回调。
  harness.runtime.navigateTo({ url: '/pages/login/index' })
  const source = readFileSync(new URL('../src/utils/share.js', import.meta.url), 'utf8')
  const start = source.indexOf('export function maybeRedirectSharedReceiver()')
  const end = source.indexOf('let followPromptShown', start)
  const shareGuard = vm.runInNewContext(`(${source.slice(start, end).trim().replace(/^export function/, 'function')})`, {
    getCurrentPages: () => harness.pages, getUser: () => ({}), getToken: () => '',
    SHARE_WITHOUT_LOGIN: new Set(), buildFriendShare: () => ({ path: pageLocation(sharedPage) }),
    uni: harness.runtime, sharedAuthRedirecting: false
  })
  shareGuard()
  assert.equal(harness.requests.length, 1)
  // 第一次真正导航失败，解除共享锁；被取消的分享入口不能永久卡住自己的状态。
  harness.requests[0].options.fail({ errMsg: 'navigateTo:fail' })
  shareGuard()
  assert.equal(harness.requests.length, 2)
  assert.equal(parsePageLocation(harness.requests[1].options.url).options.redirect, pageLocation(sharedPage))
})

test('单个正常登录页返回原实例，不复制详情或丢失查询状态', () => {
  assert.deepEqual(buildLoginReturnPlan([HOME, DETAIL, LOGIN], DETAIL_URL), {
    method: 'navigateBack', delta: 1, url: DETAIL_URL
  })
})

test('历史连续 N 个登录页一次退回业务实例并全部移出栈', () => {
  assert.deepEqual(buildLoginReturnPlan([HOME, DETAIL, LOGIN, LOGIN, LOGIN], DETAIL_URL), {
    method: 'navigateBack', delta: 3, url: DETAIL_URL
  })
})

test('历史登录页夹在业务页面之间时重新进入目标并清栈', () => {
  assert.deepEqual(buildLoginReturnPlan([HOME, LOGIN, DETAIL, LOGIN], DETAIL_URL), {
    method: 'reLaunch', url: DETAIL_URL
  })
})

test('分享冷启动创建带参数业务目标，直接登录页回首页', () => {
  assert.deepEqual(buildLoginReturnPlan([LOGIN], DETAIL_URL), { method: 'reLaunch', url: DETAIL_URL })
  assert.deepEqual(buildLoginReturnPlan([LOGIN]), { method: 'reLaunch', url: '/pages/workspace/index' })
})

test('登录成功和取消均可跳过连续登录页，默认返回最近业务页', () => {
  assert.deepEqual(buildLoginReturnPlan([HOME, DETAIL, LOGIN, LOGIN]), {
    method: 'navigateBack', delta: 2, url: DETAIL_URL
  })
})

test('返回目标不能递归打开登录或跳到外部地址', () => {
  for (const url of ['/pages/login/index?redirect=%2Fpages%2Flogin%2Findex', 'https://example.test/pages/home', '//example.test/pages/home']) {
    assert.equal(normalizeLoginRedirect(url), '')
    assert.deepEqual(buildLoginReturnPlan([LOGIN], url), { method: 'reLaunch', url: '/pages/workspace/index' })
  }
  assert.equal(normalizeLoginRedirect('/pages/business/list?keyword=%E5%BC%A0%E4%B8%89'), '/pages/business/list?keyword=%E5%BC%A0%E4%B8%89')
})

test('只解码 redirect 外层，保留业务参数中的转义分隔符和中文', () => {
  const target = '/pages/business/detail?key=customers&id=a%26b%2Fc&name=%E5%BC%A0%E4%B8%89'
  assert.equal(decodeLoginRedirect(target), target)
  assert.equal(decodeLoginRedirect(encodeURIComponent(target)), target)
  assert.equal(decodeLoginRedirect(encodeURIComponent(encodeURIComponent(target))), target)
  assert.equal(decodeLoginRedirect('%ZZ'), '')
})

test('恢复原实例失败时清栈进入目标，再失败可退回首页', () => {
  const calls = []
  executeLoginReturnPlan({
    navigateBack: options => { calls.push(['back', options.delta]); options.fail() },
    reLaunch: options => { calls.push(['launch', options.url]); options.fail() },
    switchTab: options => calls.push(['tab', options.url])
  }, { method: 'navigateBack', delta: 3, url: DETAIL_URL })
  assert.deepEqual(calls, [['back', 3], ['launch', DETAIL_URL], ['tab', '/pages/workspace/index']])
})

test('所有返回路径失败时通知当前登录页解除按钮等待状态', () => {
  let failureCount = 0
  executeLoginReturnPlan({
    reLaunch: options => options.fail(),
    switchTab: options => options.fail()
  }, { method: 'reLaunch', url: DETAIL_URL }, '/pages/workspace/index', () => { failureCount += 1 })
  assert.equal(failureCount, 1)
})

function loginPageHarness(initialPages, redirectUrl = DETAIL_URL) {
  const source = readFileSync(new URL('../src/pages/login/index.vue', import.meta.url), 'utf8')
  const pageObject = source.slice(source.indexOf('export default ') + 'export default '.length, source.indexOf('</script>')).trim()
  const pages = [...initialPages]
  const timers = new Map()
  const navigation = []
  let sessionValid = true
  let nextTimer = 0
  const page = vm.runInNewContext(`(${pageObject})`, {
    themeMixin: {}, appConfig: {}, isValidLoginSession: (user, token) => !!(user?.Id && token),
    getUser: () => sessionValid ? { Id: 'user-1' } : {}, getToken: () => sessionValid ? 'session-1' : '',
    getCurrentPages: () => pages, buildLoginReturnPlan, executeLoginReturnPlan, isLoginPageLocation,
    setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer },
    clearTimeout: id => timers.delete(id),
    uni: {
      navigateBack: options => { navigation.push('back'); pages.splice(-options.delta) },
      reLaunch: options => { navigation.push('launch'); pages.splice(0, pages.length, parsePageLocation(options.url)) },
      switchTab: options => { navigation.push('tab'); pages.splice(0, pages.length, parsePageLocation(options.url)) }
    }
  })
  const state = { ...page.methods, redirectUrl, runtimeEndpointChanged: false, loginReturnPending: false }
  return { page, state, pages, timers, navigation, setSessionValid: value => { sessionValid = value },
    flush: () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback()) } }
}

test('执行真实登录页成功方法：历史 N 层登录栈一次清除，没有详情副本', () => {
  const harness = loginPageHarness([HOME, DETAIL, LOGIN, LOGIN, LOGIN])
  harness.state.navigateAfterLogin()
  harness.flush()
  assert.deepEqual(harness.pages, [HOME, DETAIL])
  assert.deepEqual(harness.navigation, ['back'])
})

test('执行真实登录页：重复成功回调只有一个返回任务，页面销毁取消待执行导航', () => {
  const harness = loginPageHarness([HOME, DETAIL, LOGIN])
  harness.state.navigateAfterLogin()
  harness.state.navigateAfterLogin()
  assert.equal(harness.timers.size, 1)
  harness.page.onUnload.call(harness.state)
  harness.flush()
  assert.equal(harness.navigation.length, 0)
})

test('执行真实登录页：提示期间会话失效后留在登录页', () => {
  const harness = loginPageHarness([HOME, DETAIL, LOGIN])
  harness.state.navigateAfterLogin()
  harness.setSessionValid(false)
  harness.flush()
  assert.equal(harness.navigation.length, 0)
  assert.equal(harness.state.loginReturnPending, false)
})

test('执行真实登录页：用户已离开时旧成功任务不再修改新栈', () => {
  const harness = loginPageHarness([HOME, DETAIL, LOGIN])
  harness.state.navigateAfterLogin()
  harness.pages.push({ route: 'pages/privacy/index' })
  harness.flush()
  assert.equal(harness.navigation.length, 0)
})

test('执行真实登录页：取消等待后一次返回业务页，旧定时器不再执行', () => {
  const harness = loginPageHarness([HOME, DETAIL, LOGIN, LOGIN])
  harness.state.navigateAfterLogin()
  harness.state.goBack()
  harness.flush()
  assert.deepEqual(harness.pages, [HOME, DETAIL])
  assert.deepEqual(harness.navigation, ['back'])
})

test('登录前页面仍在栈中时恢复原页面实例', () => {
  const previous = {
    route: 'pages/business/detail',
    options: { key: 'customers', id: 'customer-1' }
  }
  assert.equal(
    shouldResumePreviousPage(previous, '/pages/business/detail?key=customers&id=customer-1'),
    true
  )
  assert.equal(
    shouldResumePreviousPage(previous, '/pages/business/detail?key=customers&id=customer-2'),
    false
  )
  assert.equal(
    shouldResumePreviousPage(previous, '/pages/business/list?key=customers'),
    false
  )
})

test('业务页 onLoad/onShow 并发只初始化一次，未登录时等待返回', async () => {
  let loggedIn = false
  let initializeCount = 0
  let finish
  const page = { authInitialized: false, authInitializing: false }
  const initialize = () => { initializeCount += 1; return new Promise(resolve => { finish = resolve }) }
  const start = () => initializeAuthenticatedPage(page, () => loggedIn, initialize)
  assert.equal(await start(), false)
  assert.equal(initializeCount, 0)
  loggedIn = true
  const first = start()
  assert.equal(await start(), false)
  assert.equal(initializeCount, 1)
  finish()
  assert.equal(await first, true)
  assert.equal(await start(), false)
  assert.equal(initializeCount, 1)
})

test('初始化期间原会话失效，登录返回可以重新取业务数据', async () => {
  let loggedIn = true
  let initializeCount = 0
  const page = { authInitialized: false, authInitializing: false }
  const initialize = async () => { initializeCount += 1; loggedIn = false }
  assert.equal(await initializeAuthenticatedPage(page, () => loggedIn, initialize), false)
  assert.equal(page.authInitialized, false)
  loggedIn = true
  assert.equal(await initializeAuthenticatedPage(page, () => loggedIn, async () => { initializeCount += 1 }), true)
  assert.equal(initializeCount, 2)
})

test('初始化抛错会释放并发锁，下一次进入仍能重试', async () => {
  const page = { authInitialized: false, authInitializing: false }
  await assert.rejects(initializeAuthenticatedPage(page, () => true, async () => { throw new Error('request failed') }), /request failed/)
  assert.equal(page.authInitializing, false)
  assert.equal(page.authInitialized, false)
  assert.equal(await initializeAuthenticatedPage(page, () => true, async () => {}), true)
})

const AUTHENTICATED_NATIVE_PAGES = [
  { file: 'casebook', load: 'initialize', options: { id: 'book-1' }, expected: { bookId: 'book-1' } },
  { file: 'service-record', load: 'initialize', options: { id: 'record-1', mode: 'view', customerId: 'customer-1' }, expected: { recordId: 'record-1', readOnly: true, initialCustomerId: 'customer-1' } },
  { file: 'repair', load: 'loadData', options: { deviceId: 'device%2F1' }, expected: { deviceId: 'device/1', directRepair: false } },
  { file: 'task-follow-up', load: 'loadTask', options: { id: 'task%2F1' }, expected: { id: 'task/1' } },
  { file: 'task-feedback', load: 'loadData', options: { taskId: 'task%2F1', taskNo: 'DD001', customer: '%E5%AE%A2%E6%88%B7', taskType: '%E7%BB%B4%E4%BF%AE' }, expected: { taskId: 'task/1', taskNo: 'DD001', customer: '客户', taskType: '维修' } },
  { file: 'customer-share', load: 'loadData', options: { customerId: 'customer%2F1' }, expected: { customerId: 'customer/1' } },
  { file: 'member-edit', load: 'loadRoles', options: {}, expected: {} }
]

for (const fixture of AUTHENTICATED_NATIVE_PAGES) {
  test(`执行真实 ${fixture.file} 页：登录前保留参数，返回后恢复且只初始化一次`, async () => {
    const source = readFileSync(new URL(`../src/pages/native/${fixture.file}.vue`, import.meta.url), 'utf8')
    const script = source.slice(source.indexOf('export default') + 'export default'.length, source.indexOf('</script>'))
    let loggedIn = false
    const currentUser = { Id: 'session-user', TenantId: 'tenant-1' }
    const page = vm.runInNewContext(`(${script.trim()})`, {
      themeMixin: {}, initializeAuthenticatedPage, requireLogin: () => loggedIn,
      getUser: () => currentUser, decodeURIComponent
    })
    const state = { authInitialized: false, authInitializing: false, loading: true, canEdit: true }
    for (const [name, method] of Object.entries(page.methods)) state[name] = method.bind(state)
    let loadCount = 0
    let finish
    state[fixture.load] = async () => { loadCount += 1; await new Promise(resolve => { finish = resolve }); state.loading = false }
    state.loadBook = async () => {}
    state.loadChildren = async () => {}
    state.loadDevices = async () => {}

    await page.onLoad.call(state, fixture.options)
    await page.onShow.call(state)
    for (const [key, value] of Object.entries(fixture.expected)) assert.equal(state[key], value)
    assert.equal(loadCount, 0)
    assert.equal(state.loading, true)

    loggedIn = true
    const returnToPage = page.onShow.call(state)
    await page.onShow.call(state)
    assert.equal(loadCount, 1)
    finish()
    await returnToPage
    assert.equal(state.loading, false)
    assert.equal(state.authInitialized, true)
    await page.onShow.call(state)
    assert.equal(loadCount, 1)
    if (fixture.file === 'casebook' || fixture.file === 'member-edit') assert.equal(state.currentUser, currentUser)
  })
}
