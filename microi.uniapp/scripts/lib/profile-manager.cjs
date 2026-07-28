const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..', '..')

function profilePath(profileId, fileName) {
  return path.join(projectRoot, 'profiles', profileId, fileName)
}

function loadProfile(profileId) {
  const source = profilePath(profileId, 'profile.cjs')
  if (!fs.existsSync(source)) {
    throw new Error(`未知 Profile: ${profileId}`)
  }
  delete require.cache[require.resolve(source)]
  const profile = require(source)
  if (!profile || profile.id !== profileId || !profile.tenantModule || !profile.config) {
    throw new Error(`Profile 配置无效: ${source}`)
  }
  return profile
}

function generatedProfileSource(profile) {
  return [
    `// Generated from profiles/${profile.id}/profile.cjs. Use npm profile commands to switch safely.`,
    `export default ${JSON.stringify(profile.config, null, 2)}`,
    ''
  ].join('\n')
}

function generatedActiveTabBarSource(profile, pagesConfig) {
  const tabBar = pagesConfig && pagesConfig.tabBar ? pagesConfig.tabBar : {}
  const config = {
    profileId: profile.id,
    custom: tabBar.custom === true,
    color: tabBar.color || '#80909A',
    selectedColor: tabBar.selectedColor || profile.config.theme?.brand || '#E54625',
    backgroundColor: tabBar.backgroundColor || '#FFFFFF',
    list: Array.isArray(tabBar.list) ? tabBar.list.map((item) => ({
      pagePath: String(item.pagePath || '').replace(/^\/+/, ''),
      text: item.text || '',
      iconPath: item.iconPath || '',
      selectedIconPath: item.selectedIconPath || item.iconPath || ''
    })) : []
  }
  return [
    `// Generated from profiles/${profile.id}/pages.json. Use npm profile commands to switch safely.`,
    `export default ${JSON.stringify(config, null, 2)}`,
    ''
  ].join('\n')
}

function generatedTenantSource(profile) {
  const modulePath = `@/tenants/${profile.tenantModule}/business.js`
  return [
    '// Generated from the active profile. Keep tenant code out of platform modules.',
    `import tenantBusiness from '${modulePath}'`,
    'const activeTenantBusiness = tenantBusiness',
    'export default activeTenantBusiness',
    ''
  ].join('\n')
}

function generatedTenantNativeTableSource(profile) {
  const modulePath = `@/tenants/${profile.tenantModule}/native-table.js`
  return [
    '// Generated from the active profile. Keep tenant form rules out of platform modules.',
    `import tenantNativeTable from '${modulePath}'`,
    'const activeTenantNativeTable = tenantNativeTable',
    'export default activeTenantNativeTable',
    ''
  ].join('\n')
}

function generatedTenantFormSource(profile) {
  const modulePath = `@/tenants/${profile.tenantModule}/form.js`
  return [
    '// Generated from the active profile. Keep tenant form behavior out of platform pages.',
    `import tenantForm from '${modulePath}'`,
    'const activeTenantForm = tenantForm',
    'export default activeTenantForm',
    ''
  ].join('\n')
}

function generatedTenantRuntimeSource(profile) {
  const modulePath = `@/tenants/${profile.tenantModule}/runtime.js`
  return [
    '// Generated from the active profile. Keep tenant runtime behavior out of platform modules.',
    `import tenantRuntime from '${modulePath}'`,
    'const activeTenantRuntime = tenantRuntime',
    'export default activeTenantRuntime',
    ''
  ].join('\n')
}

function getProfileArtifacts(profileId) {
  const profile = loadProfile(profileId)
  const pagesSource = profilePath(profileId, 'pages.json')
  const manifestSource = profilePath(profileId, 'manifest.json')
  const tenantSource = path.join(projectRoot, 'src', 'tenants', profile.tenantModule, 'business.js')
  const tenantNativeTableSource = path.join(projectRoot, 'src', 'tenants', profile.tenantModule, 'native-table.js')
  const tenantFormSource = path.join(projectRoot, 'src', 'tenants', profile.tenantModule, 'form.js')
  const tenantRuntimeSource = path.join(projectRoot, 'src', 'tenants', profile.tenantModule, 'runtime.js')
  for (const required of [pagesSource, manifestSource, tenantSource, tenantNativeTableSource, tenantFormSource, tenantRuntimeSource]) {
    if (!fs.existsSync(required)) throw new Error(`Profile 缺少文件: ${required}`)
  }
  const pagesContent = fs.readFileSync(pagesSource)
  const pagesConfig = JSON.parse(pagesContent.toString('utf8'))
  return [
    {
      target: path.join(projectRoot, 'src', 'pages.json'),
      content: pagesContent
    },
    {
      target: path.join(projectRoot, 'src', 'manifest.json'),
      content: fs.readFileSync(manifestSource)
    },
    {
      target: path.join(projectRoot, 'src', 'generated', 'active-profile.js'),
      content: Buffer.from(generatedProfileSource(profile), 'utf8')
    },
    {
      target: path.join(projectRoot, 'src', 'generated', 'active-tabbar.js'),
      content: Buffer.from(generatedActiveTabBarSource(profile, pagesConfig), 'utf8')
    },
    {
      target: path.join(projectRoot, 'src', 'generated', 'tenant-business.js'),
      content: Buffer.from(generatedTenantSource(profile), 'utf8')
    },
    {
      target: path.join(projectRoot, 'src', 'generated', 'tenant-native-table.js'),
      content: Buffer.from(generatedTenantNativeTableSource(profile), 'utf8')
    },
    {
      target: path.join(projectRoot, 'src', 'generated', 'tenant-form.js'),
      content: Buffer.from(generatedTenantFormSource(profile), 'utf8')
    },
    {
      target: path.join(projectRoot, 'src', 'generated', 'tenant-runtime.js'),
      content: Buffer.from(generatedTenantRuntimeSource(profile), 'utf8')
    }
  ]
}

function activateProfile(profileId) {
  const artifacts = getProfileArtifacts(profileId)
  const backups = artifacts.map(({ target }) => ({
    target,
    existed: fs.existsSync(target),
    content: fs.existsSync(target) ? fs.readFileSync(target) : null
  }))
  artifacts.forEach(({ target, content }) => {
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content)
  })
  return () => {
    backups.forEach(({ target, existed, content }) => {
      if (existed) fs.writeFileSync(target, content)
      else if (fs.existsSync(target)) fs.rmSync(target)
    })
  }
}

module.exports = {
  projectRoot,
  loadProfile,
  getProfileArtifacts,
  activateProfile,
  generatedProfileSource,
  generatedActiveTabBarSource,
  generatedTenantSource,
  generatedTenantNativeTableSource,
  generatedTenantFormSource,
  generatedTenantRuntimeSource
}
