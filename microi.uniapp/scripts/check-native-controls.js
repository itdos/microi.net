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
const tableSelector = fs.readFileSync(
  path.join(root, 'src/components/mci-table-selector/mci-table-selector.vue'),
  'utf8'
)
const moduleRegistry = fs.readFileSync(path.join(root, 'src/platform/module-registry.js'), 'utf8')
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
if (!formRuntime.includes('/手机|电话|座机|固话|phone|mobile|tel/i')) {
  fail('phone field inference must cover mobile, telephone and landline labels')
}
if (!renderer.includes('v-if="callablePhone" class="native-control__phone-action"') ||
  !renderer.includes('uni.makePhoneCall({ phoneNumber: this.callablePhone })') ||
  !renderer.includes("!['-', '—'].includes(value)")) {
  fail('readonly phone fields must provide a call action and hide it for empty values')
}
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
  !formRuntime.includes("if (field.component === 'Tabs')") ||
  !formRuntime.includes('Divider 只是组内分隔') ||
  !formRuntime.includes('NATIVE_FORM_SCHEMA_VERSION = 9')) {
  fail('related fields must preserve their platform CollapseGroup ownership')
}
if (!formRuntime.includes("const DEFAULT_FIELD_NAMES = new Set(['Id', 'CreateTime', 'UpdateTime', 'UserId', 'UserName', 'IsDeleted'])") ||
  !formRuntime.includes('configBoolean(table.DisplayDefaultField, false)') ||
  !formRuntime.includes('(options.displayDefaultField || !DEFAULT_FIELD_NAMES.has(field.Name))')) {
  fail('native forms must follow diy_table.DisplayDefaultField for platform audit fields')
}
if (!formRuntime.includes('field.Readonly ?? field.ReadOnly')) {
  fail('readonly platform fields must remain visible but non-editable')
}
if (!formRuntime.includes("if (value === null || value === undefined || value === '') return '-'")) {
  fail('empty platform fields must render as dash values')
}
if (!businessDetail.includes('const groups = this.definition?.relatedGroups || this.definition?.groups || []') ||
  businessDetail.includes('(this.preset.sections || []).forEach') ||
  !moduleDetail.includes('const groups = this.config.definition?.relatedGroups || this.config.definition?.groups || []')) {
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
const moduleStandaloneRelatedLoop = moduleDetail.includes('v-for="relatedTab in standaloneRelatedTabs"')
  ? 'v-for="relatedTab in standaloneRelatedTabs"'
  : 'v-for="relatedTab in activeRelatedTabs"'
if (nativeForm.indexOf('v-for="(group, groupIndex) in groups"') > nativeForm.indexOf(nativeStandaloneRelatedLoop) ||
  moduleDetail.indexOf('v-for="(group, index) in groups"') > moduleDetail.indexOf(moduleStandaloneRelatedLoop) ||
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
if (!businessDetail.includes('isEmbeddedChildRelated(item)') ||
  !businessDetail.includes('display-mode="preview"') ||
  !businessDetail.includes('section.relatedTabs') ||
  !businessDetail.includes('groups.filter((group) => group.tabKey === this.activeFormTabKey)')) {
  fail('TableChild fields must render inside their CollapseGroup as a preview list')
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
// zhy：跟进记录列表必须从基础租户配置识别长文本，并在微信端保留静态三行截断兜底。
if (!businessList.includes('this.baseConfig.summaryField || this.config.summaryField') ||
  !businessCard.includes('.field-value--multiline') ||
  !businessCard.includes('max-height: 102rpx') ||
  !businessCard.includes('-webkit-line-clamp: 3')) {
  fail('follow-up card long text must be clamped to three lines')
}
// zhy：原生详情页才是跟进记录实际入口，长文本必须限制为 11 行并支持滚动。
if (!nativeForm.includes(':readonly-max-lines="readonlyMaxLines(field)"') ||
  !nativeForm.includes('Number(module.detailSummaryLines) || 11') ||
  !renderer.includes('class="native-control__readonly-scroll" scroll-y') ||
  !renderer.includes('max-height: 495rpx')) {
  fail('native follow-up detail long text must scroll after eleven lines')
}
// zhy：确保客户方案设备联动和新增默认值不会在移动端回归中丢失。
for (const token of [
  "contractAttachment: 'HetongFJ'",
  "contractUploadState: 'IsDingdanHT'",
  "renewalOrderNumber: 'XQDingdanBH'",
  "renewalState: 'DingdanSFXQ'",
  "contractState: 'HetongZT'",
  "const ORDER_RENEWAL_TYPE = '老客户续签订单'",
  "[orderFieldName(context, 'contractState', '合同状态')]: '未断约'",
  "[orderFieldName(context, 'renewalState', '订单是否续签')]: '未续签'",
  "personValue(row, ['DingdanBH']) || payload.value || ''",
  'normalizeUploadItems(context.form[attachmentName]).length',
  "? '已上传'",
  ": '未上传'"
]) {
  if (!xjyTenantForm.includes(token)) fail(`xjy order contract upload rule is missing: ${token}`)
}
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
  'handleFieldChange(context, payload)',
  "installationPositionCount: 'ChangsuoDWSL'",
  'handleRelatedCount(context, payload = {})',
  'isProposalInstallationChild(payload.field)',
  'handleRelatedCount,',
  'V8.FormEngine.UptFormData(PROPOSAL_TABLE'
]) {
  if (!xjyTenantForm.includes(token)) fail(`xjy proposal form rule is missing: ${token}`)
}
if (!nativeForm.includes('@data-count="handleRelatedCount"') ||
  !nativeForm.includes('handleTenantFormRelatedCount(this.tenantFormContext(), payload)') ||
  !nativeForm.includes('...(wasAdd && this.draftRowId ? { Id: this.draftRowId } : {})') ||
  !relatedBusinessList.includes("'data-count'") ||
  !relatedBusinessList.includes('if (notifyCount) this.emitDataCount()') ||
  !relatedBusinessList.includes('uniqueRowsById(reset ? incomingRows') ||
  !xjyProposalCalculation.includes("'ChangsuoDWSL'")) {
  fail('native proposal form must link the installation child DataCount to its position count field')
}
if (!relatedBusinessList.includes('search-input-wrap') ||
  !relatedBusinessList.includes('@input="scheduleSearch"') ||
  !relatedBusinessList.includes('@tap="resetSearch"><text>重置</text>') ||
  !relatedBusinessList.includes(':adjust-position="false"') ||
  !relatedBusinessList.includes(':hold-keyboard="true"') ||
  relatedBusinessList.includes(':always-embed="true"')) {
  fail('related-list search must preserve the enhanced search UI without enabling the unstable native embed mode')
}
if (!relatedBusinessList.includes('<root-portal v-if="filterOpen && !isPreview">') ||
  !relatedBusinessList.includes('@touchmove.stop.prevent="noop"') ||
  !relatedBusinessList.includes('z-index: 9999')) {
  fail('related-list filter sheet must render at the page root and lock background scrolling')
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
  "this.moduleKey === 'customerCare'",
  'this.parentForm.BeibaiFR',
  'result.LianxiRID',
  'includeRelated: true',
  'showFloatingAdd',
  "this.$emit('floating-add-state'"
]) {
  if (!relatedBusinessList.includes(token)) fail(`nested related-form defaults are missing: ${token}`)
}
for (const token of [
  'parentTableChildAuth',
  'result.Parent = this.parentTableChildAuth',
  'parentTableChildAuth=${encodeURIComponent(JSON.stringify(this.parentTableChildAuth || null))}',
  'V8.FormEngine.GetTableData(this.config.table',
  '_TableChildAuth: this.tableChildAuth',
  'ModuleEngine 的子菜单数据范围会把已经正确绑定的孙表记录过滤成 0 条'
]) {
  if (!relatedBusinessList.includes(token)) fail(`nested TableChild authorization chain is missing: ${token}`)
}
if (!nativeForm.includes(':parent-table-child-auth="tableChildAuth"')) {
  fail('native nested related lists must forward the parent TableChild authorization chain')
}
for (const token of [
  'class="related-floating-add"',
  ':show-floating-add="false"',
  'openStandaloneRelatedAdd()',
  'setStandaloneRelatedAddState(tab, available)',
  '客户详情 Tab 的新增按钮必须挂在 scroll-view 外'
]) {
  if (!businessDetail.includes(token)) fail(`page-level related-list floating action is missing: ${token}`)
}
for (const token of [
  ':class="{ expanded: previewExpanded }">›</text>',
  '.preview-section-header__arrow.expanded { transform: rotate(-90deg); }',
  '.preview-section-header ~ .related-empty { width: auto; margin: 18rpx 22rpx 0; }'
]) {
  if (!relatedBusinessList.includes(token)) fail(`related preview spacing/toggle style is missing: ${token}`)
}
if (businessDetail.includes('<text>补充说明</text>')) {
  fail('business detail must not render the duplicate supplementary summary section')
}
if (!nativeForm.includes('.filter((field) => this.tenantFieldPresentation(field).visible !== false)') ||
  !businessDetail.includes('this.tenantDetailFieldPresentation(field).visible !== false')) {
  fail('tenant conditional field visibility must apply to form validation and business details')
}
for (const token of [
  'CUSTOMER_CARE_FIELDS',
  'customerCareTotalValues(context',
  'loadCustomerCareContacts(context)',
  "field.component = 'MultipleSelect'",
  "CUSTOMER_CARE_FIELDS.quantity.toLowerCase()",
  "CUSTOMER_CARE_FIELDS.unitPrice.toLowerCase()",
  '项目合伙人跟进记录与普通跟进记录使用同一组核心字段',
  '].every((name) => Boolean(findField(context, name)))',
  "!String((context.defaultValues || {})[timeName] || '').trim()"
]) {
  if (!xjyTenantForm.includes(token)) fail(`customer-care form linkage is missing: ${token}`)
}
const mediaUploader = fs.readFileSync(path.join(root, 'src/components/mci-media-uploader/mci-media-uploader.vue'), 'utf8')
const microiV8 = fs.readFileSync(path.join(root, 'src/utils/microi.v8.js'), 'utf8')
const hdfsController = fs.readFileSync(
  path.join(workspaceRoot, 'Microi.Server/Microi.net.Api/Controllers/HDFSController.cs'),
  'utf8'
)
for (const token of [
  'localPath: filePath',
  '@error="handleMediaError(item)"',
  'PreviewURL,',
  'resolveFailures',
  'lastEmittedValue',
  'preferProvidedUrl'
]) {
  if (!mediaUploader.includes(token)) fail(`durable media preview handling is missing: ${token}`)
}
for (const token of [
  'FormEngineKey: options.formEngineKey',
  'FormDataId: options.formDataId',
  'FieldId: options.fieldId',
  'SysMenuId: options.sysMenuId'
]) {
  if (!microiV8.includes(token)) fail(`private media authorization context is missing: ${token}`)
}
for (const token of [
  'AttachUploadedFileUrls',
  'item["Url"]',
  'item["Limit"]',
  'GetPrivateFileUrl(new DiyUploadParam'
]) {
  if (!hdfsController.includes(token)) fail(`upload response preview capability is missing: ${token}`)
}
if (microiV8.includes('xjy\\/img|xjyimg|upload')) {
  fail('private form uploads must not be classified as permanent public assets')
}
if (!childTable.includes('includeRelated: true')) {
  fail('legacy TableChild forms must preserve nested related records')
}
for (const token of [
  'embeddedChildRelatedForGroup(group)',
  "item?.type === 'child' && Boolean(item.field?.layoutGroupKey)",
  'display-mode="preview"',
  'v-for="relatedTab in standaloneRelatedTabs"'
]) {
  if (!nativeForm.includes(token)) fail(`embedded related CollapseGroup rendering is missing: ${token}`)
}
for (const [source, name] of [
  [nativeForm, 'native form detail'],
  [businessDetail, 'business detail'],
  [moduleDetail, 'module detail']
]) {
  for (const token of [
    'isEmbeddedChildRelated(item)',
    'item.field.layoutGroupKey === group.key',
    'display-mode="preview"',
    'v-for="relatedTab in standaloneRelatedTabs"'
  ]) {
    if (!source.includes(token)) fail(`${name} embedded child rendering is missing: ${token}`)
  }
  if (!source.includes('show-preview-header')) {
    fail(`${name} standalone TableChild must use the shared collapsible preview section`)
  }
}
for (const [source, name] of [
  [nativeForm, 'native form detail'],
  [businessDetail, 'business detail'],
  [moduleDetail, 'module detail']
]) {
  for (const token of [
    'isEmbeddedOpenTableRelated(item)',
    "item?.type === 'openTable' && Boolean(item.field?.layoutGroupKey)",
    'isEmbeddedRelated(item)',
    '!this.isEmbeddedRelated(item)',
    'compact'
  ]) {
    if (!source.includes(token)) fail(`${name} embedded OpenTable rendering is missing: ${token}`)
  }
}
if (!nativeForm.includes('form-section__selector-grid') ||
  !businessDetail.includes('section-selector-grid') ||
  !moduleDetail.includes('detail-section__selector-grid') ||
  !tableSelector.includes("'selector-field--compact': compact") ||
  !tableSelector.includes('compact: { type: Boolean, default: false }')) {
  fail('embedded OpenTable actions must use the shared compact two-column presentation')
}
for (const token of [
  '<root-portal v-if="visible">',
  'height: 0; min-height: 0; flex: 1',
  'loadGrantedMenuDefinition(this.targetMenuId)',
  'this.menuDefinition.cardFields',
  'this.menuDefinition.searchFields'
]) {
  if (!tableSelector.includes(token)) fail(`OpenTable mobile selector layout/configuration is missing: ${token}`)
}
for (const token of [
  'export async function loadGrantedMenuDefinition',
  "findMenu([], '', refresh, menuId)",
  'cardFields: uniqueFieldNames',
  'searchFields: configuredSearch'
]) {
  if (!moduleRegistry.includes(token)) fail(`OpenTable granted menu field configuration is missing: ${token}`)
}
for (const token of [
  'showPreviewHeader',
  'previewContentVisible',
  'preview-section-header',
  "Boolean(value && !this.isPreview)"
]) {
  if (!relatedBusinessList.includes(token)) fail(`related TableChild preview section is missing: ${token}`)
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
