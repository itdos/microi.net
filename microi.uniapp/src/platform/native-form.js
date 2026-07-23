import { V8, getUser, post } from '@/utils/request.js'
import {
  dedupeRequest,
  readCache,
  removeCachePrefix,
  writeCache
} from '@/platform/cache.js'
import nativeControls from '@/config/mci-native-controls.json'
import { formatRegionValue, formatStructuredValue } from '@/platform/display.js'

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

export function normalizeField(field) {
  const component = inferNativeComponent(field)
  const options = normalizeOptions(field)
  const config = parseJson(field.Config, {}) || {}
  const selectable = OPTION_COMPONENTS.has(component)
  const relationLabel = relatedFieldLabel(field, component, config)
  return {
    ...field,
    Label: relationLabel || field.Label,
    component,
    config,
    options,
    multiple: isNativeFieldMultiple({ ...field, component, config }),
    optionsRemote: isRemoteNativeFieldOptions({ ...field, component, config }),
    inputMode: inputMode(field, component),
    editable: Number(field.Readonly || 0) !== 1 &&
      !LAYOUT_COMPONENTS.has(component) &&
      !RELATED_COMPONENTS.has(component) &&
      !READONLY_COMPONENTS.has(component) &&
      !GUARDED_COMPONENTS.has(component) &&
      !HIDDEN_NAMES.has(field.Name),
    required: Number(field.NotEmpty || 0) === 1,
    visible: Number(field.AppVisible ?? field.Visible ?? 1) !== 0 && Number(field.IsVirtual || 0) !== 1 &&
      !SENSITIVE_FIELD_PATTERN.test(`${field.Name || ''} ${field.Label || ''}`),
    placeholder: field.Placeholder || `${selectable || ['DateTime', 'Address', 'Map', 'MapArea', 'ColorPicker'].includes(component) ? '请选择' : '请输入'}${field.Label || field.Name}`
  }
}

function parseTableTabs(tableModel) {
  const tabs = parseJson(tableModel && tableModel.Tabs, [])
  const result = new Map()
  ;(Array.isArray(tabs) ? tabs : []).forEach((tab) => {
    const id = String(tab.Id || tab.id || tab.Name || tab.name || '')
    const name = String(tab.Name || tab.name || tab.Label || id || '')
    if (id) result.set(id, name)
    if (name) result.set(name, name)
  })
  return result
}

export function groupFields(fields, tableModel = {}) {
  const tabNames = parseTableTabs(tableModel)
  const groups = new Map()
  const currentSection = new Map()
  const ensureGroup = (key, name) => {
    if (!groups.has(key)) groups.set(key, { name, fields: [] })
    return groups.get(key)
  }
  fields.forEach((field) => {
    if (!field.visible) return
    const rawTab = field.Tab && field.Tab !== 'none' ? String(field.Tab) : ''
    const tabName = tabNames.get(rawTab) || rawTab || '基本信息'
    const tabKey = rawTab || '__basic__'
    if (field.component === 'CollapseGroup' || field.component === 'Divider') {
      currentSection.set(tabKey, field.Label || tabName || '更多信息')
      return
    }
    if (LAYOUT_COMPONENTS.has(field.component) || RELATED_COMPONENTS.has(field.component) || GUARDED_COMPONENTS.has(field.component)) return
    const sectionName = currentSection.get(tabKey)
    const groupName = sectionName || tabName
    ensureGroup(`${tabKey}:${groupName}`, groupName).fields.push(field)
  })
  const result = [...groups.values()].filter((group) => group.fields.length)
  return result.length ? result : [{ name: tableModel.Description || '基本信息', fields: [] }]
}

function buildDefinition(table, fields, layoutFields = fields) {
  const uniqueRelated = (component) => {
    const seen = new Set()
    return fields.filter((field) => {
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
    fields,
    layoutFields,
    groups: groupFields(fields, table),
    childFields: uniqueRelated('TableChild'),
    joinFields: uniqueRelated('JoinForm'),
    openTableFields: uniqueRelated('OpenTable'),
    joinTableFields: uniqueRelated('JoinTable')
  }
}

export function createNativeFormDefinition(table = {}, rawFields = []) {
  const layoutFields = (Array.isArray(rawFields) ? rawFields : []).map(normalizeField)
  const fields = layoutFields.filter((field) => field.visible)
  return buildDefinition(table, fields, layoutFields)
}

export const NATIVE_FORM_SCHEMA_VERSION = 3
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
      field.Component
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
  const user = getUser() || {}
  const identity = String(user.Id || user.Account || 'guest').toLowerCase()
  const scope = hashText(definitionAuthorizationScope(options))
  return {
    version: `form-definition-version:v${NATIVE_FORM_SCHEMA_VERSION}:${identity}:${scope}:${normalized}`,
    definition: (fingerprint) =>
      `form-definition:v${NATIVE_FORM_SCHEMA_VERSION}:${identity}:${scope}:${normalized}:${fingerprint}`,
    request: `form-definition-request:v${NATIVE_FORM_SCHEMA_VERSION}:${identity}:${scope}:${normalized}`
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
  const table = await loadNativeTableModel(tableName, options)
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
  const definition = createNativeFormDefinition(table, rawFields)
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
  const byName = new Map((definition.fields || []).map((field) => [
    String(field.Name || '').toLowerCase(),
    field
  ]))
  const used = new Set()
  const hidden = new Set()
  const groups = formConfig.sections.map((section) => {
    const fields = (section.fields || []).map((item) => {
      const name = String(item.name || item.Name || '').toLowerCase()
      if (!name) return null
      used.add(name)
      if (item.hidden === true || item.Hidden === true) {
        hidden.add(name)
        return null
      }
      const field = byName.get(name)
      if (!field) return null
      return {
        ...field,
        Label: item.label || item.Label || field.Label,
        viewWidth: item.mobileWidth || item.MobileWidth || item.width || item.Width || null,
        viewFormat: item.format || item.Format || ''
      }
    }).filter(Boolean)
    return {
      name: section.title || section.Title || '基本信息',
      fields,
      defaultExpanded: section.defaultExpanded !== false && section.DefaultExpanded !== false,
      columns: Number(section.columns || section.Columns || 1)
    }
  }).filter((group) => group.fields.length)

  ;(definition.groups || []).forEach((group) => {
    const fields = (group.fields || []).filter((field) => {
      const name = String(field.Name || '').toLowerCase()
      return !used.has(name) && !hidden.has(name)
    })
    if (fields.length) {
      groups.push({
        ...group,
        fields,
        defaultExpanded: false
      })
    }
  })

  return {
    ...definition,
    groups: groups.length ? groups : definition.groups,
    viewConfig: formConfig
  }
}

function currentOptionRows(field, form) {
  const raw = form[field.Name]
  const values = Array.isArray(raw) ? raw : parseJson(raw, raw ? [raw] : [])
  return (Array.isArray(values) ? values : [values]).filter((item) => item && typeof item === 'object')
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
  const result = await requestFieldOptions(field, form, {
    pageIndex,
    pageSize,
    keyword: remoteSearch ? keyword : '',
    menuId: options.menuId,
    moduleEngineKey: options.moduleEngineKey,
    tableChildAuth: options.tableChildAuth
  })
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

export async function hydrateNativeFormOptions(definition, form, options = {}) {
  if (!definition || !Array.isArray(definition.fields)) return definition
  const fields = definition.fields.filter((field) => OPTION_COMPONENTS.has(field.component))
  let cursor = 0
  const worker = async () => {
    while (cursor < fields.length) {
      const field = fields[cursor++]
      const config = field.config || {}
      const inferredSource = config.DataSource || (config.Sql ? 'Sql' : config.DataSourceId ? 'DataSource' : config.DataSourceApiEngineKey ? 'ApiEngine' : config.Api ? 'Api' : '')
      const requiresRemote = field.component === 'Department' || ['Sql', 'DataSource', 'ApiEngine', 'Api'].includes(inferredSource)
      if (!requiresRemote) continue
      field.optionsLoading = true
      try {
        const page = await loadNativeFieldOptionPage(field, form, {
          pageIndex: 1,
          pageSize: 20,
          menuId: options.menuId,
          moduleEngineKey: options.moduleEngineKey,
          tableChildAuth: options.tableChildAuth
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
  return formatStructuredValue(parsed, { preferredKeys })
}

export default {
  parseJson,
  normalizeOptions,
  inferNativeComponent,
  normalizeField,
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
