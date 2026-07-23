const fs = require('fs')
const path = require('path')

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
assert(shareSource.includes("'pages/task/detail': { title: SHARE_TITLES.service, image: 'service', sharePath: '/pages/task/list' }"), 'Task details must share the safe task-list landing page')
assert(shareSource.includes("'pages/business/detail': { title: SHARE_TITLES.business, image: 'business', sharePath: '/pages/business/list'"), 'Business details must share the safe business-list landing page')
assert(shareSource.includes("'pages/module/detail': { title: SHARE_TITLES.business, image: 'business', sharePath: '/pages/module/list'"), 'Generic module details must share the safe authorized module-list landing page')
assert(shareSource.includes("allowedQuery: ['id']"), 'Public detail pages must explicitly allow only their public id')
assert(shareSource.includes("uni.hideShareMenu({ menus: ['shareTimeline'] })"), 'Sensitive pages must hide timeline sharing')

process.stdout.write(`Share policy check passed: ${pagePaths.length}/${pagePaths.length} pages, ${coverKeys.length} branded covers, runtime titles disabled.\n`)
