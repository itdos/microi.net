const fs = require('fs')
const path = require('path')
const {
  getProfileArtifacts,
  loadProfile,
  projectRoot,
  generatedProfileSource,
  generatedTenantSource,
  generatedTenantNativeTableSource
} = require('./lib/profile-manager.cjs')

const profileIds = fs.readdirSync(path.join(projectRoot, 'profiles'))
  .filter((name) => fs.existsSync(path.join(projectRoot, 'profiles', name, 'profile.cjs')))

const failures = []

function check(condition, message) {
  if (!condition) failures.push(message)
}

for (const profileId of profileIds) {
  const profile = loadProfile(profileId)
  const artifacts = getProfileArtifacts(profileId)
  const pages = JSON.parse(artifacts[0].content.toString('utf8'))
  const manifest = JSON.parse(artifacts[1].content.toString('utf8'))
  const pagePaths = new Set([
    ...(pages.pages || []).map((page) => page.path),
    ...(pages.subPackages || []).flatMap((pkg) => (pkg.pages || []).map((page) => `${pkg.root}/${page.path}`))
  ])

  check(profile.config.profileId === profileId, `${profileId}: config.profileId 不一致`)
  check(profile.config.features && profile.config.routes, `${profileId}: 缺少 features/routes`)
  check(manifest.vueVersion === '3', `${profileId}: manifest 必须使用 Vue3`)
  check((pages.tabBar && pages.tabBar.list || []).every((item) => pagePaths.has(item.pagePath)), `${profileId}: tabBar 存在未注册路由`)
  check(generatedProfileSource(profile).includes(`"profileId": "${profileId}"`), `${profileId}: 配置生成失败`)
  check(generatedTenantSource(profile).includes(`/tenants/${profile.tenantModule}/business.js`), `${profileId}: 租户适配器生成失败`)
  check(
    generatedTenantNativeTableSource(profile).includes(`/tenants/${profile.tenantModule}/native-table.js`),
    `${profileId}: 租户表格适配器生成失败`
  )
}

const xjyProfile = loadProfile('xjy')
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
check(
  fs.readFileSync(path.join(projectRoot, 'src', 'generated', 'tenant-business.js'), 'utf8') === generatedTenantSource(xjyProfile),
  '默认 tenant-business.js 必须指向 xjy'
)
check(
  fs.readFileSync(path.join(projectRoot, 'src', 'generated', 'tenant-native-table.js'), 'utf8') === generatedTenantNativeTableSource(xjyProfile),
  '默认 tenant-native-table.js 必须指向 xjy'
)

if (failures.length) {
  failures.forEach((failure) => console.error(`[profile] FAIL: ${failure}`))
  process.exit(1)
}

console.log(`[profile] PASS: ${profileIds.length} profiles (${profileIds.join(', ')})`)
