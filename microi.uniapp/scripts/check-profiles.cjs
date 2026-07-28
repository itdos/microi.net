const fs = require('fs')
const path = require('path')
const {
  getProfileArtifacts,
  loadProfile,
  projectRoot,
  generatedProfileSource,
  generatedActiveTabBarSource,
  generatedTenantSource,
  generatedTenantNativeTableSource,
  generatedTenantFormSource,
  generatedTenantRuntimeSource
} = require('./lib/profile-manager.cjs')

const profileIds = fs.readdirSync(path.join(projectRoot, 'profiles'))
  .filter((name) => fs.existsSync(path.join(projectRoot, 'profiles', name, 'profile.cjs')))

const failures = []

function check(condition, message) {
  if (!condition) failures.push(message)
}

function findArtifact(artifacts, ...relativePath) {
  const expectedTarget = path.resolve(projectRoot, ...relativePath)
  return artifacts.find((artifact) => path.resolve(artifact.target) === expectedTarget)
}

function parseGeneratedDefaultObject(source) {
  const marker = 'export default '
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) return null
  try {
    return JSON.parse(source.slice(markerIndex + marker.length).trim())
  } catch (error) {
    return null
  }
}

function expectedTabBarList(pages) {
  const tabBar = pages && pages.tabBar ? pages.tabBar : {}
  return (Array.isArray(tabBar.list) ? tabBar.list : []).map((item) => ({
    pagePath: String(item.pagePath || '').replace(/^\/+/, ''),
    text: item.text || '',
    iconPath: item.iconPath || '',
    selectedIconPath: item.selectedIconPath || item.iconPath || ''
  }))
}

for (const profileId of profileIds) {
  const profile = loadProfile(profileId)
  const artifacts = getProfileArtifacts(profileId)
  const pagesArtifact = findArtifact(artifacts, 'src', 'pages.json')
  const manifestArtifact = findArtifact(artifacts, 'src', 'manifest.json')
  const activeTabBarArtifact = findArtifact(artifacts, 'src', 'generated', 'active-tabbar.js')
  check(!!pagesArtifact, `${profileId}: getProfileArtifacts 缺少 pages.json`)
  check(!!manifestArtifact, `${profileId}: getProfileArtifacts 缺少 manifest.json`)
  check(!!activeTabBarArtifact, `${profileId}: getProfileArtifacts 缺少 active-tabbar.js`)
  if (!pagesArtifact || !manifestArtifact) continue

  const pages = JSON.parse(pagesArtifact.content.toString('utf8'))
  const manifest = JSON.parse(manifestArtifact.content.toString('utf8'))
  const pagePaths = new Set([
    ...(pages.pages || []).map((page) => page.path),
    ...(pages.subPackages || []).flatMap((pkg) => (pkg.pages || []).map((page) => `${pkg.root}/${page.path}`))
  ])

  check(profile.config.profileId === profileId, `${profileId}: config.profileId 不一致`)
  check(profile.config.features && profile.config.routes, `${profileId}: 缺少 features/routes`)
  check(manifest.vueVersion === '3', `${profileId}: manifest 必须使用 Vue3`)
  check(pages.tabBar && pages.tabBar.custom === true, `${profileId}: tabBar 必须启用 custom`)
  check((pages.tabBar && pages.tabBar.list || []).every((item) => pagePaths.has(item.pagePath)), `${profileId}: tabBar 存在未注册路由`)
  pagePaths.forEach((pagePath) => {
    const vuePath = path.join(projectRoot, 'src', `${pagePath}.vue`)
    const nvuePath = path.join(projectRoot, 'src', `${pagePath}.nvue`)
    check(fs.existsSync(vuePath) || fs.existsSync(nvuePath), `${profileId}: 路由缺少页面源码 ${pagePath}`)
  })
  check(generatedProfileSource(profile).includes(`"profileId": "${profileId}"`), `${profileId}: 配置生成失败`)
  if (activeTabBarArtifact) {
    const activeTabBarSource = activeTabBarArtifact.content.toString('utf8')
    const activeTabBarConfig = parseGeneratedDefaultObject(activeTabBarSource)
    check(
      activeTabBarSource === generatedActiveTabBarSource(profile, pages),
      `${profileId}: active-tabbar.js 产物内容与 Profile 不一致`
    )
    check(activeTabBarConfig && activeTabBarConfig.profileId === profileId, `${profileId}: active-tabbar.js profileId 不一致`)
    check(
      activeTabBarConfig && activeTabBarConfig.custom === (pages.tabBar.custom === true),
      `${profileId}: active-tabbar.js custom 状态不一致`
    )
    check(
      activeTabBarConfig && JSON.stringify(activeTabBarConfig.list) === JSON.stringify(expectedTabBarList(pages)),
      `${profileId}: active-tabbar.js list 与 pages.json 不一致`
    )
  }
  check(generatedTenantSource(profile).includes(`/tenants/${profile.tenantModule}/business.js`), `${profileId}: 租户适配器生成失败`)
  check(
    generatedTenantNativeTableSource(profile).includes(`/tenants/${profile.tenantModule}/native-table.js`),
    `${profileId}: 租户表格适配器生成失败`
  )
  check(
    generatedTenantFormSource(profile).includes(`/tenants/${profile.tenantModule}/form.js`),
    `${profileId}: 租户表单扩展生成失败`
  )
  check(
    generatedTenantRuntimeSource(profile).includes(`/tenants/${profile.tenantModule}/runtime.js`),
    `${profileId}: 租户运行时扩展生成失败`
  )
}

const xjyProfile = loadProfile('xjy')
const xjyPages = JSON.parse(fs.readFileSync(path.join(projectRoot, 'profiles', 'xjy', 'pages.json'), 'utf8'))
const activeTabBarPath = path.join(projectRoot, 'src', 'generated', 'active-tabbar.js')
check(
  fs.readFileSync(path.join(projectRoot, 'src', 'pages.json')).equals(fs.readFileSync(path.join(projectRoot, 'profiles', 'xjy', 'pages.json'))),
  '默认 src/pages.json 必须与 xjy Profile 完全一致'
)
check(
  fs.readFileSync(path.join(projectRoot, 'src', 'manifest.json')).equals(fs.readFileSync(path.join(projectRoot, 'profiles', 'xjy', 'manifest.json'))),
  '默认 src/manifest.json 必须与 xjy Profile 完全一致'
)
check(
  fs.readFileSync(path.join(projectRoot, 'src', 'generated', 'active-profile.js'), 'utf8') === generatedProfileSource(xjyProfile),
  '默认 active-profile.js 必须由 xjy Profile 生成'
)
check(fs.existsSync(activeTabBarPath), '默认 active-tabbar.js 必须存在')
if (fs.existsSync(activeTabBarPath)) {
  check(
    fs.readFileSync(activeTabBarPath, 'utf8') === generatedActiveTabBarSource(xjyProfile, xjyPages),
    '默认 active-tabbar.js 必须由 xjy Profile 的 pages.json 生成'
  )
}
check(
  fs.readFileSync(path.join(projectRoot, 'src', 'generated', 'tenant-business.js'), 'utf8') === generatedTenantSource(xjyProfile),
  '默认 tenant-business.js 必须指向 xjy'
)
check(
  fs.readFileSync(path.join(projectRoot, 'src', 'generated', 'tenant-native-table.js'), 'utf8') === generatedTenantNativeTableSource(xjyProfile),
  '默认 tenant-native-table.js 必须指向 xjy'
)
check(
  fs.readFileSync(path.join(projectRoot, 'src', 'generated', 'tenant-form.js'), 'utf8') === generatedTenantFormSource(xjyProfile),
  '默认 tenant-form.js 必须指向 xjy'
)
check(
  fs.readFileSync(path.join(projectRoot, 'src', 'generated', 'tenant-runtime.js'), 'utf8') === generatedTenantRuntimeSource(xjyProfile),
  '默认 tenant-runtime.js 必须指向 xjy'
)

if (failures.length) {
  failures.forEach((failure) => console.error(`[profile] FAIL: ${failure}`))
  process.exit(1)
}

console.log(`[profile] PASS: ${profileIds.length} profiles (${profileIds.join(', ')})`)
