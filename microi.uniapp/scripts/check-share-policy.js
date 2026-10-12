const fs = require('fs')
const path = require('path')
const vm = require('vm')

const root = path.resolve(__dirname, '..')
const pagesJson = JSON.parse(fs.readFileSync(path.join(root, 'src/pages.json'), 'utf8'))
const routes = [
  ...pagesJson.pages.map((page) => page.path),
  ...pagesJson.subPackages.flatMap((pkg) => pkg.pages.map((page) => `${pkg.root}/${page.path}`))
]
for (const page of [...pagesJson.pages, ...pagesJson.subPackages.flatMap((pkg) => pkg.pages)]) {
  assert(page.style && /^#[0-9a-f]{6}$/i.test(page.style.backgroundColor || ''), `Missing explicit page background: ${page.path}`)
}
const shareSource = fs.readFileSync(path.join(root, 'src/utils/share.js'), 'utf8')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

// 回归旧故障：全局 mixin 的分享回调没有进入微信页面 JS，因此逐页核对显式生命周期。
for (const route of routes) {
  const source = fs.readFileSync(path.join(root, `src/${route}.vue`), 'utf8')
  assert(source.includes('onShareAppMessage('), `Missing friend-share hook: ${route}`)
  assert(source.includes('onShareTimeline('), `Missing timeline hook: ${route}`)
  assert(source.includes(`buildTimelineShare(this, '${route}')`), `Timeline must target the current page: ${route}`)
  if (route !== 'pages/profile/index') {
    assert(source.includes(`buildFriendShare(this, '${route}')`), `Friend share must target the current page: ${route}`)
  }
  const policyLine = shareSource.split('\n').find((line) => line.includes(`'${route}':`))
  assert(policyLine, `Missing route policy: ${route}`)
  assert(
    policyLine.includes(`sharePath: '/${route}'`) || (route === 'pages/workspace/index' && policyLine.includes('sharePath: HOME_PATH')),
    `Policy must preserve the current route: ${route}`
  )
}

assert(
  fs.readFileSync(path.join(root, 'src/pages/profile/index.vue'), 'utf8').includes("event && event.from === 'button'"),
  'Profile invitation must be limited to its explicit share buttons'
)
assert(!shareSource.includes('maybePromptFollow') && !shareSource.includes('欢迎查看分享内容'), 'Opening a shared page must not show an automatic follow prompt')
assert(shareSource.includes('wx.openOfficialAccountProfile'), 'Follow action must support the direct official-account profile API when configured')
assert(!shareSource.includes('fail: () => { uni.navigateTo({ url: OFFICIAL_ACCOUNT_PATH }) }'), 'Follow action must not silently fall back to an unsupported component page')
const workspacePage = fs.readFileSync(path.join(root, 'src/pages/workspace/index.vue'), 'utf8')
// 首页关注栏暂时隐藏，保留注释代码便于恢复；专用关注页仍单独验证。
assert(/<!--\s*<official-account\b[^>]*\/>\s*-->/.test(workspacePage), '首页必须保留已注释的公众号关注组件')
const workspaceTemplate = workspacePage.slice(0, workspacePage.indexOf('<script')).replace(/<!--[\s\S]*?-->/g, '')
assert(!/<official-account\b/.test(workspaceTemplate), '首页模板不得渲染公众号关注栏')
const officialAccountPage = fs.readFileSync(path.join(root, 'src/pages/native/official-account.vue'), 'utf8')
assert(officialAccountPage.includes('@tap="openProfile"'), 'Official-account page must expose a direct follow button')
assert(officialAccountPage.includes('openOfficialAccountProfile'), 'Official-account page must use the direct profile API')
const relatedListPage = fs.readFileSync(path.join(root, 'src/pages/business/related-list.vue'), 'utf8')
assert(relatedListPage.includes('for (let index = 0; index < 3; index += 1)'), 'Related-list titles must tolerate repeated URL encoding')

const xjyProfile = require('./lib/profile-manager.cjs').loadProfile('xjy')
assert(!Object.prototype.hasOwnProperty.call(xjyProfile.config, 'officialAccountUsername'), 'The official-account ID must not be hardcoded in the xjy profile')
assert(xjyProfile.config.shareOfficialAccountApiEngineKey === 'xjy-share-official-account', 'Xjy must use its tenant-scoped backend account projection')
assert(!fs.readFileSync(path.join(root, 'src/generated/active-profile.js'), 'utf8').includes('officialAccountUsername'), 'Generated config must not embed the official-account ID')
for (const key of ['platform', 'business', 'service', 'mall', 'news', 'invite']) {
  const cover = xjyProfile.config?.cdnAssets?.share?.[key] || ''
  assert(cover.startsWith('https://static.jifulii.com/xjy/miniapp/share/'), `Missing private-safe cover: ${key}`)
}

let currentPage = null
const modals = []
const navigations = []
const officialAccountCalls = []
const postCalls = []
const executable = shareSource
  .replace("import appConfig from '@/config.js'", "const appConfig = { appName: '集福鲤', platformName: '集福鲤平台', workspaceSubTitle: '业务协同中心', shareOfficialAccountApiEngineKey: 'xjy-share-official-account', cdnAssets: { share: { platform: 'platform.jpg', business: 'business.jpg', service: 'service.jpg', news: 'news.jpg' } } }")
  .replace("import { getToken, getUser, post } from '@/utils/request.js'", "function getToken() { return globalThis.testToken }; function getUser() { return globalThis.testUser }; function post(url, data, auth) { globalThis.postCalls.push({ url, data, auth }); return Promise.resolve(globalThis.testBackend) }")
  .replace(/\bexport default\s*\{/, 'const shareMixin = {')
  .replace(/\bexport (const|function)\b/g, '$1')
const sandbox = {
  getCurrentPages: () => currentPage ? [currentPage] : [],
  uni: {
    showShareMenu() {},
    showModal(options) { modals.push(options) },
    navigateTo(options) { navigations.push(options.url); if (options.complete) options.complete() }
  },
  wx: {
    login(options) { options.success({ code: 'wx-test-login-code' }) },
    openOfficialAccountProfile(options) { officialAccountCalls.push(options) }
  },
  testToken: '',
  testUser: {},
  postCalls,
  testBackend: { Code: 1, Data: { Username: 'gh_1234567890', FollowStatus: 'followed' } },
  globalThis: null
}
sandbox.globalThis = sandbox
vm.runInNewContext(`${executable}\nglobalThis.shareTest = { buildFriendShare, buildTimelineShare, getOfficialAccountUsername, warmOfficialAccountConfig, openOfficialAccountProfile, maybeRedirectSharedReceiver, shareMixin };`, sandbox)

function verify(route, options, expectedQuery) {
  currentPage = { route, options }
  const friend = sandbox.shareTest.buildFriendShare(null, route)
  const timeline = sandbox.shareTest.buildTimelineShare(null, route)
  assert(friend.path === `/${route}?${expectedQuery}`, `Incorrect current-page path: ${route} -> ${friend.path}`)
  assert(timeline.query === expectedQuery, `Incorrect timeline query: ${route} -> ${timeline.query}`)
  assert(!Object.prototype.hasOwnProperty.call(friend, 'imageUrl'), `Page share must use the current-page screenshot: ${route}`)
  assert(!Object.prototype.hasOwnProperty.call(timeline, 'imageUrl'), `Timeline share must use the current-page screenshot: ${route}`)
  assert(!friend.path.includes('Authorization') && !friend.path.includes('secret'), `Leaked sensitive parameter: ${route}`)
}

verify('pages/news/detail', { id: 'news 1', Authorization: 'secret' }, 'id=news%201&fromShare=1')
verify('pages/business/detail', { key: 'customers', id: 'customer 1', menuId: 'menu/1', Authorization: 'secret' }, 'key=customers&id=customer%201&menuId=menu%2F1&fromShare=1')
verify('pages/native-form/index', { table: 'Diy_Order', id: 'row-1', mode: 'Edit', defaults: '{"secret":"x"}' }, 'table=Diy_Order&id=row-1&mode=View&fromShare=1')
verify('pages/native-form/index', { table: 'Diy_Order', mode: 'Add' }, 'table=Diy_Order&mode=Add&fromShare=1')
verify('pages/native-form/index', { table: 'Diy_Order', id: 'row-1', title: '%E8%B7%9F%E8%BF%9B%E8%AE%B0%E5%BD%95' }, 'table=Diy_Order&id=row-1&title=%E8%B7%9F%E8%BF%9B%E8%AE%B0%E5%BD%95&mode=View&fromShare=1')
verify('pages/native/service-record', { id: 'record-1', mode: 'edit', customerId: 'customer-1' }, 'id=record-1&customerId=customer-1&mode=view&fromShare=1')
verify('pages/complaint/detail', { id: 'case-1', public: '0', AccessToken: 'secret' }, 'id=case-1&public=0&fromShare=1')
verify('pages/message/chat', { id: 'chat-1', name: 'Private User', type: 'private' }, 'id=chat-1&type=private&fromShare=1')
verify('pages/message/index', {}, 'fromShare=1')

async function verifySharedReceiverFlow() {
currentPage = { route: 'pages/news/detail', options: { id: 'news-1', fromShare: '1' } }
sandbox.shareTest.shareMixin.onShow()
assert(modals.length === 0 && postCalls.length === 0, 'Opening a public shared page must not prompt or check follow status')
const navigationCountAfterFollow = navigations.length

sandbox.shareTest.maybeRedirectSharedReceiver()
assert(navigations.length === navigationCountAfterFollow, 'Public shared pages must remain accessible without login')
currentPage = { route: 'pages/business/detail', options: { key: 'customers', id: 'customer-1', fromShare: '1' } }
sandbox.shareTest.maybeRedirectSharedReceiver()
assert(navigations.length === navigationCountAfterFollow + 1, 'Private shared pages must route a guest to login')
assert(decodeURIComponent(navigations[navigationCountAfterFollow]).includes('/pages/business/detail?key=customers&id=customer-1&fromShare=1'), 'Login must retain the original shared route')
sandbox.testToken = 'valid-token'
sandbox.testUser = { Id: 'user-1' }
sandbox.shareTest.shareMixin.onShow()
assert(navigations.length === navigationCountAfterFollow + 1, 'An authenticated receiver must remain on the shared page')
assert(modals.length === 0 && postCalls.length === 0, 'Opening a private shared page must not prompt or check follow status')
sandbox.testBackend = { Code: 1, Data: { Username: 'gh_1234567890', FollowStatus: 'followed' } }
await sandbox.shareTest.warmOfficialAccountConfig()
assert(postCalls.length === 1 && postCalls[0].url === '/apiengine/xjy-share-official-account' && postCalls[0].data.Action === 'Config' && postCalls[0].auth === true, 'Explicit account page must load the tenant-scoped account configuration')
assert(sandbox.shareTest.getOfficialAccountUsername() === 'gh_1234567890', 'The native follow API must use the backend-provided original ID')
sandbox.shareTest.openOfficialAccountProfile()
assert(officialAccountCalls.length === 1 && officialAccountCalls[0].username === 'gh_1234567890', 'Explicit follow action must open the backend-selected official-account profile')
officialAccountCalls[0].fail({ errMsg: 'openOfficialAccountProfile:fail test' })
assert(modals.length === 1 && modals[0].title === '打开公众号失败', 'Native API failure must be surfaced to the user')
sandbox.testBackend = { Code: 0, Msg: 'backend unavailable' }
await sandbox.shareTest.warmOfficialAccountConfig(true)
assert(sandbox.shareTest.getOfficialAccountUsername() === '', 'An unavailable backend must invalidate a stale account ID')
sandbox.shareTest.openOfficialAccountProfile()
assert(modals.length === 2 && modals[1].title === '暂时无法关注公众号', 'Missing backend configuration must show an actionable error')

process.stdout.write(`Share policy check passed: ${routes.length} direct page hooks, current routes, current-page screenshots, and sensitive-query filtering.\n`)
}

verifySharedReceiverFlow().catch((error) => { console.error(error); process.exitCode = 1 })
