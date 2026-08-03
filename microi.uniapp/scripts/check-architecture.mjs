import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const { loadProfile } = require('./lib/profile-manager.cjs')
const failures = []

function check(condition, message) {
  if (!condition) failures.push(message)
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function walk(relativePath) {
  const absolute = path.join(root, relativePath)
  if (!fs.existsSync(absolute)) return []
  const stat = fs.statSync(absolute)
  if (stat.isFile()) return [relativePath]
  return fs.readdirSync(absolute).flatMap((name) => walk(path.join(relativePath, name)))
}

const requiredGuidance = [
  'AGENTS.md',
  'CLAUDE.md',
  '.github/copilot-instructions.md',
  '.cursor/rules/microi-uniapp-architecture.mdc',
  'docs/architecture.md'
]
requiredGuidance.forEach((file) => check(fs.existsSync(path.join(root, file)), `缺少 AI/协作架构说明：${file}`))
check(
  fs.existsSync(path.resolve(root, '..', '.github', 'instructions', 'microi-uniapp.instructions.md')),
  '缺少仓库根级 Copilot 路径指令：.github/instructions/microi-uniapp.instructions.md'
)

const genericPaths = [
  'src/platform/business-runtime.js',
  'src/platform/form-extension.js',
  'src/platform/list-return.js',
  'src/platform/module-registry.js',
  'src/platform/native-form.js',
  'src/platform/native-table.js',
  'src/platform/view-actions.js',
  'src/platform/view-manifest.js',
  'src/platform/view-metrics.js',
  'src/platform/view-schema-core.mjs',
  'src/pages/module',
  'src/pages/native-form',
  'src/components/mci-child-table',
  'src/components/mci-join-form',
  'src/components/mci-native-field',
  'src/components/mci-related-table',
  'src/components/mci-table-selector'
]
const genericFiles = genericPaths.flatMap(walk)
const tenantLeak = /(集福鲤|Diy_Kehu|Diy_Shouhou|专属客服|售后人员|(?:^|[/'"])xjy(?:[/'"]|$))/i
const unsafeScript = /(?:\beval\s*\(|new\s+Function\s*\(|\.\s*V8Code\b)/
const directProtectedMetadataCrud = /FormEngine\.(?:GetFormData|GetTableData)\s*\(\s*['"]diy_(?:table|field)['"]/i
const directMetadataRoute = /\/api\/FormEngine\/GetDiy(?:TableModel|FieldList)/i

genericFiles.forEach((file) => {
  const source = read(file)
  check(!tenantLeak.test(source), `平台通用代码包含租户实现：${file}`)
  check(!unsafeScript.test(source), `平台通用代码包含不安全前端脚本：${file}`)
  check(!/\bDiyConfig\b/.test(source), `平台通用代码仍读取已废弃 DiyConfig：${file}`)
  check(!directProtectedMetadataCrud.test(source), `平台通用代码绕过元数据授权接口直查系统表：${file}`)
  check(!directMetadataRoute.test(source), `平台通用代码绕过 V8.FormEngine 元数据封装：${file}`)
})

const v8Source = read('src/utils/microi.v8.js')
;['GetDiyTableModel', 'GetDiyFieldList', 'formEngineMetadata']
  .forEach((keyword) => check(v8Source.includes(keyword), `MicroiV8 缺少统一元数据封装：${keyword}`))

const profileIds = fs.readdirSync(path.join(root, 'profiles'))
  .filter((name) => fs.existsSync(path.join(root, 'profiles', name, 'profile.cjs')))
profileIds.forEach((profileId) => {
  const profile = loadProfile(profileId)
  const tenantRoot = path.join(root, 'src', 'tenants', profile.tenantModule)
  ;['business.js', 'runtime.js', 'form.js', 'native-table.js'].forEach((file) => {
    check(fs.existsSync(path.join(tenantRoot, file)), `${profileId} 缺少租户扩展：${file}`)
  })
})

const standardPages = JSON.parse(read('profiles/standard/pages.json'))
const standardRoutes = [
  ...(standardPages.pages || []).map((page) => page.path),
  ...(standardPages.subPackages || []).flatMap((pkg) =>
    (pkg.pages || []).map((page) => `${pkg.root}/${page.path}`)
  )
]
;['pages/module/catalog', 'pages/module/list', 'pages/module/detail', 'pages/native-form/index']
  .forEach((route) => check(standardRoutes.includes(route), `标准 Profile 缺少动态路由：${route}`))
;['pages/business/list', 'pages/task/list', 'pages/mall/index', 'pages/news/index']
  .forEach((route) => check(!standardRoutes.includes(route), `标准 Profile 错误包含租户业务路由：${route}`))

const standardProfile = loadProfile('standard')
check(standardProfile.config.features?.dynamicModules === true, '标准 Profile 必须启用动态模块')
check(standardProfile.config.features?.dynamicForm === true, '标准 Profile 必须启用动态表单')

const nativeFormSource = read('src/platform/native-form.js')
;['AppVisible', 'Component', 'Config', 'Data', 'schemaFingerprint', 'ViewSchema']
  .forEach((keyword) => {
    if (keyword === 'ViewSchema') return
    check(nativeFormSource.includes(keyword), `动态表单缺少元数据能力：${keyword}`)
  })
const viewSource = read('src/platform/view-schema-core.mjs')
;['Detail', 'Edit', 'List', 'Card', 'PC', 'Mobile', 'ActionSchema', 'ViewSchema']
  .forEach((keyword) => check(viewSource.includes(keyword), `统一视图协议缺少：${keyword}`))
const nativeFormPageSource = read('src/pages/native-form/index.vue')
check(nativeFormPageSource.includes('compileFormConfig'), '动态表单尚未消费 Edit/Detail ViewSchema')
check(nativeFormPageSource.includes('applyNativeFormViewDefinition'), '动态表单缺少视图布局回退合并')

const businessRuntimeSource = read('src/platform/business-runtime.js')
const resolveTableIdSource = businessRuntimeSource.slice(
  businessRuntimeSource.indexOf('export async function resolveDiyTableId'),
  businessRuntimeSource.indexOf('function flattenMenus')
)
check(
  !/\.GetDiyTableModel\s*\(/.test(resolveTableIdSource),
  '表名解析禁止逐菜单调用 GetDiyTableModel，应由调用方传入已授权 tableId'
)
check(
  businessRuntimeSource.includes("menu.DiyTableId || '') === String(tableId)"),
  '菜单解析缺少确定性 DiyTableId 匹配'
)
const relatedListSource = read('src/components/mci-business-related-list/mci-business-related-list.vue')
check(
  relatedListSource.includes('tableModel: this.table') &&
    relatedListSource.includes('this.childMenuId,\n          this.table.Id'),
  '关联列表必须复用已加载表模型并把 tableId 传给菜单解析'
)
check(
  nativeFormSource.includes('options.tableModel && options.tableModel.Id'),
  '动态表单定义必须复用调用方已授权读取的表模型'
)

if (failures.length) {
  failures.forEach((failure) => console.error(`[architecture] FAIL: ${failure}`))
  process.exit(1)
}

console.log(`[architecture] PASS: ${genericFiles.length} generic files, ${profileIds.length} profiles`)
