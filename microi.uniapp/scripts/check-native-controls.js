const fs = require('fs')
const path = require('path')
const { findWorkspaceRoot } = require('./lib/workspace-paths')

const root = path.resolve(__dirname, '..')
const policyPath = path.join(root, 'src/config/mci-native-controls.json')
const workspaceRoot = findWorkspaceRoot(root)
const officialPath = path.join(workspaceRoot, 'Microi.Client', 'src', 'views', 'form-engine', 'diy-field-component', 'diy-component-list.json')

function fail(message) {
  console.error(`Native control check failed: ${message}`)
  process.exit(1)
}

if (!fs.existsSync(officialPath)) fail(`official control source not found: ${officialPath}`)

const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'))
const official = JSON.parse(fs.readFileSync(officialPath, 'utf8'))
const categories = ['editable', 'readonly', 'layout', 'related', 'guarded']
const mapped = categories.flatMap((name) => policy[name] || [])
const officialNames = official.map((item) => item.Control).filter(Boolean)
const duplicate = mapped.filter((name, index) => mapped.indexOf(name) !== index)
const missing = officialNames.filter((name) => !mapped.includes(name))
const unknown = mapped.filter((name) => !officialNames.includes(name))

if (duplicate.length) fail(`duplicate controls: ${[...new Set(duplicate)].join(', ')}`)
if (missing.length) fail(`unmapped official controls: ${missing.join(', ')}`)
if (unknown.length) fail(`unknown controls: ${unknown.join(', ')}`)

const renderer = fs.readFileSync(path.join(root, 'src/components/mci-native-field/mci-native-field.vue'), 'utf8')
const nativeForm = fs.readFileSync(path.join(root, 'src/pages/native-form/index.vue'), 'utf8')
const formRuntime = fs.readFileSync(path.join(root, 'src/platform/native-form.js'), 'utf8')
const xjyTenantForm = fs.readFileSync(path.join(root, 'src/tenants/xjy/form.js'), 'utf8')
const xjyProposalCalculation = fs.readFileSync(
  path.join(root, 'src/tenants/xjy/proposal-calculation.js'),
  'utf8'
)
const businessDetail = fs.readFileSync(path.join(root, 'src/pages/business/detail.vue'), 'utf8')

for (const control of ['ImgUpload', 'FileUpload', 'DateTime', 'Address', 'Map', 'Radio', 'Checkbox', 'Switch', 'Rate', 'RichText']) {
  if (!renderer.includes(control)) fail(`renderer does not cover ${control}`)
}
if (!nativeForm.includes('<mci-native-field')) fail('native form must delegate fields to mci-native-field')
if (!formRuntime.includes('inferNativeComponent')) fail('semantic control inference is missing')
if (!formRuntime.includes("return 'ImgUpload'")) fail('avatar/image semantic fallback is missing')
if (!formRuntime.includes('SENSITIVE_FIELD_PATTERN')) fail('sensitive field visibility guard is missing')
if (!nativeForm.includes('hydrateNativeFormOptions(liveDefinition')) {
  fail('async field options must hydrate the live reactive form definition')
}
// zhy: 防止下拉层级通知和解除卡片裁切的修复被后续改动移除。
if (!renderer.includes("'selector-toggle'") || !nativeForm.includes('@selector-toggle="handleSelectorToggle(field, $event)"')) {
  fail('dropdown selector must notify the form before elevating its stacking context')
}
if (!nativeForm.includes('.form-section--select-open') || !nativeForm.includes('overflow: visible')) {
  fail('open dropdown section must escape card clipping')
}
if (!nativeForm.includes('animation: mciNativeFormEnter .32s ease backwards') ||
  /\.form-section--select-open\s*\{[^}]*animation:\s*none/s.test(nativeForm)) {
  fail('dropdown close must not replay the form section entrance animation')
}
if (!nativeForm.includes('.native-form-page--select-open :deep(.mci-page-shell__body)')) {
  fail('open dropdown must stack above fixed page controls and floating launchers')
}
// zhy: 小程序下拉框应与 PC 端一致，直接在触发框内检索、可清空，并在多选点击时立即同步。
if (!renderer.includes('native-select__inline-search') ||
  !renderer.includes('@tap.stop="clearDropdownSelection"')) {
  fail('dropdown selector must provide inline search and clear selection controls')
}
if (!renderer.includes(`:placeholder="hasSelection ? '' : '输入关键词检索'"`)) {
  fail('dropdown search placeholder must be hidden after a value is selected')
}
if (renderer.includes('confirmMultipleSelection') || renderer.includes('native-select__actions')) {
  fail('multiple dropdown selection must not require a separate confirmation action')
}
if (!/selectDropdownOption\(option\)[\s\S]*?this\.emitValue\(values\)[\s\S]*?multiple:\s*true/.test(renderer)) {
  fail('multiple dropdown selection must update the form value immediately')
}
if (!renderer.includes("this.isMultiple && raw && typeof raw === 'object'") ||
  renderer.includes('config.SelectSaveFields')) {
  fail('multiple dropdown values must save each complete selected row without field projection')
}
// zhy: 确保新增和编辑页的字段分组保持可折叠能力。
if (!nativeForm.includes('@tap="toggleGroup(group, groupIndex)"') ||
  !nativeForm.includes('initializeGroupExpansion(definition.groups || [])') ||
  !nativeForm.includes('this.expandedGroupKeys = [this.groupKey(groups[0], 0)]') ||
  !nativeForm.includes('.form-section__toggle.expanded') ||
  !nativeForm.includes('this.expandFirstInvalidGroup()')) {
  fail('native form field groups must support collapsed and expanded states')
}
// zhy：确保客户方案设备联动和新增默认值不会在移动端回归中丢失。
for (const token of [
  'PROPOSAL_FIELDS',
  "['ShangpinMC']",
  "['ZulinXJ']",
  "['Xianjia']",
  "['GenghuanLXJG']",
  "['Id', 'ID', 'id']",
  'proposalDefaults(context)',
  'latestProposalValues(context)',
  'calculateProposalCosts(context.form)',
  'handleFieldChange(context, payload)'
]) {
  if (!xjyTenantForm.includes(token)) fail(`xjy proposal form rule is missing: ${token}`)
}
// zhy：跟进详情必须将联系人 Id 解析为姓名，保存时必须显式补入隐藏客户 Id。
for (const token of [
  'isFollowupForm(context)',
  'resolveFollowupCustomer(context, true)',
  "fieldName(context, 'KehuMCCD', '客户名称（传递）')",
  'await loadFollowupContacts(context, customer.id)',
  "SelectSaveField: ''",
  'return { ...matched }',
  'normalizeFollowupContactSelection(context, rows)'
]) {
  if (!xjyTenantForm.includes(token)) fail(`xjy follow-up form rule is missing: ${token}`)
}
for (const token of [
  "ShuizhiYQ: '纳滤'",
  "DashuiFS: '[\"4\"]'",
  "JiareFS: '步进式'",
  "ShuiwenYQ: '[\"2\"]'"
]) {
  if (!xjyProposalCalculation.includes(token)) fail(`xjy proposal default is missing: ${token}`)
}
if (!nativeForm.includes('@change="handleNativeFieldChange(field, $event)"')) {
  fail('native form must notify tenant extensions when a field value changes')
}
if (!nativeForm.includes('v-show="tenantFieldPresentation(field).visible !== false"')) {
  fail('native form must support declarative tenant field visibility')
}
// zhy：客户详情应将地图主字段与 _Lat/_Lng 辅助字段合并成内嵌地图。
for (const token of [
  'hasTenantDetailMap(field)',
  'isTenantMapCoordinateHelper(field)',
  "name.match(/^(.+)_(Lat|Lng)$/i)",
  "presentation.type === 'map'"
]) {
  if (!businessDetail.includes(token)) fail(`business detail map rendering is missing: ${token}`)
}

console.log(`Native control check passed (${officialNames.length}/${officialNames.length} official controls mapped).`)
