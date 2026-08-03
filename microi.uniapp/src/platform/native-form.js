import { V8, getUser, post } from '@/utils/request.js'
import {
  dedupeRequest,
  readCache,
  removeCachePrefix,
  writeCache
} from '@/platform/cache.js'
import nativeControls from '@/config/mci-native-controls.json'
import { formatRegionValue, formatStructuredValue } from '@/platform/display.js'
import {
  filterFieldsByHiddenCollapseScope,
  nativeFieldRoleVisibility,
  nativeRoleCacheKey
} from '@/platform/native-field-visibility.mjs'

const LAYOUT_COMPONENTS = new Set(nativeControls.layout)
const RELATED_COMPONENTS = new Set(nativeControls.related)
const READONLY_COMPONENTS = new Set(nativeControls.readonly)
const GUARDED_COMPONENTS = new Set(nativeControls.guarded)
const HIDDEN_NAMES = new Set(['Id', 'CreateTime', 'UpdateTime', 'CreateUserId', 'UpdateUserId', 'OsClient'])
const SENSITIVE_FIELD_PATTERN = /password|passwd|pwd|secret|token|openid|unionid|密码|密钥|令牌/i
const OPTION_COMPONENTS = new Set([
  'Select', 'MultipleSelect', 'Radio', 'Checkbox', 'Autocomplete', 'Cascader',
  'SelectTree', 'TreeCheckbox', 'Department', 'Transfer'
])
const MULTIPLE_COMPONENTS = new Set(['Checkbox', 'MultipleSelect', 'TreeCheckbox', 'Transfer'])
const COMPONENT_ALIASES = { HTML: 'Html', Date: 'DateTime' }
const IMAGE_NAME_PATTERN = /(^|_)(avatar|headimg|headimage|photo|image|img)(_|$)|avatar|headimg|touxiang/i
const IMAGE_LABEL_PATTERN = /头像|微信头像|个人照片|证件照/

function relatedFieldLabel(field, component, config) {
  const current = String(field.Label || '').trim()
  if (current) return current
  if (component === 'TableChild') {
    return String(config.TableChildSysMenuName || config.TableChild?.Title || config.TableChild?.Name || '').trim()
  }
  if (component === 'JoinForm') {
    const join = config.JoinForm || {}
    return String(join.ModuleName || join.TableLabel || join.TableName || '').trim()
  }
  if (component === 'JoinTable') {
    const join = config.JoinTable || {}
    return String(join.ModuleName || join.TableLabel || join.TableName || '').trim()
  }
  if (component === 'OpenTable') {
    const open = config.OpenTable || {}
    return String(open.BtnName || open.BtnText || open.SysMenuName || open.TableLabel || open.TableName || '').trim()
  }
  return current
}

export function parseJson(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch (error) { return fallback }
}

function parseKeyValue(text) {
  return String(text || '').split(',').map((item) => {
    const [key, ...label] = item.split('|')
    return { value: String(key || '').trim(), label: String(label.join('|') || key || '').trim() }
  }).filter((item) => item.value || item.label)
}

export function normalizeOptions(field) {
  const config = parseJson(field.Config, {}) || {}
  const data = parseJson(field.Data, field.Data)
  let rows = []
  if (Array.isArray(data)) rows = data
  else if (data && typeof data === 'object') rows = data.Data || data.Rows || []
  else if (typeof data === 'string') rows = parseKeyValue(data)
  const valueKey = config.SelectSaveField || config.SaveField || 'value'
  const labelKey = config.SelectLabel || config.LabelField || 'label'
  return rows.map((item) => {
    if (item === null || item === undefined) return null
    if (typeof item !== 'object') return { value: String(item), label: String(item), raw: item }
    const value = item[valueKey] ?? item.Key ?? item.Id ?? item.value ?? item.Value
    const label = item[labelKey] ?? item.Value ?? item.Name ?? item.Label ?? item.label ?? value
    return { value, label: String(label ?? ''), raw: item }
  }).filter(Boolean)
}

function configBoolean(value, fallback = false) {
  if (value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true') return true
  if (value === false || value === 0 || value === '0' || String(value).toLowerCase() === 'false') return false
  return fallback
}

export function isNativeFieldMultiple(field = {}) {
  const config = field.config || parseJson(field.Config, {}) || {}
  if (Object.prototype.hasOwnProperty.call(config, 'MultipleSelect')) {
    return configBoolean(config.MultipleSelect, MULTIPLE_COMPONENTS.has(String(field.component || field.Component || '')))
  }
  return MULTIPLE_COMPONENTS.has(String(field.component || field.Component || ''))
}

export function nativeFieldOptionSource(field = {}) {
  const config = field.config || parseJson(field.Config, {}) || {}
  return config.DataSource || (config.Sql ? 'Sql' : config.DataSourceId ? 'DataSource' : config.DataSourceApiEngineKey ? 'ApiEngine' : config.Api ? 'Api' : 'Data')
}

export function isRemoteNativeFieldOptions(field = {}) {
  return field.component === 'Department' || ['Sql', 'DataSource', 'ApiEngine', 'Api'].includes(nativeFieldOptionSource(field))
}

export function isRemoteNativeFieldSearch(field = {}) {
  const config = field.config || parseJson(field.Config, {}) || {}
  return configBoolean(config.DataSourceSqlRemote, false)
}

export function filterNativeFieldOptions(options = [], keyword = '') {
  const query = String(keyword || '').trim().toLowerCase()
  if (!query) return Array.isArray(options) ? options : []
  const searchableKeys = [
    'Name', 'name', 'Xingming', 'xingming', 'RealName', 'realName',
    'Phone', 'phone', 'Mobile', 'mobile', 'ShoujiH', 'LianxiDH',
    'Account', 'account', 'No', 'no', 'Id', 'id'
  ]
  return (Array.isArray(options) ? options : []).filter((option) => {
    const values = [option && option.label, option && option.value]
    const raw = option && option.raw
    if (raw && typeof raw === 'object') {
      searchableKeys.forEach((key) => {
        if (raw[key] !== undefined && raw[key] !== null) values.push(raw[key])
      })
      Object.keys(raw).forEach((key) => {
        const value = raw[key]
        if (value !== null && value !== undefined && ['string', 'number'].includes(typeof value)) values.push(value)
      })
    }
    return values.some((value) => String(value ?? '').toLowerCase().includes(query))
  })
}

export function inferNativeComponent(field) {
  const raw = String(field.Component || 'Text')
  const component = COMPONENT_ALIASES[raw] || raw
  const name = String(field.Name || '')
  const label = String(field.Label || '')
  if (component === 'Text' && (IMAGE_NAME_PATTERN.test(name) || IMAGE_LABEL_PATTERN.test(label))) return 'ImgUpload'
  return component
}

function inputMode(field, component) {
  const text = `${field.Name || ''} ${field.Label || ''}`
  if (/密码|password|pwd/i.test(text)) return 'password'
  if (/手机|电话|phone|mobile|tel/i.test(text)) return 'tel'
  if (/邮箱|email/i.test(text)) return 'email'
  if (/网址|链接|url|website/i.test(text)) return 'url'
  if (component === 'NumberText') return 'digit'
  return 'text'
}

export function normalizeField(field, options = {}) {
  const component = inferNativeComponent(field)
  const optionRows = normalizeOptions(field)
  const config = parseJson(field.Config, {}) || {}
  const selectable = OPTION_COMPONENTS.has(component)
  const relationLabel = relatedFieldLabel(field, component, config)
  const roleVisibility = nativeFieldRoleVisibility(field, options.user || getUser() || {})
  return {
    ...field,
    Label: relationLabel || field.Label,
    component,
    config,
    options: optionRows,
    bindRoleIds: roleVisibility.bindRoleIds,
    multiple: isNativeFieldMultiple({ ...field, component, config }),
    optionsRemote: isRemoteNativeFieldOptions({ ...field, component, config }),
    inputMode: inputMode(field, component),
    editable: !configBoolean(field.Readonly ?? field.ReadOnly, false) &&
      !LAYOUT_COMPONENTS.has(component) &&
      !RELATED_COMPONENTS.has(component) &&
      !READONLY_COMPONENTS.has(component) &&
      !GUARDED_COMPONENTS.has(component) &&
      !HIDDEN_NAMES.has(field.Name),
    required: Number(field.NotEmpty || 0) === 1,
    visible: roleVisibility.visible && Number(field.AppVisible ?? field.Visible ?? 1) !== 0 && Number(field.IsVirtual || 0) !== 1 &&
      !SENSITIVE_FIELD_PATTERN.test(`${field.Name || ''} ${field.Label || ''}`),
    placeholder: field.Placeholder || `${selectable || ['DateTime', 'Address', 'Map', 'MapArea', 'ColorPicker'].includes(component) ? '请选择' : '请输入'}${field.Label || field.Name}`
  }
}

export function normalizeTableTabs(tableModel = {}) {
  const rawTabs = parseJson(tableModel.Tabs, [])
  if (!Array.isArray(rawTabs)) return []
  return rawTabs
    .map((tab, index) => {
      const source = tab && typeof tab === 'object' ? tab : { Name: tab }
      const name = String(source.Name || source.Label || source._RawName || source.EnName || '').trim()
      const id = String(source.Id || source.id || '').trim()
      const key = id || name || `tab:${index}`
      return {
        key,
        id,
        name,
        label: name,
        icon: String(source.Icon || '').trim(),
        sort: Number.isFinite(Number(source.Sort)) ? Number(source.Sort) : index,
        sourceIndex: index,
        display: configBoolean(source.Display, true),
        aliases: [id, name, source.EnName, source._RawName]
          .map((value) => String(value || '').trim().toLowerCase())
          .filter(Boolean)
      }
    })
    .filter((tab) => tab.display && tab.name)
    .sort((left, right) => left.sort - right.sort || left.sourceIndex - right.sourceIndex)
}

function assignFieldFormTabs(fields, tableTabs) {
  const tabs = Array.isArray(tableTabs) ? tableTabs : []
  const fallback = tabs[0] || null
  ;(fields || []).forEach((field) => {
    const value = String(field.Tab || '').trim().toLowerCase()
    const matched = tabs.find((tab) => tab.aliases.includes(value)) || fallback
    field.formTabKey = matched ? matched.key : '__basic__'
    field.formTabName = matched ? matched.name : ''
  })
}

export function groupFields(fields, tableModel = {}) {
  const groups = []
  const activeGroups = new Map()
  const looseGroups = new Map()
  const createLooseGroup = (tabKey) => {
    const group = {
      key: `ungrouped:${tabKey}:${groups.length}`,
      name: '',
      fields: [],
      source: 'Ungrouped',
      defaultExpanded: true,
      tabKey,
      tabName: ''
    }
    looseGroups.set(tabKey, group)
    groups.push(group)
    return group
  }
  fields.forEach((field) => {
    if (!field.visible) return
    const rawTab = field.Tab && field.Tab !== 'none' ? String(field.Tab) : ''
    const tabKey = field.formTabKey || rawTab || '__basic__'
    if (field.component === 'CollapseGroup') {
      const collapse = field.config?.CollapseGroup || {}
      const scopeMode = String(collapse.ScopeMode || 'UntilNextGroup').toLowerCase()
      const configuredCount = Math.max(0, Number(collapse.FieldCount || 0))
      const fieldCount = scopeMode === 'fieldcount'
        ? (configuredCount || Number.POSITIVE_INFINITY)
        : Number.POSITIVE_INFINITY
      const group = {
        key: String(field.Id || field.Name || `collapse:${groups.length}`),
        name: String(field.Label || field.Name || '').trim(),
        fields: [],
        relatedFields: [],
        source: 'CollapseGroup',
        defaultExpanded: !configBoolean(collapse.DefaultCollapsed, false),
        description: String(collapse.Description || field.Description || '').trim(),
        icon: String(collapse.Icon || '').trim(),
        theme: String(collapse.Theme || 'default').trim(),
        showFieldCount: configBoolean(collapse.ShowFieldCount, true),
        scopeMode: scopeMode === 'fieldcount' ? 'FieldCount' : 'UntilNextGroup',
        fieldCount,
        tabKey,
        tabName: field.formTabName || ''
      }
      groups.push(group)
      activeGroups.set(tabKey, { group, remaining: fieldCount })
      looseGroups.delete(tabKey)
      return
    }
    if (LAYOUT_COMPONENTS.has(field.component)) {
      activeGroups.delete(tabKey)
      looseGroups.delete(tabKey)
      return
    }
    if (RELATED_COMPONENTS.has(field.component)) {
      const active = activeGroups.get(tabKey)
      if (active && active.remaining > 0) {
        field.layoutGroupKey = active.group.key
        active.group.relatedFields.push(field)
        if (Number.isFinite(active.remaining)) {
          active.remaining -= 1
          if (active.remaining <= 0) {
            activeGroups.delete(tabKey)
            looseGroups.delete(tabKey)
          }
        }
      }
      return
    }
    if (GUARDED_COMPONENTS.has(field.component)) return

    const active = activeGroups.get(tabKey)
    if (active && active.remaining > 0) {
      active.group.fields.push(field)
      if (Number.isFinite(active.remaining)) {
        active.remaining -= 1
        if (active.remaining <= 0) {
          activeGroups.delete(tabKey)
          looseGroups.delete(tabKey)
        }
      }
      return
    }

    const loose = looseGroups.get(tabKey) || createLooseGroup(tabKey)
    loose.fields.push(field)
  })
  return groups.filter((group) => group.fields.length || group.relatedFields?.length)
}

function buildDefinition(table, fields, layoutFields = fields) {
  const formTabs = normalizeTableTabs(table)
  assignFieldFormTabs(layoutFields, formTabs)
  if (layoutFields !== fields) assignFieldFormTabs(fields, formTabs)
  // A role-hidden CollapseGroup remains a logical boundary while its complete
  // field range is removed, preventing child tables from leaking elsewhere.
  const visibleFields = filterFieldsByHiddenCollapseScope(fields, {
    layoutComponents: LAYOUT_COMPONENTS,
    guardedComponents: GUARDED_COMPONENTS
  })
  const layoutGroups = groupFields(visibleFields, table)
  const uniqueRelated = (component) => {
    const seen = new Set()
    return visibleFields.filter((field) => {
      if (field.component !== component) return false
      const config = field.config || {}
      const target = component === 'TableChild'
        ? config.TableChildTableId
        : (config[component] || {}).TableId || (config[component] || {}).TableName || field.Name
      const relationKey = component === 'TableChild'
        ? (config.TableChildFkFieldName || config.TableChild?.FkFieldName || '')
        : (field.Name || field.Id || '')
      const key = `${component}:${target || field.Name || field.Id || ''}:${relationKey}`.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
  return {
    table,
    fields: visibleFields,
    layoutFields,
    formTabs,
    groups: layoutGroups.filter((group) => group.fields.length),
    relatedGroups: layoutGroups,
    childFields: uniqueRelated('TableChild'),
    joinFields: uniqueRelated('JoinForm'),
    openTableFields: uniqueRelated('OpenTable'),
    joinTableFields: uniqueRelated('JoinTable')
  }
}

export function createNativeFormDefinition(table = {}, rawFields = [], options = {}) {
  const user = options.user || getUser() || {}
  const layoutFields = (Array.isArray(rawFields) ? rawFields : []).map((field) => normalizeField(field, { user }))
  return buildDefinition(table, layoutFields, layoutFields)
}

export const NATIVE_FORM_SCHEMA_VERSION = 7
const FORM_VERSION_MAX_AGE = 30 * 1000
const FORM_DEFINITION_MAX_AGE = 30 * 24 * 60 * 60 * 1000

function hashText(value) {
  let hash = 2166136261
  const text = String(value || '')
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function definitionFingerprint(table, fields) {
  const source = {
    schema: NATIVE_FORM_SCHEMA_VERSION,
    table: [
      table && table.Id,
      table && table.UpdateTime,
      table && table.Tabs,
      table && table.Name
    ],
    fields: (fields || []).map((field) => [
      field.Id,
      field.UpdateTime,
      field.Name,
      field.Sort,
      field.Visible,
      field.AppVisible,
      field.Component,
      field.BindRole
    ])
  }
  return hashText(JSON.stringify(source))
}

function definitionAuthorizationScope(options = {}) {
  const tableChildAuth = options.tableChildAuth || {}
  const childScope = [
    tableChildAuth.ParentSysMenuId,
    tableChildAuth.ParentTableId,
    tableChildAuth.ParentFieldId
  ].filter(Boolean).join(':')
  return String(options.menuId || options.moduleEngineKey || childScope || 'granted-menu')
}

function definitionKeys(tableName, options = {}) {
  const normalized = String(tableName || '').trim().toLowerCase()
  const user = options.user || getUser() || {}
  const identity = String(user.Id || user.Account || 'guest').toLowerCase()
  const scope = hashText(definitionAuthorizationScope(options))
  const roleScope = hashText(nativeRoleCacheKey(user))
  return {
    version: `form-definition-version:v${NATIVE_FORM_SCHEMA_VERSION}:${identity}:${roleScope}:${scope}:${normalized}`,
    definition: (fingerprint) =>
      `form-definition:v${NATIVE_FORM_SCHEMA_VERSION}:${identity}:${roleScope}:${scope}:${normalized}:${fingerprint}`,
    request: `form-definition-request:v${NATIVE_FORM_SCHEMA_VERSION}:${identity}:${roleScope}:${scope}:${normalized}`
  }
}

function metadataAuthorizationParams(options = {}) {
  const result = {}
  if (options.menuId) result._SysMenuId = options.menuId
  if (options.moduleEngineKey) result.ModuleEngineKey = options.moduleEngineKey
  if (options.tableChildAuth) result._TableChildAuth = options.tableChildAuth
  return result
}

export async function loadNativeTableModel(tableKey, options = {}) {
  const tableResult = await V8.FormEngine.GetDiyTableModel(
    String(tableKey || ''),
    metadataAuthorizationParams(options)
  )
  if (!tableResult || Number(tableResult.Code) !== 1 || !tableResult.Data) {
    throw new Error((tableResult && tableResult.Msg) || `未找到表单 ${tableKey}`)
  }
  return tableResult.Data
}

async function requestFullDefinition(tableName, options = {}) {
  const authorization = metadataAuthorizationParams(options)
  // 关联组件通常已经按 TableChildTableId 读取过模型，直接复用，避免同一挂载
  // 连续请求两次 GetDiyTableModel。
  const table = options.tableModel && options.tableModel.Id
    ? options.tableModel
    : await loadNativeTableModel(tableName, options)
  const fieldResult = await V8.FormEngine.GetDiyFieldList({
    TableId: table.Id,
    TableName: table.Name || tableName,
    ...authorization,
    _OrderBy: 'Sort',
    _OrderByType: 'ASC',
    _PageIndex: 1,
    _PageSize: 1000
  })
  if (!fieldResult || Number(fieldResult.Code) !== 1) {
    throw new Error((fieldResult && fieldResult.Msg) || '字段配置加载失败')
  }
  const rawFields = fieldResult.Data || []
  const definition = createNativeFormDefinition(table, rawFields, options)
  return {
    fingerprint: definitionFingerprint(table, rawFields),
    definition
  }
}

export async function loadNativeFormDefinition(tableName, refresh = false, options = {}) {
  const keys = definitionKeys(tableName, options)
  const cachedVersion = refresh ? null : readCache(keys.version, FORM_VERSION_MAX_AGE)
  if (cachedVersion && !cachedVersion.stale) {
    const cachedDefinition = readCache(keys.definition(cachedVersion.data), FORM_DEFINITION_MAX_AGE)
    if (cachedDefinition) return JSON.parse(JSON.stringify(cachedDefinition.data))
  }

  const staleVersion = readCache(keys.version, FORM_DEFINITION_MAX_AGE)
  try {
    const full = await dedupeRequest(
      keys.request,
      () => requestFullDefinition(tableName, options)
    )
    full.definition.schemaFingerprint = full.fingerprint
    full.definition.schemaVersion = NATIVE_FORM_SCHEMA_VERSION
    writeCache(keys.version, full.fingerprint)
    writeCache(keys.definition(full.fingerprint), full.definition)
    return JSON.parse(JSON.stringify(full.definition))
  } catch (error) {
    const fingerprint = staleVersion && staleVersion.data
    const staleDefinition = fingerprint
      ? readCache(keys.definition(fingerprint), FORM_DEFINITION_MAX_AGE)
      : null
    if (staleDefinition) return JSON.parse(JSON.stringify(staleDefinition.data))
    throw error
  }
}

export function scopeNativeFormDefinition(definition, options = {}) {
  if (!definition) return definition
  const include = new Set((options.includeNames || []).map((name) => String(name).toLowerCase()))
  const exclude = new Set((options.excludeNames || []).map((name) => String(name).toLowerCase()))
  const readonly = new Set((options.readonlyNames || []).map((name) => String(name).toLowerCase()))
  const fields = (definition.fields || []).filter((field) => {
    const name = String(field.Name || '').toLowerCase()
    if (exclude.has(name)) return false
    if (LAYOUT_COMPONENTS.has(field.component)) return true
    return !include.size || include.has(name)
  }).map((field) => ({
    ...field,
    editable: readonly.has(String(field.Name || '').toLowerCase()) ? false : field.editable
  }))
  return buildDefinition(definition.table || {}, fields, definition.layoutFields || definition.fields || [])
}

export function applyNativeFormViewDefinition(definition, formConfig) {
  if (!definition || !formConfig || !Array.isArray(formConfig.sections) || !formConfig.sections.length) {
    return definition
  }
  const viewFields = new Map()
  const hidden = new Set()
  formConfig.sections.forEach((section) => {
    ;(section.fields || []).forEach((item) => {
      const name = String(item.name || item.Name || '').toLowerCase()
      if (!name) return
      if (item.hidden === true || item.Hidden === true) {
        hidden.add(name)
        return
      }
      viewFields.set(name, {
        label: item.label || item.Label || '',
        viewWidth: item.mobileWidth || item.MobileWidth || item.width || item.Width || null,
        viewFormat: item.format || item.Format || ''
      })
    })
  })

  const fields = (definition.fields || []).filter((field) => {
    if (LAYOUT_COMPONENTS.has(field.component)) return true
    return !hidden.has(String(field.Name || '').toLowerCase())
  }).map((field) => {
    const viewField = viewFields.get(String(field.Name || '').toLowerCase())
    if (!viewField) return field
    return {
      ...field,
      Label: viewField.label || field.Label,
      viewWidth: viewField.viewWidth,
      viewFormat: viewField.viewFormat
    }
  })
  const result = buildDefinition(definition.table || {}, fields, definition.layoutFields || definition.fields || [])
  return {
    ...result,
    schemaFingerprint: definition.schemaFingerprint,
    schemaVersion: definition.schemaVersion,
    viewConfig: formConfig
  }
}

function currentOptionRows(field, form) {
  const raw = form[field.Name]
  const values = Array.isArray(raw) ? raw : parseJson(raw, raw ? [raw] : [])
  return (Array.isArray(values) ? values : [values]).filter((item) => item && typeof item === 'object')
}

// zhy: 限制单个远程选项请求的等待时间，避免异常数据源永久占用表单加载流程。
function withTimeout(promise, timeoutMs, message) {
  const duration = Math.max(1000, Number(timeoutMs || 10000))
  let timer = null
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message || '选项加载超时，请稍后重试')), duration)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

async function requestFieldOptions(field, form, options = {}) {
  const config = field.config || {}
  const dataSource = nativeFieldOptionSource(field)
  const pageIndex = Math.max(1, Number(options.pageIndex || 1))
  const pageSize = Math.max(1, Number(options.pageSize || 20))
  const common = {
    _FieldId: field.Id,
    _FormData: form,
    _Keyword: String(options.keyword || '').trim(),
    _PageIndex: pageIndex,
    _PageSize: pageSize
  }
  if (options.menuId) common._SysMenuId = options.menuId
  if (options.moduleEngineKey) common.ModuleEngineKey = options.moduleEngineKey
  if (options.tableChildAuth) common._TableChildAuth = options.tableChildAuth
  if (dataSource === 'Sql' && config.Sql) {
    return post('/api/FormEngine/GetDiyFieldSqlData', common, true)
  }
  if (dataSource === 'DataSource' && config.DataSourceId) {
    return post('/api/DataSourceEngine/Run', { ...common, DataSourceKey: config.DataSourceId }, true)
  }
  if (dataSource === 'ApiEngine' && config.DataSourceApiEngineKey) {
    return V8.ApiEngine.Run(config.DataSourceApiEngineKey, common, { checkCode: false })
  }
  if (dataSource === 'Api' && config.Api) {
    return post(config.Api, common, true)
  }
  if (field.component === 'Department') {
    return V8.FormEngine.GetTableDataTree('Sys_Dept', {
      _Keyword: common._Keyword,
      _PageIndex: pageIndex,
      _PageSize: pageSize
    })
  }
  return null
}

function flattenOptionTree(rows, output = []) {
  ;(Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!row) return
    output.push(row)
    flattenOptionTree(row._Child || row.children || row.Children, output)
  })
  return output
}

function optionResponseRows(field, result) {
  const payload = result && result.Data
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? (payload.Data || payload.Rows || payload.List || [])
      : []
  return field.component === 'Department' ? flattenOptionTree(rows) : (Array.isArray(rows) ? rows : [])
}

function optionResponseTotal(result) {
  const payload = result && result.Data
  const candidates = [
    result && result.DataCount,
    result && result.Total,
    result && result.Count,
    payload && !Array.isArray(payload) && payload.DataCount,
    payload && !Array.isArray(payload) && payload.Total,
    payload && !Array.isArray(payload) && payload.Count
  ]
  const value = candidates.find((item) => item !== undefined && item !== null && item !== '')
  return value === undefined ? null : Math.max(0, Number(value) || 0)
}

export async function loadNativeFieldOptionPage(field, form = {}, options = {}) {
  const pageIndex = Math.max(1, Number(options.pageIndex || 1))
  const pageSize = Math.max(1, Number(options.pageSize || 20))
  const keyword = String(options.keyword || '').trim()
  const remoteSearch = isRemoteNativeFieldSearch(field)
  const result = await withTimeout(
    requestFieldOptions(field, form, {
      pageIndex,
      pageSize,
      keyword: remoteSearch ? keyword : '',
      menuId: options.menuId,
      moduleEngineKey: options.moduleEngineKey,
      tableChildAuth: options.tableChildAuth
    }),
    options.timeoutMs,
    `${field.Label || field.Name || '选项'}加载超时，请稍后重试`
  )
  if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '选项加载失败')

  let rows = optionResponseRows(field, result)
  const total = optionResponseTotal(result)
  let normalized = normalizeOptions({ ...field, Data: rows, Config: field.config || {} })
  const rawCount = normalized.length
  const backendReturnedUnpaged = total === null && rawCount > pageSize

  // Microi 仅在 DataSourceSqlRemote=true 时保证服务端处理 _Keyword。
  // 对当前返回页再做本地过滤，兼容旧数据源，并支持姓名、电话、账号检索。
  if (keyword) normalized = filterNativeFieldOptions(normalized, keyword)

  return {
    options: normalized,
    total: total === null ? (backendReturnedUnpaged ? normalized.length : 0) : total,
    totalKnown: (remoteSearch && total !== null) || backendReturnedUnpaged,
    hasMore: total === null
      ? rawCount >= pageSize && !backendReturnedUnpaged
      : pageIndex * pageSize < total,
    clientPaging: backendReturnedUnpaged,
    remoteSearch
  }
}

// zhy: 视图配置会复制分组字段；选项接口返回后需把状态同步到同名渲染副本，否则接口有数据但单选项仍显示为空。
function syncNativeFieldOptionState(definition, sourceField) {
  const fieldName = String(sourceField && sourceField.Name || '').toLowerCase()
  if (!fieldName) return
  const targets = [
    ...(definition.fields || []),
    ...(definition.groups || []).reduce((rows, group) => rows.concat(group.fields || []), [])
  ]
  targets.forEach((target) => {
    if (!target || target === sourceField || String(target.Name || '').toLowerCase() !== fieldName) return
    target.Data = sourceField.Data
    target.options = sourceField.options
    target.optionsLoading = sourceField.optionsLoading
    target.optionError = sourceField.optionError
  })
}

export async function hydrateNativeFormOptions(definition, form, options = {}) {
  if (!definition || !Array.isArray(definition.fields)) return definition
  // zhy: 下拉框改为打开时按需加载，避免成功返回的大型客户SQL结果阻塞编辑页主线程。
  const fields = definition.fields.filter((field) =>
    OPTION_COMPONENTS.has(field.component) &&
    (options.eagerDropdowns === true || ['Radio', 'Checkbox'].includes(field.component))
  )
  let cursor = 0
  const worker = async () => {
    while (cursor < fields.length) {
      const field = fields[cursor++]
      const config = field.config || {}
      const inferredSource = config.DataSource || (config.Sql ? 'Sql' : config.DataSourceId ? 'DataSource' : config.DataSourceApiEngineKey ? 'ApiEngine' : config.Api ? 'Api' : '')
      const requiresRemote = field.component === 'Department' || ['Sql', 'DataSource', 'ApiEngine', 'Api'].includes(inferredSource)
      if (!requiresRemote) continue
      field.optionsLoading = true
      syncNativeFieldOptionState(definition, field)
      try {
        const page = await loadNativeFieldOptionPage(field, form, {
          pageIndex: 1,
          pageSize: 20,
          menuId: options.menuId,
          moduleEngineKey: options.moduleEngineKey,
          tableChildAuth: options.tableChildAuth,
          timeoutMs: options.timeoutMs
        })
        const rows = [...page.options.slice(0, 20).map((item) => item.raw)]
        currentOptionRows(field, form).forEach((current) => {
          const saveKey = config.SelectSaveField || config.SelectLabel || 'Id'
          const currentKey = current[saveKey] ?? current.Id
          if (!rows.some((item) => item && typeof item === 'object' && String(item[saveKey] ?? item.Id) === String(currentKey))) rows.push(current)
        })
        field.Data = rows
        field.options = normalizeOptions({ ...field, Data: rows, Config: config })
        field.optionError = ''
      } catch (error) {
        field.optionError = error.message || error.Msg || '选项加载失败'
      } finally {
        field.optionsLoading = false
        // zhy: 无论加载成功或失败都同步最终状态，让分组中的角色、职位状态、性别等字段立即刷新。
        syncNativeFieldOptionState(definition, field)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, Math.max(1, fields.length)) }, worker))
  return definition
}

export function defaultFormData(definition, defaults = {}) {
  const form = { ...defaults }
  definition.fields.forEach((field) => {
    if (form[field.Name] !== undefined) return
    let value = field.DefaultValue
    if (field.component === 'Switch') value = value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true'
    if (isNativeFieldMultiple(field)) value = parseJson(value, value ? [value] : [])
    form[field.Name] = value ?? ''
  })
  return form
}

export function validateNativeForm(form, fields) {
  for (const field of fields) {
    if (!field.editable || !field.required) continue
    const value = form[field.Name]
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      return `${field.Label || field.Name}不能为空`
    }
  }
  return ''
}

export function nativeFormDefaultSubmitValues(definition = {}, defaults = {}) {
  const fields = definition.layoutFields || definition.fields || []
  const fieldMap = new Map()
  fields.forEach((field) => {
    const name = String(field.Name || '')
    if (name) fieldMap.set(name.toLowerCase(), field)
  })
  const values = {}
  Object.keys(defaults || {}).forEach((inputName) => {
    const field = fieldMap.get(String(inputName).toLowerCase())
    if (!field || !field.Name || HIDDEN_NAMES.has(field.Name)) return
    if (SENSITIVE_FIELD_PATTERN.test(`${field.Name || ''} ${field.Label || ''}`)) return
    if (LAYOUT_COMPONENTS.has(field.component) || RELATED_COMPONENTS.has(field.component) ||
      GUARDED_COMPONENTS.has(field.component)) return
    values[field.Name] = defaults[inputName]
  })
  return values
}

export async function saveNativeForm(tableName, rowId, form, fields, extraValues = {}, options = {}) {
  const error = validateNativeForm(form, fields)
  if (error) throw new Error(error)
  const payload = { _InvokeType: 'Client' }
  if (options.menuId) payload._SysMenuId = options.menuId
  if (options.tableChildAuth) payload._TableChildAuth = options.tableChildAuth
  fields.forEach((field) => {
    if (!field.editable || form[field.Name] === undefined) return
    let value = form[field.Name]
    if (field.component === 'Switch') value = value ? 1 : 0
    if (isNativeFieldMultiple(field) && Array.isArray(value)) value = JSON.stringify(value)
    payload[field.Name] = value
  })
  Object.keys(extraValues || {}).forEach((name) => {
    if (!name || Object.prototype.hasOwnProperty.call(payload, name)) return
    payload[name] = extraValues[name]
  })
  let result
  if (rowId) result = await V8.FormEngine.UptFormData(tableName, { Id: rowId, ...payload })
  else result = await V8.FormEngine.AddFormData(tableName, payload)
  if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '保存失败')
  removeCachePrefix('module:')
  return result
}

export function fieldDisplayValue(field, value) {
  if (value === null || value === undefined || value === '') return '-'
  if (field.component === 'Switch') return value === true || value === 1 || value === '1' ? '是' : '否'
  const config = field.config || parseJson(field.Config, {}) || {}
  const preferredKeys = [config.SelectLabel, config.LabelField, config.SelectSaveField].filter(Boolean)
  if (field.options.length) {
    const parsedValue = parseJson(value, value)
    const values = Array.isArray(parsedValue) ? parsedValue : [parsedValue]
    return values.map((item) => {
      const key = typeof item === 'object' ? (item[config.SelectSaveField] ?? item.Id ?? item.Key ?? item.value) : item
      const found = field.options.find((option) => String(option.value) === String(key))
      return found ? found.label : formatStructuredValue(item, { preferredKeys, empty: '' })
    }).filter(Boolean).join('、') || '-'
  }
  const parsed = parseJson(value, value)
  if (field.component === 'Address') return formatRegionValue(parsed) || '-'
  if (['Map', 'MapArea'].includes(field.component) && parsed && typeof parsed === 'object') return parsed.address || parsed.name || parsed.Address || parsed.Name || '已选择位置'
  return formatStructuredValue(parsed, { preferredKeys, empty: '-' })
}

export default {
  parseJson,
  normalizeOptions,
  inferNativeComponent,
  normalizeField,
  normalizeTableTabs,
  createNativeFormDefinition,
  isNativeFieldMultiple,
  nativeFieldOptionSource,
  isRemoteNativeFieldOptions,
  isRemoteNativeFieldSearch,
  filterNativeFieldOptions,
  loadNativeFieldOptionPage,
  groupFields,
  loadNativeTableModel,
  loadNativeFormDefinition,
  scopeNativeFormDefinition,
  applyNativeFormViewDefinition,
  hydrateNativeFormOptions,
  defaultFormData,
  validateNativeForm,
  nativeFormDefaultSubmitValues,
  saveNativeForm,
  fieldDisplayValue
}
