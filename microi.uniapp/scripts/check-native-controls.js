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
if (!nativeForm.includes('.native-form-page--select-open :deep(.mci-page-shell__body)')) {
  fail('open dropdown must stack above fixed page controls and floating launchers')
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
  'proposalDefaults(context)'
]) {
  if (!xjyTenantForm.includes(token)) fail(`xjy proposal form rule is missing: ${token}`)
}

console.log(`Native control check passed (${officialNames.length}/${officialNames.length} official controls mapped).`)
