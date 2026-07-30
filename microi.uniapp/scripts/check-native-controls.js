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
const moduleDetail = fs.readFileSync(path.join(root, 'src/pages/module/detail.vue'), 'utf8')
const formTabs = fs.readFileSync(path.join(root, 'src/components/mci-related-tabs/mci-related-tabs.vue'), 'utf8')
const childTable = fs.readFileSync(path.join(root, 'src/components/mci-child-table/mci-child-table.vue'), 'utf8')
const businessCard = fs.readFileSync(path.join(root, 'src/components/mci-business-card/mci-business-card.vue'), 'utf8')
const relatedBusinessList = fs.readFileSync(
  path.join(root, 'src/components/mci-business-related-list/mci-business-related-list.vue'),
  'utf8'
)
const relatedBusinessPage = fs.readFileSync(path.join(root, 'src/pages/business/related-list.vue'), 'utf8')
const businessList = fs.readFileSync(path.join(root, 'src/pages/business/list.vue'), 'utf8')
const taskCard = fs.readFileSync(path.join(root, 'src/components/mci-task-card/mci-task-card.vue'), 'utf8')
const taskList = fs.readFileSync(path.join(root, 'src/pages/task/list.vue'), 'utf8')

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
  !nativeForm.includes("group.defaultExpanded !== false") ||
  !nativeForm.includes('.form-section__toggle.expanded') ||
  !nativeForm.includes('this.expandFirstInvalidGroup()')) {
  fail('native form field groups must support collapsed and expanded states')
}
if (!formRuntime.includes("field.component === 'CollapseGroup'") ||
  !formRuntime.includes("source: 'CollapseGroup'") ||
  !formRuntime.includes('collapse.DefaultCollapsed') ||
  !formRuntime.includes('collapse.FieldCount')) {
  fail('native form field groups must follow platform CollapseGroup metadata')
}
if (!formRuntime.includes('field.layoutGroupKey = active.group.key') ||
  !formRuntime.includes('active.group.relatedFields.push(field)') ||
  !formRuntime.includes('groups: layoutGroups.filter((group) => group.fields.length)') ||
  !formRuntime.includes('relatedGroups: layoutGroups') ||
  !formRuntime.includes('NATIVE_FORM_SCHEMA_VERSION = 6')) {
  fail('related fields must preserve their platform CollapseGroup ownership')
}
if (!formRuntime.includes('field.Readonly ?? field.ReadOnly')) {
  fail('readonly platform fields must remain visible but non-editable')
}
if (!formRuntime.includes("if (value === null || value === undefined || value === '') return '-'")) {
  fail('empty platform fields must render as dash values')
}
if (!businessDetail.includes('const groups = this.definition?.relatedGroups || this.definition?.groups || []') ||
  businessDetail.includes('(this.preset.sections || []).forEach') ||
  !moduleDetail.includes('const groups = this.config.definition?.groups || []')) {
  fail('detail pages must use platform CollapseGroup groups instead of local preset sections')
}
if (!formRuntime.includes('normalizeTableTabs(table)') ||
  !formRuntime.includes('field.formTabKey') ||
  !nativeForm.includes('v-if="formTabs.length > 1"') ||
  !moduleDetail.includes('v-if="formTabs.length > 1"') ||
  !businessDetail.includes('v-if="formTabs.length > 1"') ||
  !businessDetail.includes(':active-key="activeFormTabKey"')) {
  fail('form tabs must use platform diy_table.Tabs and hide when only one tab exists')
}
const nativeStandaloneRelatedLoop = nativeForm.includes('v-for="relatedTab in standaloneRelatedTabs"')
  ? 'v-for="relatedTab in standaloneRelatedTabs"'
  : 'v-for="relatedTab in activeRelatedTabs"'
if (nativeForm.indexOf('v-for="(group, groupIndex) in groups"') > nativeForm.indexOf(nativeStandaloneRelatedLoop) ||
  moduleDetail.indexOf('v-for="(group, index) in groups"') > moduleDetail.indexOf('v-for="relatedTab in activeRelatedTabs"') ||
  businessDetail.indexOf('v-for="(section, sectionIndex) in visibleSections"') > businessDetail.indexOf('v-for="relatedTab in standaloneRelatedTabs"')) {
  fail('ordinary tab fields must render before related table titles')
}
if (!nativeForm.includes('class="form-tabs--full"') ||
  !formTabs.includes('width: 100%') ||
  !formTabs.includes('padding: 0;')) {
  fail('form tab bar must fill the available page width')
}
if (!childTable.includes('删除此条') ||
  !childTable.includes('grid-column: 1 / -1') ||
  !childTable.includes('child-table__commands { flex: none; gap: 26rpx; }')) {
  fail('child table actions must keep add separate from toggle and place a large delete action below each row')
}
if (!businessList.includes('<mci-business-card') ||
  !businessList.includes('components: { MciBusinessCard }') ||
  !relatedBusinessList.includes('<mci-business-card') ||
  !relatedBusinessList.includes('components: { MciBusinessCard, MciTaskCard }') ||
  !relatedBusinessList.includes('getBusinessRowActions') ||
  !relatedBusinessList.includes('loadModuleViewManifest') ||
  !relatedBusinessList.includes('class="floating-add"')) {
  fail('standalone and related business lists must share cards, view metadata, row permissions and floating add')
}
if (!relatedBusinessList.includes('class="search-row"') ||
  !relatedBusinessList.includes('openAdvancedFilters') ||
  !relatedBusinessList.includes('buildFilterWhere()')) {
  fail('related business lists must preserve standalone search and advanced filters')
}
if (!relatedBusinessList.includes('displayMode: { type: String') ||
  !relatedBusinessList.includes('class="preview-actions"') ||
  !relatedBusinessList.includes('openMore()') ||
  !relatedBusinessPage.includes('<mci-business-related-list') ||
  !relatedBusinessPage.includes("'related-list-context'")) {
  fail('related business lists must provide a reusable preview and full-list page')
}
if (!businessDetail.includes('isCustomerAddressRelated(item)') ||
  !businessDetail.includes('display-mode="preview"') ||
  !businessDetail.includes('section.relatedTabs') ||
  !businessDetail.includes('groups.filter((group) => group.tabKey === this.activeFormTabKey)')) {
  fail('customer addresses must render inside their CollapseGroup as a preview list')
}
if (!relatedBusinessList.includes('!waitingForParentSave') ||
  !relatedBusinessList.includes('保存当前表单后可新增') ||
  !relatedBusinessList.includes('this.loading = false')) {
  fail('new parent forms must not leave related lists in a permanent skeleton state')
}
if (!taskList.includes('<mci-task-card') ||
  !taskList.includes('components: { MciTaskCard }') ||
  !relatedBusinessList.includes('<mci-task-card') ||
  !taskCard.includes('task-card__bottom')) {
  fail('standalone and related task lists must share the task card presentation')
}
for (const page of [nativeForm, moduleDetail, businessDetail]) {
  if (!page.includes('<mci-business-related-list v-if="relatedTab.type === \'child\'"') ||
    page.includes('<mci-child-table v-if="relatedTab.type === \'child\'"') ||
    !page.includes('components: { MciBusinessRelatedList }')) {
    fail('form tab child tables must use the same business list presentation as standalone entries')
  }
}
if (!businessCard.includes('card-actions') || !businessCard.includes('查看详情')) {
  fail('shared business card must preserve list row actions and detail navigation')
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
if (!nativeForm.includes('function createDraftRowId()') ||
  !nativeForm.includes(':parent-id="relationParentId"') ||
  !nativeForm.includes('Id: this.draftRowId') ||
  !nativeForm.includes("this.mode === 'Add' && !this.rowId && isFormEngineRecordAdapter(this.recordAdapter)")) {
  fail('new native forms must preallocate and preserve a parent row id for related records')
}
// zhy：未保存客户新增联系人后，必须通过保存事件回传完整记录并在父页草稿列表即时合并。
for (const token of [
  'row: savedRow',
  "parentValue: this.tableChildAuth?.ParentValue || ''"
]) {
  if (!nativeForm.includes(token)) fail(`native form saved-row event is missing: ${token}`)
}
for (const token of [
  'mergeDraftChangedRow(payload = {})',
  "String(this.parentMode || '').toLowerCase() !== 'add'",
  'payload.parentValue || row[this.childFkField]',
  'if (this.mergeDraftChangedRow(payload)) return'
]) {
  if (!relatedBusinessList.includes(token)) fail(`draft related-row merge is missing: ${token}`)
}
for (const token of [
  'customerAddressRelatedForGroup(group)',
  'getTenantFormRelatedPresentation',
  'display-mode="preview"',
  'v-for="relatedTab in standaloneRelatedTabs"'
]) {
  if (!nativeForm.includes(token)) fail(`embedded related CollapseGroup rendering is missing: ${token}`)
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
