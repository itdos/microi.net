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

function getProfileArtifacts(profileId) {
  const profile = loadProfile(profileId)
  const pagesSource = profilePath(profileId, 'pages.json')
  const manifestSource = profilePath(profileId, 'manifest.json')
  const tenantSource = path.join(projectRoot, 'src', 'tenants', profile.tenantModule, 'business.js')
  const tenantNativeTableSource = path.join(projectRoot, 'src', 'tenants', profile.tenantModule, 'native-table.js')
  for (const required of [pagesSource, manifestSource, tenantSource, tenantNativeTableSource]) {
    if (!fs.existsSync(required)) throw new Error(`Profile 缺少文件: ${required}`)
  }
  return [
    {
      target: path.join(projectRoot, 'src', 'pages.json'),
      content: fs.readFileSync(pagesSource)
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
      target: path.join(projectRoot, 'src', 'generated', 'tenant-business.js'),
      content: Buffer.from(generatedTenantSource(profile), 'utf8')
    },
    {
      target: path.join(projectRoot, 'src', 'generated', 'tenant-native-table.js'),
      content: Buffer.from(generatedTenantNativeTableSource(profile), 'utf8')
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
  generatedTenantSource,
  generatedTenantNativeTableSource
}
