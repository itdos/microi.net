import { dateFilterBounds, dateFilterSpec } from './list-filter-date.mjs'

const OPTION_COMPONENTS = new Set([
  'Select',
  'MultipleSelect',
  'Radio',
  'Checkbox',
  'Autocomplete',
  'Cascader',
  'SelectTree',
  'TreeCheckbox',
  'Department',
  'Transfer'
])

const DROPDOWN_COMPONENTS = new Set([
  'Select',
  'MultipleSelect',
  'Autocomplete',
  'Cascader',
  'SelectTree',
  'TreeCheckbox',
  'Department',
  'Transfer'
])

const MULTI_VALUE_COMPONENTS = new Set([
  'MultipleSelect',
  'Checkbox',
  'TreeCheckbox',
  'Transfer'
])

function parseRows(value) {
  if (Array.isArray(value)) return value
  if (!value) return []
  if (typeof value === 'object') return [value]
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return String(value).split(/[,;|]/).map((item) => item.trim()).filter(Boolean)
  }
}

function normalizedBoolean(value, fallback = false) {
  if (value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true') return true
  if (value === false || value === 0 || value === '0' || String(value).toLowerCase() === 'false') return false
  return fallback
}

function normalizedIdentity(value) {
  return String(value || '').trim().toLowerCase()
}

function splitFieldReference(value) {
  const parts = String(value || '').trim().split('.')
  if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(part))) {
    return { table: '', name: String(value || '').trim() }
  }
  return { table: parts[0], name: parts[1] }
}

function findConfiguredField(item, fields) {
  const byId = new Map(fields.map((field) => [String(field.Id || '').toLowerCase(), field]))
  const byName = new Map(fields.map((field) => [String(field.Name || '').toLowerCase(), field]))
  const source = item && typeof item === 'object' ? item : {}
  const sourceReference = splitFieldReference(source.Name || source.name || source.Field || source.field)
  const sourceTable = normalizedIdentity(
    source.FormEngineKey || source.formEngineKey || source.TableName || source.tableName ||
    source.TableId || source.tableId || sourceReference.table
  )
  const sourceName = normalizedIdentity(sourceReference.name)
  const tableMatched = sourceTable && sourceName
    ? fields.find((field) => {
        const fieldTable = [field.TableName, field.tableName, field.TableId, field.tableId]
          .map(normalizedIdentity)
          .filter(Boolean)
        return fieldTable.includes(sourceTable) && normalizedIdentity(field.Name) === sourceName
      })
    : null
  const candidates = item && typeof item === 'object'
    ? [source.Id, source.id, source.FieldId, source.fieldId, source.Name, source.name, source.Field, source.field]
    : [item]
  return candidates.slice(0, 4)
    .map((candidate) => String(candidate || '').toLowerCase())
    .filter(Boolean)
    .map((candidate) => byId.get(candidate))
    .find(Boolean) || tableMatched || candidates
    .map((candidate) => splitFieldReference(candidate).name.toLowerCase())
    .filter(Boolean)
    .map((candidate) => byName.get(candidate))
    .find(Boolean)
}

function shouldShowInAdvancedFilter(item, includeInline = false) {
  if (!item || typeof item !== 'object') return true
  if (normalizedBoolean(item.Hide, false) || item.IsVisible === false) return false
  const displayType = String(item.DisplayType || '').trim().toLowerCase()
  // Out 是 PC 搜索区的位置，不是隐藏或单选配置；移动端统一收进筛选弹窗。
  return includeInline || displayType !== 'line'
}

function fieldCanBeSearched(field, { allowAppHidden = false } = {}) {
  if (!field || !field.Name) return false
  if (/password|passwd|pwd|secret|token|openid|unionid|密码|密钥|令牌/i.test(`${field.Name || ''} ${field.Label || ''}`)) return false
  if (Array.isArray(field.bindRoleIds) && field.bindRoleIds.length && field.visible === false) return false
  // Visible/AppVisible 只控制表单呈现。菜单已明确配置到 SearchFieldIds 时，
  // 隐藏的计算字段、只读字段仍可作为查询条件；角色限制和敏感字段限制继续生效。
  if (!allowAppHidden && Number(field.AppVisible ?? field.Visible ?? 1) === 0) return false
  return true
}

function isNumberField(field) {
  return field.component === 'NumberText' || /(^|\W)(tinyint|smallint|mediumint|int|bigint|decimal|double|float|number)(\W|$)/i.test(String(field.Type || ''))
}

function integerLimit(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : fallback
}

function relativeDaysSearchConfig(config = {}) {
  const source = config.RelativeDaysSearch
  if (!source || typeof source !== 'object' || !normalizedBoolean(source.Enabled)) return null
  return {
    targetField: String(source.TargetField || '').trim(),
    mode: String(source.Mode || 'FutureWithin').trim(),
    min: integerLimit(source.Min, 0),
    max: integerLimit(source.Max, 3650),
    timeZone: String(source.TimeZone || 'Asia/Shanghai').trim(),
    unit: String(source.Unit || '天').trim() || '天'
  }
}

function safeFilterFieldName(value) {
  return String(value || '').split('.').every((part) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(part))
}

function dateTextInTimeZone(now, timeZone) {
  const date = now instanceof Date ? now : new Date(now)
  if (Number.isNaN(date.getTime())) throw new Error('当前日期无效')
  // 微信较旧 JSCore 的 Intl 时区实现不完整；中国业务时区使用固定 UTC+8 可稳定跨端计算。
  if (timeZone === 'Asia/Shanghai') {
    const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000)
    return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`
  }
  if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') throw new Error(`当前环境不支持时区 ${timeZone}`)
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const values = {}
  parts.forEach((part) => { if (part.type !== 'literal') values[part.type] = part.value })
  return `${values.year}-${values.month}-${values.day}`
}

function addCalendarDays(dateText, days) {
  const [year, month, day] = String(dateText).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function relativeDaysValue(field, value) {
  const text = String(value ?? '').trim()
  const days = Number(text)
  if (!text || !Number.isFinite(days) || !Number.isInteger(days)) throw new Error('请输入整数')
  const config = field.relativeDays || {}
  if (days < config.min || days > config.max) throw new Error(`请输入 ${config.min} 至 ${config.max} 的整数`)
  if (config.mode !== 'FutureWithin') throw new Error(`暂不支持 ${config.mode} 模式`)
  if (!safeFilterFieldName(config.targetField)) throw new Error('未配置有效的目标日期字段')
  return days
}

export function relativeDaysFilterBounds(field, value, now = new Date()) {
  const days = relativeDaysValue(field, value)
  const config = field.relativeDays
  const today = dateTextInTimeZone(now, config.timeZone || 'Asia/Shanghai')
  return [
    { Name: config.targetField, Type: '>=', Value: today },
    { Name: config.targetField, Type: '<', Value: addCalendarDays(today, days + 1) }
  ]
}

function compileField(item, field, options = {}) {
  const source = item && typeof item === 'object' ? item : {}
  const sourceReference = splitFieldReference(source.Name || source.name || source.Field || source.field)
  const tableName = String(source.TableName || source.tableName || field.TableName || field.tableName || sourceReference.table || '').trim()
  const tableId = String(source.TableId || source.tableId || field.TableId || field.tableId || '').trim()
  const explicitFormEngineKey = String(source.FormEngineKey || source.formEngineKey || sourceReference.table || '').trim()
  const primaryTableName = normalizedIdentity(options.primaryTableName)
  const primaryTableId = normalizedIdentity(options.primaryTableId)
  const hasPrimaryTable = Boolean(primaryTableName || primaryTableId)
  const isPrimaryTable = (primaryTableName && normalizedIdentity(tableName) === primaryTableName) ||
    (primaryTableId && normalizedIdentity(tableId) === primaryTableId)
  const formEngineKey = explicitFormEngineKey || (hasPrimaryTable && !isPrimaryTable ? (tableName || tableId) : '')
  const component = String(field.component || field.Component || 'Text')
  const config = field.config || (typeof field.Config === 'string' ? JSON.parse(field.Config || '{}') : field.Config) || {}
  const tree = ['Cascader', 'SelectTree', 'TreeCheckbox', 'Department'].includes(component)
  const treeConfig = config[component] || (component === 'TreeCheckbox' ? config.SelectTree : {}) || {}
  const label = String(source.Label || source.label || field.Label || field.Name || '').trim()
  const fieldName = String(field.Name || sourceReference.name || '').trim()
  const base = {
    key: formEngineKey ? `${formEngineKey}.${fieldName}` : String(fieldName || field.Id || '').trim(),
    field: fieldName,
    ...(formEngineKey ? { formEngineKey } : {}),
    label,
    placeholder: String(field.placeholder || `请输入${label}`).trim(),
    component,
    nativeField: { ...field, component, config },
    config,
    columnType: field.Type || ''
  }

  const relativeDays = relativeDaysSearchConfig(config)
  if (relativeDays) {
    return {
      ...base,
      type: 'relative-days',
      relativeDays,
      placeholder: `请输入 ${relativeDays.min} 至 ${relativeDays.max} 的整数`,
      hint: `${relativeDays.min}～${relativeDays.max}${relativeDays.unit}，含今天`,
      description: `0 表示仅今天到期；输入 N 表示未来 N 天内到期（含今天）`
    }
  }

  if (component === 'DateTime') {
    return { ...base, type: 'date-range', date: dateFilterSpec(config.DateTimeType), hint: '开始至结束' }
  }
  if (component === 'Switch') {
    return {
      ...base,
      type: 'options',
      options: [
        { label: '全部', value: '' },
        { label: '是', value: 1 },
        { label: '否', value: 0 }
      ]
    }
  }
  if (OPTION_COMPONENTS.has(component)) {
    const storedMultiple = tree ? normalizedBoolean(treeConfig.Multiple, MULTI_VALUE_COMPONENTS.has(component))
      : component === 'Radio' ? false : normalizedBoolean(config.MultipleSelect, field.multiple === true || MULTI_VALUE_COMPONENTS.has(component))
    // 平台查询区的 Radio 使用复选组，Select 使用多选下拉，和表单单值存储独立。
    // 兼容既有 In/Out 查询配置，包括未填写 DisplaySelect 的菜单；它只决定呈现方式。
    // 显式 SearchMultiple 优先，纯字段 Id / 未配置查询模式的控件仍按表单默认值。
    const configuredOptionQuery = ['Radio', 'Select'].includes(component) &&
      (source.DisplayType !== undefined || source.displayType !== undefined ||
        source.DisplaySelect !== undefined || source.displaySelect !== undefined)
    const multiple = normalizedBoolean(source.SearchMultiple, storedMultiple || configuredOptionQuery)
    const displaySelect = normalizedBoolean(source.DisplaySelect ?? source.displaySelect, false)
    const objectStorage = String(config.SelectSaveFormat).toLowerCase() === 'json' ||
      (component === 'Select' && config.DataSource === 'KeyValue') ||
      (component === 'Radio' && !config.SelectSaveField && (field.options || []).some((option) => option.raw && typeof option.raw === 'object'))
    return {
      ...base,
      type: 'options',
      presentation: displaySelect || component === 'Checkbox' || DROPDOWN_COMPONENTS.has(component) ? 'dropdown' : 'chips',
      displaySelect,
      multiple,
      multiValueLike: storedMultiple || objectStorage,
      storedMultiple,
      storage: tree && ['Cascader', 'Department'].includes(component) && normalizedBoolean(treeConfig.EmitPath, true) ? (storedMultiple ? 'paths' : 'path')
        : storedMultiple ? 'array' : objectStorage ? 'object' : 'scalar',
      tree: tree ? { ...treeConfig, ParentChildLinkage: normalizedBoolean(treeConfig.ParentChildLinkage), SearchLeafOnly: normalizedBoolean(source.SearchLeafOnly ?? treeConfig.SearchLeafOnly), SearchSelectableLevels: source.SearchSelectableLevels || treeConfig.SearchSelectableLevels, valueKey: component === 'Department' ? 'Id' : config.SelectSaveField || 'Id', labelKey: component === 'Department' ? 'Name' : config.SelectLabel || config.SelectSaveField || 'Name' } : null,
      options: Array.isArray(field.options) ? field.options : [],
      source: field.optionsRemote === true ? 'native-field' : '',
      pageSize: 20
    }
  }
  if (component === 'Address') return { ...base, type: 'address', storage: 'region' }
  if (isNumberField({ ...field, component })) return { ...base, type: 'range', hint: '最小值至最大值' }
  return { ...base, type: 'text', operation: normalizedBoolean(source.Equal, false) ? '=' : 'Like' }
}

export function compileModuleFilterFields(searchFieldIds, fields = [], {
  includeInline = false,
  allowAppHidden = false,
  primaryTableId = '',
  primaryTableName = ''
} = {}) {
  const available = Array.isArray(fields) ? fields : []
  const seen = new Set()
  return parseRows(searchFieldIds).map((item) => {
    if (!shouldShowInAdvancedFilter(item, includeInline)) return null
    const field = findConfiguredField(item, available)
    if (!fieldCanBeSearched(field, { allowAppHidden })) return null
    const compiled = compileField(item, field, { primaryTableId, primaryTableName })
    const key = `${normalizedIdentity(compiled.formEngineKey)}:${normalizedIdentity(compiled.field)}`
    if (seen.has(key)) return null
    seen.add(key)
    return compiled
  }).filter(Boolean)
}

function filterIdentity(field) {
  const name = normalizedIdentity(field?.field || field?.key)
  return name ? `${normalizedIdentity(field?.formEngineKey)}:${name}` : ''
}

export function mergeModuleFilterFields(configured = [], local = [], nativeFields = []) {
  const result = []
  const indexes = new Map()
  const normalizedLocal = (local || []).map((item) => {
    if (!item || ['sort', 'toggle'].includes(item.type)) return item
    if (item.overrideConfigured === true) return { ...item }
    const native = nativeFields.find((field) => String(field.Name).toLowerCase() === String(item.field).toLowerCase())
    if (!native) return item
    if (!fieldCanBeSearched(native)) return null
    return { ...compileField({ Label: item.label, SearchMultiple: item.SearchMultiple ?? item.multiple }, native), key: item.key, overrideSearchMultiple: item.overrideSearchMultiple === true }
  })
  ;[...(configured || []), ...normalizedLocal].forEach((field) => {
    if (!field) return
    const key = filterIdentity(field)
    if (!key) return
    if (indexes.has(key)) {
      if (field.overrideConfigured === true) {
        const index = indexes.get(key)
        result[index] = { ...result[index], ...field }
      } else if (field.overrideSearchMultiple === true) {
        const index = indexes.get(key)
        result[index] = { ...result[index], multiple: field.multiple }
      }
      return
    }
    indexes.set(key, result.length)
    result.push(field)
  })
  return result
}

const TABLE_SELECTOR_FILTER_TYPES = new Set([
  'text',
  'options',
  'range',
  'relative-days',
  'date-range',
  'address',
  // 兼容已经发布的租户弹窗配置；新后台配置统一使用 options/date-range。
  'select',
  'datetime-range'
])

export function mergeTableSelectorFilterFields(configured = [], presentation = []) {
  const valid = (field) => field && field.key && field.field && TABLE_SELECTOR_FILTER_TYPES.has(field.type)
  const result = (Array.isArray(configured) ? configured : []).filter(valid).map((field) => ({ ...field }))
  const indexes = new Map(result.map((field, index) => [filterIdentity(field), index]))

  ;(Array.isArray(presentation) ? presentation : []).filter(valid).forEach((field) => {
    const identity = filterIdentity(field)
    const index = indexes.get(identity)
    // presentation.filters 是特殊业务的完整声明：同字段替换后台配置，新字段按声明顺序追加。
    if (index !== undefined) result[index] = { ...field }
    else {
      indexes.set(identity, result.length)
      result.push({ ...field })
    }
  })
  return result
}

export function hasListFilterValue(value) {
  if (Array.isArray(value)) return value.length > 0
  if (value && typeof value === 'object') {
    return Object.values(value).some((item) => item !== undefined && item !== null && item !== '')
  }
  return value !== undefined && value !== null && value !== '' && value !== false
}

function whereTarget(field, name = field.field) {
  return {
    ...(field.formEngineKey ? { FormEngineKey: field.formEngineKey } : {}),
    Name: name
  }
}

function appendMultiValueLike(result, field, values) {
  values.forEach((value, index) => {
    result.push({
      ...whereTarget(field),
      AndOr: index === 0 ? 'AND' : 'OR',
      GroupStart: index === 0,
      Type: 'Like',
      Value: value,
      GroupEnd: index === values.length - 1
    })
  })
}

export function unwrapFilterSelection(value) {
  return value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, '_filterValue') ? value._filterValue : value
}

// Microi 多选序列化为 JSON 数组。带引号的 token / 对象属性避免 Id=a 误匹配 Id=ab。
function jsonMembership(value, config = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const key = ['Id', 'id', 'Key', 'key', config.SelectSaveField, 'value', 'Value'].find((key) => key && value[key] !== undefined)
    if (!key || value[key] === undefined) throw new Error('选项缺少可查询的存储标识')
    const token = JSON.stringify(value[key])
    const suffixes = typeof value[key] === 'number' || typeof value[key] === 'boolean' ? [',', '}'] : ['']
    return ['', ' '].flatMap((space) => suffixes.map((suffix) => `${JSON.stringify(key)}:${space}${token}${suffix}`))
  }
  const token = JSON.stringify(value)
  if (typeof value === 'string') return ['[', '[ ', ',', ', '].map((prefix) => `${prefix}${token}`)
  return ['[', '[ ', ',', ', '].flatMap((prefix) => [',', ']', ' ]'].map((suffix) => `${prefix}${token}${suffix}`))
}

function selectionPatterns(field, value) {
  if (field.storage === 'path' || field.storage === 'paths') {
    const path = Array.isArray(value) ? value : [value]
    return [JSON.stringify(path), JSON.stringify(path).replace(/,/g, ', ')]
  }
  return jsonMembership(value, field.config)
}

export function validateListFilters(fields, values) {
  for (const field of fields) {
    const value = values[field.key]
    if (field.type === 'date-range' && value) {
      try { dateFilterBounds(field, value) } catch (error) { return `${field.label}：${error.message}` }
    }
    if (field.type === 'range' && value) {
      const min = value.min; const max = value.max
      if ([min, max].some((number) => number !== undefined && number !== '' && !Number.isFinite(Number(number)))) return `${field.label}请输入有效数值`
      if (min !== undefined && min !== '' && max !== undefined && max !== '' && Number(min) > Number(max)) return `${field.label}最小值不能大于最大值`
    }
    if (field.type === 'relative-days' && hasListFilterValue(value)) {
      try { relativeDaysValue(field, value) } catch (error) { return `${field.label}：${error.message}` }
    }
  }
  return ''
}

export function buildListFilterWhere(filterFields = [], filterValues = {}, currentUser = {}, initial = []) {
  const result = [...(initial || [])]
  ;(filterFields || []).forEach((field) => {
    if (!field || field.type === 'sort') return
    const value = filterValues[field.key]
    if (field.type === 'relative-days') {
      if (hasListFilterValue(value)) relativeDaysFilterBounds(field, value).forEach((bound) => result.push({
        ...whereTarget(field, bound.Name),
        Type: bound.Type,
        Value: bound.Value
      }))
      return
    }
    if (field.type === 'range') {
      if (value && value.min !== undefined && value.min !== '') result.push({ ...whereTarget(field), Type: '>=', Value: Number(value.min) })
      if (value && value.max !== undefined && value.max !== '') result.push({ ...whereTarget(field), Type: '<=', Value: Number(value.max) })
      return
    }
    if (field.type === 'date-range') {
      dateFilterBounds(field, value || {}).forEach((bound) => result.push({ ...whereTarget(field), ...bound }))
      return
    }
    if (field.type === 'toggle') {
      if (!value) return
      const resolved = field.currentUserField ? currentUser[field.currentUserField] : field.value
      if (resolved !== undefined && resolved !== null && resolved !== '') {
        result.push({ ...whereTarget(field), Type: field.operation || '=', Value: resolved })
      }
      return
    }
    if (field.type === 'address') {
      const region = Array.isArray(value) ? value.filter((part) => part && part !== '全部') : []
      if (region.length) {
        const prefix = JSON.stringify(region).slice(0, -1)
        // Address 写入省市区名称 JSON 数组；省、市筛选是完整路径前缀。
        const patterns = [prefix + ']', prefix + ',', prefix.replace(/,/g, ', ') + ']', prefix.replace(/,/g, ', ') + ',']
        patterns.forEach((pattern, index) => result.push({ ...whereTarget(field), Type: 'StartLike', Value: pattern, AndOr: index ? 'OR' : 'AND', GroupStart: index === 0, GroupEnd: index === patterns.length - 1 }))
      }
      return
    }
    const wrapped = Array.isArray(value) ? value.some((item) => item && Object.prototype.hasOwnProperty.call(item, '_filterValue')) : value && Object.prototype.hasOwnProperty.call(value, '_filterValue')
    if (field.storage || wrapped) {
      if (!hasListFilterValue(value)) return
      const selections = field.multiple && Array.isArray(value) ? value : [value]
      const values = selections.map(unwrapFilterSelection)
      const storage = field.storage || (field.multiValueLike ? 'array' : 'scalar')
      if (storage === 'scalar') result.push({ ...whereTarget(field), Type: field.multiple ? 'In' : '=', Value: field.multiple ? values : values[0] })
      else {
        const patterns = values.flatMap((item, index) => {
          const legacy = selections[index]?._filterRaw
          const canonical = selectionPatterns({ ...field, storage }, item)
          // PC 保存字段值数组；已有移动端历史记录保存整行对象。两种合法结构均按标识查询。
          return storage === 'array' && legacy && typeof legacy === 'object' && item !== legacy && !Array.isArray(item) ? [...canonical, ...jsonMembership(legacy, field.config)] : canonical
        })
        appendMultiValueLike(result, field, [...new Set(patterns)])
      }
      return
    }
    if (Array.isArray(value)) {
      if (!value.length) return
      if (field.multiValueLike) appendMultiValueLike(result, field, value)
      else result.push({ ...whereTarget(field), Type: field.operation || 'In', Value: value })
      return
    }
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      result.push({
        ...whereTarget(field),
        Type: field.operation || (field.type === 'text' ? 'Like' : '='),
        Value: typeof value === 'string' ? value.trim() : value
      })
    }
  })
  return result
}
