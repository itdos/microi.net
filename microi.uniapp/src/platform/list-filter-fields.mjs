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

function shouldShowInAdvancedFilter(item) {
  if (!item || typeof item !== 'object') return true
  if (normalizedBoolean(item.Hide, false) || item.IsVisible === false) return false
  const displayType = String(item.DisplayType || '').trim().toLowerCase()
  return displayType !== 'line' && displayType !== 'out'
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

function isMultiValueField(field) {
  const saveFormat = String(field.config && field.config.SelectSaveFormat || '').toLowerCase()
  const columnType = String(field.Type || '').toLowerCase()
  return MULTI_VALUE_COMPONENTS.has(field.component) || saveFormat === 'json' || (field.multiple === true && /text|json/.test(columnType))
}

function compileField(item, field) {
  const source = item && typeof item === 'object' ? item : {}
  const component = String(field.component || field.Component || 'Text')
  const label = String(source.Label || source.label || field.Label || field.Name || '').trim()
  const base = {
    key: String(field.Name || field.Id || '').trim(),
    field: String(field.Name || '').trim(),
    label,
    placeholder: String(field.placeholder || `请输入${label}`).trim(),
    component
  }

  if (component === 'DateTime') {
    return { ...base, type: 'date-range', hint: '开始日期至结束日期' }
  }
  if (isNumberField({ ...field, component })) {
    return { ...base, type: 'range', hint: '最小值至最大值' }
  }
  if (component === 'Switch') {
    return {
      ...base,
      type: 'options',
      options: [
        { label: '开启', value: 1 },
        { label: '关闭', value: 0 }
      ]
    }
  }
  if (OPTION_COMPONENTS.has(component)) {
    const multiple = field.multiple === true || MULTI_VALUE_COMPONENTS.has(component)
    const displaySelect = normalizedBoolean(source.DisplaySelect ?? source.displaySelect, false)
    return {
      ...base,
      type: 'options',
      presentation: displaySelect || DROPDOWN_COMPONENTS.has(component) ? 'dropdown' : 'chips',
      displaySelect,
      multiple,
      multiValueLike: isMultiValueField({ ...field, component }),
      options: Array.isArray(field.options) ? field.options : [],
      source: field.optionsRemote === true ? 'native-field' : '',
      pageSize: 500
    }
  }
  return { ...base, type: 'text', operation: normalizedBoolean(source.Equal, false) ? '=' : 'Like' }
}

export function compileModuleFilterFields(searchFieldIds, fields = []) {
  const available = Array.isArray(fields) ? fields : []
  const seen = new Set()
  return parseRows(searchFieldIds).map((item) => {
    if (!shouldShowInAdvancedFilter(item)) return null
    const field = findConfiguredField(item, available)
    if (!fieldCanBeSearched(field)) return null
    const key = String(field.Name).toLowerCase()
    if (seen.has(key)) return null
    seen.add(key)
    return compileField(item, field)
  }).filter(Boolean)
}

export function mergeModuleFilterFields(configured = [], local = []) {
  const result = []
  const seen = new Set()
  ;[...(configured || []), ...(local || [])].forEach((field) => {
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
      if (value && value.start) result.push({ Name: field.field, Type: '>=', Value: `${value.start} 00:00:00` })
      if (value && value.end) result.push({ Name: field.field, Type: '<=', Value: `${value.end} 23:59:59` })
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
