const fs = require('fs')
const path = require('path')
const vm = require('vm')

const root = path.resolve(__dirname, '..')
const pagesJson = JSON.parse(fs.readFileSync(path.join(root, 'src', 'pages.json'), 'utf8'))
const shareSource = fs.readFileSync(path.join(root, 'src', 'utils', 'share.js'), 'utf8')
const { loadProfile } = require('./lib/profile-manager.cjs')
const xjyProfile = loadProfile('xjy')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function walk(dir, result = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(fullPath, result)
    else if (entry.isFile() && entry.name.endsWith('.vue')) result.push(fullPath)
  }
  return result
}

const pagePaths = [
  ...(pagesJson.pages || []).map((item) => item.path),
  ...(pagesJson.subPackages || []).flatMap((pkg) => (pkg.pages || []).map((item) => `${pkg.root}/${item.path}`))
]

const missingPolicies = pagePaths.filter((pagePath) => !shareSource.includes(`'${pagePath}'`))
assert(missingPolicies.length === 0, `Missing share policies: ${missingPolicies.join(', ')}`)
assert(!shareSource.includes('microi-blue-256.png'), 'Generic Microi logo must not be used as a share image')
assert(!/vm\.(shareTitle|pageTitle|title)/.test(shareSource), 'Share title must not read runtime page or record titles')
assert(!/encodeQuery\(route\.query\)/.test(shareSource), 'Raw page query must not be serialized into a share path')

const coverKeys = ['platform', 'business', 'service', 'mall', 'news', 'invite']
for (const key of coverKeys) {
  const coverUrl = xjyProfile.config?.cdnAssets?.share?.[key] || ''
  assert(coverUrl.endsWith(`jifuli-share-${key}.jpg`), `Missing CDN share cover: ${key}`)
  assert(
    coverUrl.startsWith('https://static.jifulii.com/xjy/miniapp/share/'),
    `Share cover must use the xjy HDFS/CDN host: ${key}`
  )
}

const localHooks = walk(path.join(root, 'src', 'pages'))
  .filter((file) => fs.readFileSync(file, 'utf8').includes('onShareAppMessage'))
  .map((file) => path.relative(root, file).replace(/\\/g, '/'))
assert(
  localHooks.length === 1 && localHooks[0] === 'src/pages/profile/index.vue',
  `Only the invitation page may override the global share hook. Found: ${localHooks.join(', ') || 'none'}`
)

const profileSource = fs.readFileSync(path.join(root, 'src', 'pages', 'profile', 'index.vue'), 'utf8')
assert(profileSource.includes('buildInviteSharePayload'), 'Profile invitation must use the centralized safe share builder')
assert(
  shareSource.includes("'pages/task/detail': { title: SHARE_TITLES.service, image: 'service', sharePath: '/pages/task/detail', allowedQuery: ['id'], timeline: true, pageSnapshot: true }"),
  'Task details must share the current detail page with its record id'
)
assert(
  shareSource.includes("'pages/business/detail': { title: SHARE_TITLES.business, image: 'business', sharePath: '/pages/business/detail', allowedQuery: ['key', 'id', 'menuId'], timeline: true, pageSnapshot: true }"),
  'Business details must share the current detail page with its module, record and menu context'
)
assert(
  shareSource.includes("'pages/module/detail': { title: SHARE_TITLES.business, image: 'business', sharePath: '/pages/module/detail', allowedQuery: ['id', 'menuId'], timeline: true, pageSnapshot: true }"),
  'Generic module details must share the current detail page with its record and menu context'
)
assert(shareSource.includes("allowedQuery: ['id']"), 'Public detail pages must explicitly allow only their public id')
assert(shareSource.includes("uni.hideShareMenu({ menus: ['shareTimeline'] })"), 'Sensitive pages must hide timeline sharing')

let currentPage = null
const executableShareSource = shareSource
  .replace(
    "import appConfig from '@/config.js'",
    "const appConfig = { platformName: 'Microi', appName: 'Microi', workspaceSubTitle: 'Workspace', cdnAssets: {} }"
  )
  .replace(/\bexport const PAGE_POLICIES\b/, 'const PAGE_POLICIES')
  .replace(/\bexport function buildSharePayload\b/, 'function buildSharePayload')
  .replace(/\bexport function buildInviteSharePayload\b/, 'function buildInviteSharePayload')
  .replace(/\bexport default\s*\{/, 'const shareMixin = {')

const shareSandbox = {
  getCurrentPages: () => currentPage ? [currentPage] : [],
  uni: {},
  globalThis: null
}
shareSandbox.globalThis = shareSandbox
vm.runInNewContext(
  `${executableShareSource}\nglobalThis.__shareTest = { buildSharePayload, shareMixin };`,
  shareSandbox,
  { filename: 'src/utils/share.js' }
)

function assertSharePath(route, options, expectedPath) {
  currentPage = { route, options }
  const payload = shareSandbox.__shareTest.buildSharePayload()
  assert(payload.path === expectedPath, `Unexpected friend-share path for ${route}: ${payload.path}`)
  assert(payload.query === expectedPath.split('?')[1], `Unexpected timeline query for ${route}: ${payload.query}`)
  assert(!Object.prototype.hasOwnProperty.call(payload, 'imageUrl'), `Detail page ${route} must use WeChat's current-page thumbnail`)
  const friendShare = shareSandbox.__shareTest.shareMixin.onShareAppMessage()
  const timelineShare = shareSandbox.__shareTest.shareMixin.onShareTimeline()
  assert(!Object.prototype.hasOwnProperty.call(friendShare, 'imageUrl'), `Friend share for ${route} must omit a fixed imageUrl`)
  assert(!Object.prototype.hasOwnProperty.call(timelineShare, 'imageUrl'), `Timeline share for ${route} must omit a fixed imageUrl`)
}

assertSharePath(
  'pages/business/detail',
  { key: 'customers', id: 'customer 001', menuId: 'menu/001', Authorization: 'secret' },
  '/pages/business/detail?key=customers&id=customer%20001&menuId=menu%2F001'
)
assertSharePath(
  'pages/module/detail',
  { id: 'row-001', menuId: 'menu-001', AccessToken: 'secret' },
  '/pages/module/detail?id=row-001&menuId=menu-001'
)
assertSharePath(
  'pages/task/detail',
  { id: 'task-001', CustomerToken: 'secret' },
  '/pages/task/detail?id=task-001'
)

process.stdout.write(`Share policy check passed: ${pagePaths.length}/${pagePaths.length} pages, ${coverKeys.length} branded covers, runtime titles disabled.\n`)
