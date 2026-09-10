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

function findConfiguredField(item, fields) {
  const byId = new Map(fields.map((field) => [String(field.Id || '').toLowerCase(), field]))
  const byName = new Map(fields.map((field) => [String(field.Name || '').toLowerCase(), field]))
  const source = item && typeof item === 'object' ? item : {}
  const candidates = item && typeof item === 'object'
    ? [source.Id, source.id, source.FieldId, source.fieldId, source.Name, source.name, source.Field, source.field]
    : [item]
  return candidates
    .map((candidate) => String(candidate || '').toLowerCase())
    .filter(Boolean)
    .map((candidate) => byId.get(candidate) || byName.get(candidate))
    .find(Boolean)
}

function shouldShowInAdvancedFilter(item, includeInline = false) {
  if (!item || typeof item !== 'object') return true
  if (normalizedBoolean(item.Hide, false) || item.IsVisible === false) return false
  const displayType = String(item.DisplayType || '').trim().toLowerCase()
  // Out 是 PC 搜索区的位置，不是隐藏或单选配置；移动端统一收进筛选弹窗。
  return includeInline || displayType !== 'line'
}

function fieldCanBeSearched(field) {
  if (!field || !field.Name) return false
  if (/password|passwd|pwd|secret|token|openid|unionid|密码|密钥|令牌/i.test(`${field.Name || ''} ${field.Label || ''}`)) return false
  if (Array.isArray(field.bindRoleIds) && field.bindRoleIds.length && field.visible === false) return false
  if (Number(field.AppVisible ?? field.Visible ?? 1) === 0) return false
  return true
}

function isNumberField(field) {
  return field.component === 'NumberText' || /(^|\W)(tinyint|smallint|mediumint|int|bigint|decimal|double|float|number)(\W|$)/i.test(String(field.Type || ''))
}

function compileField(item, field) {
  const source = item && typeof item === 'object' ? item : {}
  const component = String(field.component || field.Component || 'Text')
  const config = field.config || (typeof field.Config === 'string' ? JSON.parse(field.Config || '{}') : field.Config) || {}
  const tree = ['Cascader', 'SelectTree', 'TreeCheckbox', 'Department'].includes(component)
  const treeConfig = config[component] || (component === 'TreeCheckbox' ? config.SelectTree : {}) || {}
  const label = String(source.Label || source.label || field.Label || field.Name || '').trim()
  const base = {
    key: String(field.Name || field.Id || '').trim(),
    field: String(field.Name || '').trim(),
    label,
    placeholder: String(field.placeholder || `请输入${label}`).trim(),
    component,
    nativeField: { ...field, component, config },
    config,
    columnType: field.Type || ''
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

export function compileModuleFilterFields(searchFieldIds, fields = [], { includeInline = false } = {}) {
  const available = Array.isArray(fields) ? fields : []
  const seen = new Set()
  return parseRows(searchFieldIds).map((item) => {
    if (!shouldShowInAdvancedFilter(item, includeInline)) return null
    const field = findConfiguredField(item, available)
    if (!fieldCanBeSearched(field)) return null
    const key = String(field.Name).toLowerCase()
    if (seen.has(key)) return null
    seen.add(key)
    return compileField(item, field)
  }).filter(Boolean)
}

export function mergeModuleFilterFields(configured = [], local = [], nativeFields = []) {
  const result = []
  const seen = new Set()
  const normalizedLocal = (local || []).map((item) => {
    if (!item || ['sort', 'toggle'].includes(item.type)) return item
    const native = nativeFields.find((field) => String(field.Name).toLowerCase() === String(item.field).toLowerCase())
    if (!native) return item
    if (!fieldCanBeSearched(native)) return null
    return { ...compileField({ Label: item.label, SearchMultiple: item.SearchMultiple ?? item.multiple }, native), key: item.key }
  })
  ;[...(configured || []), ...normalizedLocal].forEach((field) => {
    if (!field) return
    const key = String(field.field || field.key || '').trim().toLowerCase()
    if (!key || seen.has(key)) return
    seen.add(key)
    result.push(field)
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

function appendMultiValueLike(result, field, values) {
  values.forEach((value, index) => {
    result.push({
      AndOr: index === 0 ? 'AND' : 'OR',
      GroupStart: index === 0,
      Name: field.field,
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
  }
  return ''
}

export function buildListFilterWhere(filterFields = [], filterValues = {}, currentUser = {}, initial = []) {
  const result = [...(initial || [])]
  ;(filterFields || []).forEach((field) => {
    if (!field || field.type === 'sort') return
    const value = filterValues[field.key]
    if (field.type === 'range') {
      if (value && value.min !== undefined && value.min !== '') result.push({ Name: field.field, Type: '>=', Value: Number(value.min) })
      if (value && value.max !== undefined && value.max !== '') result.push({ Name: field.field, Type: '<=', Value: Number(value.max) })
      return
    }
    if (field.type === 'date-range') {
      dateFilterBounds(field, value || {}).forEach((bound) => result.push({ Name: field.field, ...bound }))
      return
    }
    if (field.type === 'toggle') {
      if (!value) return
      const resolved = field.currentUserField ? currentUser[field.currentUserField] : field.value
      if (resolved !== undefined && resolved !== null && resolved !== '') {
        result.push({ Name: field.field, Type: field.operation || '=', Value: resolved })
      }
      return
    }
    if (field.type === 'address') {
      const region = Array.isArray(value) ? value.filter((part) => part && part !== '全部') : []
      if (region.length) {
        const prefix = JSON.stringify(region).slice(0, -1)
        // Address 写入省市区名称 JSON 数组；省、市筛选是完整路径前缀。
        const patterns = [prefix + ']', prefix + ',', prefix.replace(/,/g, ', ') + ']', prefix.replace(/,/g, ', ') + ',']
        patterns.forEach((pattern, index) => result.push({ Name: field.field, Type: 'StartLike', Value: pattern, AndOr: index ? 'OR' : 'AND', GroupStart: index === 0, GroupEnd: index === patterns.length - 1 }))
      }
      return
    }
    const wrapped = Array.isArray(value) ? value.some((item) => item && Object.prototype.hasOwnProperty.call(item, '_filterValue')) : value && Object.prototype.hasOwnProperty.call(value, '_filterValue')
    if (field.storage || wrapped) {
      if (!hasListFilterValue(value)) return
      const selections = field.multiple && Array.isArray(value) ? value : [value]
      const values = selections.map(unwrapFilterSelection)
      const storage = field.storage || (field.multiValueLike ? 'array' : 'scalar')
      if (storage === 'scalar') result.push({ Name: field.field, Type: field.multiple ? 'In' : '=', Value: field.multiple ? values : values[0] })
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
      else result.push({ Name: field.field, Type: field.operation || 'In', Value: value })
      return
    }
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      result.push({
        Name: field.field,
        Type: field.operation || (field.type === 'text' ? 'Like' : '='),
        Value: typeof value === 'string' ? value.trim() : value
      })
    }
  })
  return result
}
