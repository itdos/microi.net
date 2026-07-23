const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const [tenantId, label, osClient, apiBase, fileServer = ''] = process.argv.slice(2)

if (!tenantId || !/^[a-z][a-z0-9_-]*$/.test(tenantId)) {
  console.error('用法：npm run tenant:create -- <id> <名称> <OsClient> <ApiBase> [FileServer]')
  process.exit(1)
}
if (!label || !osClient || !/^https?:\/\//i.test(apiBase || '')) {
  console.error('名称、OsClient 和有效 ApiBase 均为必填项')
  process.exit(1)
}

const tenantRoot = path.join(root, 'src', 'tenants', tenantId)
const profileRoot = path.join(root, 'profiles', tenantId)
if (fs.existsSync(tenantRoot) || fs.existsSync(profileRoot)) {
  console.error(`租户 ${tenantId} 已存在，未覆盖任何文件`)
  process.exit(1)
}

fs.mkdirSync(tenantRoot, { recursive: true })
fs.mkdirSync(path.join(tenantRoot, 'views'), { recursive: true })
fs.mkdirSync(profileRoot, { recursive: true })

for (const file of ['business.js', 'runtime.js', 'form.js', 'native-table.js']) {
  fs.copyFileSync(path.join(root, 'src', 'tenants', 'standard', file), path.join(tenantRoot, file))
}
fs.writeFileSync(path.join(tenantRoot, 'views', '.gitkeep'), '')
fs.writeFileSync(path.join(tenantRoot, 'README.md'), [
  `# ${label} 租户扩展`,
  '',
  '先使用标准动态模块、ViewSchema 和 ActionSchema；只有原生能力或专属业务组合才在本目录扩展。',
  '不得修改平台层来实现本租户字段、表名、素材或路由。',
  ''
].join('\n'))

const standardProfile = require(path.join(root, 'profiles', 'standard', 'profile.cjs'))
const profile = JSON.parse(JSON.stringify(standardProfile))
profile.id = tenantId
profile.tenantModule = tenantId
profile.label = label
Object.assign(profile.config, {
  profileId: tenantId,
  tenantKey: tenantId,
  osClient,
  apiBase: apiBase.replace(/\/+$/, ''),
  fileServer: (fileServer || profile.config.fileServer || '').replace(/\/+$/, ''),
  appName: label,
  platformName: `${label}移动工作台`,
  servicePlatformName: `${label}服务平台`,
  poweredBy: label
})
fs.writeFileSync(
  path.join(profileRoot, 'profile.cjs'),
  `module.exports = ${JSON.stringify(profile, null, 2)}\n`
)

const pages = JSON.parse(fs.readFileSync(path.join(root, 'profiles', 'standard', 'pages.json'), 'utf8'))
pages.globalStyle.navigationBarTitleText = label
fs.writeFileSync(path.join(profileRoot, 'pages.json'), `${JSON.stringify(pages, null, 2)}\n`)

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'profiles', 'standard', 'manifest.json'), 'utf8'))
manifest.name = `${label}移动工作台`
manifest.description = `${label}原生动态小程序`
manifest.appid = `__UNI__MICROI_${tenantId.replace(/[^a-z0-9]/gi, '_').toUpperCase()}`
fs.writeFileSync(path.join(profileRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

console.log(`租户 ${tenantId} 已创建：`)
console.log(`- ${path.relative(root, tenantRoot)}`)
console.log(`- ${path.relative(root, profileRoot)}`)
console.log(`配置真实小程序 AppID 后，可直接运行：npm run profile:run -- ${tenantId} dev mp-weixin`)
console.log(`生产构建：npm run profile:run -- ${tenantId} build mp-weixin`)
console.log('提交前运行 npm run check:architecture 和 npm run check:profiles。')
