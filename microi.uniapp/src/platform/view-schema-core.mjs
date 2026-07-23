const SCENES = ['Detail', 'Edit', 'List', 'Card']
const DEVICES = ['PC', 'Mobile', 'All']
const ACTION_TYPES = [
  'ApiEngine',
  'OpenDetail',
  'OpenList',
  'OpenForm',
  'Navigate',
  'Dial',
  'Scan',
  'Map',
  'Refresh',
  'Back',
  'Copy'
]
const CONDITION_OPERATORS = [
  '=',
  '==',
  '!=',
  '<>',
  '>',
  '>=',
  '<',
  '<=',
  'In',
  'NotIn',
  'Contains',
  'NotContains',
  'IsEmpty',
  'IsNotEmpty'
]

export const VIEW_SCHEMA_VERSION = '1.0'
export const SUPPORTED_VIEW_SCENES = Object.freeze([...SCENES])
export const SUPPORTED_VIEW_DEVICES = Object.freeze([...DEVICES])
export const SUPPORTED_ACTION_TYPES = Object.freeze([...ACTION_TYPES])

function canonical(value, candidates, fallback = '') {
  const source = String(value || '').trim().toLowerCase()
  return candidates.find((item) => item.toLowerCase() === source) || fallback
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  if (value === true || value === 1 || value === '1' || value === 'true') return true
  if (value === false || value === 0 || value === '0' || value === 'false') return false
  return fallback
}

function cleanString(value, maxLength = 500) {
  if (value === undefined || value === null) return ''
  return String(value).trim().slice(0, maxLength)
}

function firstValue(source, names, fallback = undefined) {
  if (!source || typeof source !== 'object') return fallback
  for (const name of names) {
    if (source[name] !== undefined && source[name] !== null) return source[name]
  }
  return fallback
}

export function parseJsonObject(value, fallback = {}) {
  let current = value
  for (let index = 0; index < 2; index += 1) {
    if (current && typeof current === 'object' && !Array.isArray(current)) return current
    if (typeof current !== 'string' || !current.trim()) return fallback
    try {
      current = JSON.parse(current)
    } catch (error) {
      return fallback
    }
  }
  return current && typeof current === 'object' && !Array.isArray(current) ? current : fallback
}

export function normalizeStringList(value) {
  if (value === undefined || value === null || value === '') return []
  if (Array.isArray(value)) {
    return [...new Set(value.flatMap((item) => normalizeStringList(item)).filter(Boolean))]
  }
  if (typeof value === 'object') {
    const candidate = firstValue(value, ['Id', 'id', 'Value', 'value', 'Name', 'name'])
    return candidate === undefined ? [] : normalizeStringList(candidate)
  }
  const text = String(value).trim()
  if (!text) return []
  if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('"') && text.endsWith('"'))) {
    try {
      return normalizeStringList(JSON.parse(text))
    } catch (error) {}
  }
  return [...new Set(text.split(/[,;|]/).map((item) => item.trim()).filter(Boolean))]
}

export function normalizeUserRoleIds(userOrRoleIds) {
  if (Array.isArray(userOrRoleIds) || typeof userOrRoleIds === 'string') {
    return normalizeStringList(userOrRoleIds)
  }
  const user = userOrRoleIds && typeof userOrRoleIds === 'object' ? userOrRoleIds : {}
  return normalizeStringList([
    user.RoleIds,
    user.RoleId,
    user.SysRoleIds,
    user.CurrentRoleId,
    user.RoleName
  ])
}

function normalizeField(field, index = 0) {
  const source = typeof field === 'string' ? { Name: field } : (field || {})
  const name = cleanString(firstValue(source, ['Name', 'name', 'Field', 'field']), 100)
  if (!name) return null
  const result = {
    Key: cleanString(firstValue(source, ['Key', 'key']), 100) || `${name}:${index}`,
    Name: name
  }
  const label = cleanString(firstValue(source, ['Label', 'label']), 100)
  const format = cleanString(firstValue(source, ['Format', 'format']), 50)
  const width = Number(firstValue(source, ['Width', 'width', 'Span', 'span']))
  const mobileWidth = Number(firstValue(source, ['MobileWidth', 'mobileWidth']))
  if (label) result.Label = label
  if (format) result.Format = format
  if (Number.isFinite(width) && width > 0) result.Width = Math.min(24, width)
  if (Number.isFinite(mobileWidth) && mobileWidth > 0) result.MobileWidth = Math.min(24, mobileWidth)
  if (firstValue(source, ['Hidden', 'hidden']) !== undefined) {
    result.Hidden = toBoolean(firstValue(source, ['Hidden', 'hidden']))
  }
  return result
}

function normalizeMetric(metric, index = 0) {
  const source = metric || {}
  const field = cleanString(firstValue(source, ['Field', 'field']), 100)
  const apiEngineKey = cleanString(firstValue(source, ['ApiEngineKey', 'apiEngineKey']), 100)
  if (!field && !apiEngineKey) return null
  const requestedSourceType = canonical(
    firstValue(source, ['Source', 'source']),
    ['Field', 'ApiEngine'],
    apiEngineKey ? 'ApiEngine' : 'Field'
  )
  const sourceType = requestedSourceType === 'ApiEngine' && !apiEngineKey ? 'Field' : requestedSourceType
  const result = {
    Key: cleanString(firstValue(source, ['Key', 'key']), 100) || field || `metric:${index}`,
    Label: cleanString(firstValue(source, ['Label', 'label']), 100) || field,
    Source: sourceType
  }
  if (field) result.Field = field
  if (apiEngineKey) result.ApiEngineKey = apiEngineKey
  const valueField = cleanString(firstValue(source, ['ValueField', 'valueField']), 200)
  if (valueField) result.ValueField = valueField
  const paramMap = normalizeParamValue(firstValue(source, ['ParamMap', 'paramMap', 'Params', 'params']))
  if (paramMap && Object.keys(paramMap).length) result.ParamMap = paramMap
  const suffix = cleanString(firstValue(source, ['Suffix', 'suffix', 'Unit', 'unit']), 20)
  const format = cleanString(firstValue(source, ['Format', 'format']), 50)
  const icon = cleanString(firstValue(source, ['Icon', 'icon']), 500)
  const color = cleanString(firstValue(source, ['Color', 'color']), 50)
  if (suffix) result.Suffix = suffix
  if (format) result.Format = format
  if (icon) result.Icon = icon
  if (color) result.Color = color
  return result
}

function normalizeCondition(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const mode = canonical(firstValue(value, ['Mode', 'mode']), ['All', 'Any'], 'All')
  const rawRules = firstValue(value, ['Rules', 'rules'], [])
  const rules = (Array.isArray(rawRules) ? rawRules : []).map((rule) => {
    if (!rule || typeof rule !== 'object') return null
    const field = cleanString(firstValue(rule, ['Field', 'field']), 100)
    const operator = canonical(firstValue(rule, ['Operator', 'operator']), CONDITION_OPERATORS, '=')
    if (!field) return null
    return {
      Field: field,
      Operator: operator,
      Value: firstValue(rule, ['Value', 'value'])
    }
  }).filter(Boolean)
  return rules.length ? { Mode: mode, Rules: rules } : null
}

function normalizeParamValue(value, depth = 0) {
  if (depth > 4 || value === undefined || typeof value === 'function') return undefined
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value
  if (Array.isArray(value)) {
    return value.map((item) => normalizeParamValue(item, depth + 1)).filter((item) => item !== undefined)
  }
  if (typeof value === 'object') {
    const result = {}
    Object.keys(value).slice(0, 50).forEach((key) => {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return
      const normalized = normalizeParamValue(value[key], depth + 1)
      if (normalized !== undefined) result[key] = normalized
    })
    return result
  }
  return undefined
}

export function normalizeActionSchema(action, index = 0) {
  const source = action || {}
  const actionType = canonical(firstValue(source, ['ActionType', 'actionType', 'Type', 'type']), ACTION_TYPES)
  if (!actionType) return null
  const apiEngineKey = cleanString(firstValue(source, ['ApiEngineKey', 'apiEngineKey']), 100)
  if (actionType === 'ApiEngine' && !apiEngineKey) return null
  const result = {
    Key: cleanString(firstValue(source, ['Key', 'key', 'Id', 'id']), 100) || `action:${index}`,
    Label: cleanString(firstValue(source, ['Label', 'label', 'Name', 'name']), 100) || '操作',
    ActionType: actionType
  }
  const optionalStrings = {
    Icon: ['Icon', 'icon'],
    Tone: ['Tone', 'tone', 'BtnStyle', 'btnStyle'],
    Confirm: ['Confirm', 'confirm', 'ConfirmText', 'confirmText'],
    ApiEngineKey: ['ApiEngineKey', 'apiEngineKey'],
    Target: ['Target', 'target', 'Path', 'path'],
    TableName: ['TableName', 'tableName', 'Table', 'table'],
    ModuleEngineKey: ['ModuleEngineKey', 'moduleEngineKey'],
    SuccessMessage: ['SuccessMessage', 'successMessage']
  }
  Object.entries(optionalStrings).forEach(([target, names]) => {
    const value = cleanString(firstValue(source, names), target === 'Target' ? 500 : 200)
    if (value) result[target] = value
  })
  const paramMap = normalizeParamValue(firstValue(source, ['ParamMap', 'paramMap', 'Params', 'params']))
  if (paramMap && Object.keys(paramMap).length) result.ParamMap = paramMap
  const visibleWhen = normalizeCondition(firstValue(source, ['VisibleWhen', 'visibleWhen']))
  if (visibleWhen) result.VisibleWhen = visibleWhen
  const successActions = firstValue(source, ['SuccessActions', 'successActions'], [])
  if (Array.isArray(successActions)) {
    result.SuccessActions = successActions.map((item, childIndex) => normalizeActionSchema(item, childIndex))
      .filter(Boolean)
      .slice(0, 10)
  }
  return result
}

function normalizeBlock(block, index = 0) {
  const source = block || {}
  const type = cleanString(firstValue(source, ['Type', 'type']), 50) || 'ResponsiveSection'
  const fields = firstValue(source, ['Fields', 'fields'], [])
  const metrics = firstValue(source, ['Metrics', 'metrics'], [])
  const actions = firstValue(source, ['Actions', 'actions'], [])
  const result = {
    Key: cleanString(firstValue(source, ['Key', 'key', 'Id', 'id']), 100) || `block:${index}`,
    Type: type,
    Title: cleanString(firstValue(source, ['Title', 'title', 'Name', 'name']), 100),
    Fields: (Array.isArray(fields) ? fields : []).map(normalizeField).filter(Boolean),
    Metrics: (Array.isArray(metrics) ? metrics : []).map(normalizeMetric).filter(Boolean),
    Actions: (Array.isArray(actions) ? actions : []).map(normalizeActionSchema).filter(Boolean).slice(0, 30)
  }
  const icon = cleanString(firstValue(source, ['Icon', 'icon']), 500)
  const columns = Number(firstValue(source, ['Columns', 'columns']))
  if (icon) result.Icon = icon
  if (Number.isFinite(columns) && columns > 0) result.Columns = Math.min(4, columns)
  result.DefaultExpanded = toBoolean(firstValue(source, ['DefaultExpanded', 'defaultExpanded']), index === 0)
  return result
}

function normalizeHero(hero) {
  const source = hero || {}
  const result = {}
  const stringFields = {
    Title: ['Title', 'title'],
    Icon: ['Icon', 'icon'],
    Background: ['Background', 'background'],
    ImageField: ['ImageField', 'imageField'],
    TitleField: ['TitleField', 'titleField'],
    FallbackTitleField: ['FallbackTitleField', 'fallbackTitleField'],
    StatusField: ['StatusField', 'statusField'],
    MetaField: ['MetaField', 'metaField']
  }
  Object.entries(stringFields).forEach(([target, names]) => {
    const value = cleanString(firstValue(source, names), ['Icon', 'Background'].includes(target) ? 500 : 100)
    if (value) result[target] = value
  })
  result.PhoneFields = normalizeStringList(firstValue(source, ['PhoneFields', 'phoneFields']))
  const metrics = firstValue(source, ['Metrics', 'metrics'], [])
  result.Metrics = (Array.isArray(metrics) ? metrics : []).map(normalizeMetric).filter(Boolean).slice(0, 6)
  return result
}

function normalizeCard(card) {
  const source = card || {}
  const result = {}
  const stringFields = {
    TitleField: ['TitleField', 'titleField'],
    StatusField: ['StatusField', 'statusField'],
    SummaryField: ['SummaryField', 'summaryField'],
    ImageField: ['ImageField', 'imageField'],
    PeriodField: ['PeriodField', 'periodField']
  }
  Object.entries(stringFields).forEach(([target, names]) => {
    const value = cleanString(firstValue(source, names), 100)
    if (value) result[target] = value
  })
  result.TagFields = normalizeStringList(firstValue(source, ['TagFields', 'tagFields'])).slice(0, 6)
  const fields = firstValue(source, ['Fields', 'fields', 'Lines', 'lines'], [])
  result.Fields = (Array.isArray(fields) ? fields : []).map(normalizeField).filter(Boolean).slice(0, 12)
  return result
}

function normalizeLayout(layout) {
  const source = parseJsonObject(layout, {})
  const blocks = firstValue(source, ['Blocks', 'blocks', 'Sections', 'sections'], [])
  const summaries = firstValue(source, ['Summaries', 'summaries'], [])
  const actions = firstValue(source, ['Actions', 'actions', 'ActionSchema', 'actionSchema'], [])
  const search = parseJsonObject(firstValue(source, ['Search', 'search']), {})
  const statistics = parseJsonObject(firstValue(source, ['Statistics', 'statistics']), {})
  return {
    Preset: cleanString(firstValue(source, ['Preset', 'preset']), 100),
    Hero: normalizeHero(firstValue(source, ['Hero', 'hero'], {})),
    Card: normalizeCard(firstValue(source, ['Card', 'card'], {})),
    Blocks: (Array.isArray(blocks) ? blocks : []).map(normalizeBlock).filter(Boolean).slice(0, 50),
    Summaries: (Array.isArray(summaries) ? summaries : []).map(normalizeField).filter(Boolean).slice(0, 20),
    Actions: (Array.isArray(actions) ? actions : []).map(normalizeActionSchema).filter(Boolean).slice(0, 30),
    Search: {
      StatusOptions: normalizeStringList(firstValue(search, ['StatusOptions', 'statusOptions'])).slice(0, 30),
      PeriodField: cleanString(firstValue(search, ['PeriodField', 'periodField']), 100)
    },
    Statistics: {
      Field: cleanString(firstValue(statistics, ['Field', 'field']), 100),
      Label: cleanString(firstValue(statistics, ['Label', 'label']), 100),
      Format: cleanString(firstValue(statistics, ['Format', 'format']), 50)
    }
  }
}

function normalizeView(view, index = 0) {
  const source = view || {}
  const scene = canonical(firstValue(source, ['Scene', 'scene']), SCENES)
  const device = canonical(firstValue(source, ['Device', 'device']), DEVICES, 'All')
  if (!scene) return null
  const priority = Number(firstValue(source, ['Priority', 'priority'], 0))
  return {
    Key: cleanString(firstValue(source, ['Key', 'key', 'Id', 'id']), 100) || `view:${index}`,
    Scene: scene,
    Device: device,
    RoleIds: normalizeStringList(firstValue(source, ['RoleIds', 'roleIds', 'Roles', 'roles'])),
    Priority: Number.isFinite(priority) ? priority : 0,
    Enabled: toBoolean(firstValue(source, ['Enabled', 'enabled']), true),
    Layout: normalizeLayout(firstValue(source, ['Layout', 'layout', 'LayoutJson', 'layoutJson'], {}))
  }
}

export function extractViewSchema(menuOrConfig) {
  const menu = menuOrConfig && typeof menuOrConfig === 'object' ? menuOrConfig : {}
  const config = parseJsonObject(menu.ViewSchema !== undefined ? menu.ViewSchema : menuOrConfig, {})
  const source = firstValue(config, ['ViewSchema', 'viewSchema'], config.Views || config.views ? config : {})
  const schema = parseJsonObject(source, {})
  const views = firstValue(schema, ['Views', 'views'], [])
  return {
    Enabled: menu.EnableViewSchema === undefined
      ? true
      : toBoolean(menu.EnableViewSchema, false),
    SchemaVersion: cleanString(
      menu.ViewSchemaVersion || firstValue(schema, ['SchemaVersion', 'schemaVersion']),
      20
    ) || VIEW_SCHEMA_VERSION,
    ConfigVersion: Math.max(
      1,
      Number(menu.ViewConfigVersion || firstValue(schema, ['ConfigVersion', 'configVersion'], 1)) || 1
    ),
    Views: (Array.isArray(views) ? views : []).map(normalizeView).filter(Boolean)
  }
}

export function validateViewSchema(menuOrConfig) {
  const schema = extractViewSchema(menuOrConfig)
  const errors = []
  const warnings = []
  if (!schema.Views.length) warnings.push('ViewSchema.Views 为空，将自动使用现有模块和表单配置。')
  const keys = new Set()
  schema.Views.forEach((view, index) => {
    if (keys.has(view.Key)) errors.push(`Views[${index}].Key 重复：${view.Key}`)
    keys.add(view.Key)
    if (!view.Layout.Hero.TitleField && view.Scene === 'Detail') {
      warnings.push(`Views[${index}] 未配置 Hero.TitleField，将使用页面标题兜底。`)
    }
    if (!view.Layout.Card.TitleField && ['List', 'Card'].includes(view.Scene)) {
      warnings.push(`Views[${index}] 未配置 Card.TitleField，将使用模块默认标题字段。`)
    }
  })
  return { valid: errors.length === 0, errors, warnings, schema }
}

function intersects(left, right) {
  const values = new Set(right.map((item) => String(item).toLowerCase()))
  return left.some((item) => values.has(String(item).toLowerCase()))
}

function isEmpty(value) {
  return value === undefined || value === null || value === '' ||
    (Array.isArray(value) && value.length === 0)
}

function evaluateConditionRule(rule, form) {
  const left = form ? form[rule.Field] : undefined
  const right = rule.Value
  switch (rule.Operator) {
    case '=':
    case '==': return String(left ?? '') === String(right ?? '')
    case '!=':
    case '<>': return String(left ?? '') !== String(right ?? '')
    case '>': return Number(left) > Number(right)
    case '>=': return Number(left) >= Number(right)
    case '<': return Number(left) < Number(right)
    case '<=': return Number(left) <= Number(right)
    case 'In': return normalizeStringList(right).map(String).includes(String(left ?? ''))
    case 'NotIn': return !normalizeStringList(right).map(String).includes(String(left ?? ''))
    case 'Contains': return String(left ?? '').includes(String(right ?? ''))
    case 'NotContains': return !String(left ?? '').includes(String(right ?? ''))
    case 'IsEmpty': return isEmpty(left)
    case 'IsNotEmpty': return !isEmpty(left)
    default: return false
  }
}

export function isActionVisible(action, form = {}) {
  const condition = action && action.VisibleWhen
  if (!condition || !Array.isArray(condition.Rules) || !condition.Rules.length) return true
  const values = condition.Rules.map((rule) => evaluateConditionRule(rule, form))
  return condition.Mode === 'Any' ? values.some(Boolean) : values.every(Boolean)
}

function resolveBinding(value, context, depth = 0) {
  if (depth > 4) return undefined
  if (Array.isArray(value)) return value.map((item) => resolveBinding(item, context, depth + 1))
  if (value && typeof value === 'object') {
    const result = {}
    Object.keys(value).slice(0, 50).forEach((key) => {
      result[key] = resolveBinding(value[key], context, depth + 1)
    })
    return result
  }
  if (typeof value !== 'string') return value
  const match = value.match(/^\$(form|user|menu)\.([A-Za-z_][A-Za-z0-9_]*)$/i)
  if (!match) return value
  const source = context[match[1].toLowerCase()] || {}
  return source[match[2]]
}

export function resolveActionParams(action, context = {}) {
  return resolveBinding((action && action.ParamMap) || {}, {
    form: context.form || {},
    user: context.user || {},
    menu: context.menu || {}
  }) || {}
}

export function resolveMetricParams(metric, context = {}) {
  return resolveBinding((metric && metric.paramMap) || (metric && metric.ParamMap) || {}, {
    form: context.form || {},
    user: context.user || {},
    menu: context.menu || {}
  }) || {}
}

export function selectViewDefinition(menuOrConfig, options = {}) {
  const schema = extractViewSchema(menuOrConfig)
  if (!schema.Enabled) return null
  const scene = canonical(options.scene, SCENES)
  const device = canonical(options.device, DEVICES, 'All')
  const roleIds = normalizeUserRoleIds(options.roleIds || options.user)
  const candidates = schema.Views.filter((view) => {
    if (!view.Enabled || view.Scene !== scene) return false
    if (view.Device !== 'All' && view.Device !== device) return false
    return !view.RoleIds.length || intersects(view.RoleIds, roleIds)
  }).map((view, index) => ({
    view,
    index,
    score:
      (view.Device === device ? 1000 : 100) +
      (view.RoleIds.length ? 100 : 0) +
      view.Priority
  })).sort((left, right) => right.score - left.score || left.index - right.index)
  return candidates.length ? candidates[0].view : null
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject)
  if (!value || typeof value !== 'object') return value
  const result = {}
  Object.keys(value).sort().forEach((key) => {
    result[key] = stableObject(value[key])
  })
  return result
}

function hashText(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function legacyValue(menu, name) {
  const value = menu ? menu[name] : null
  if (typeof value !== 'string') return value || null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed)
    } catch (error) {}
  }
  return value
}

export function buildRenderManifest(menu, options = {}) {
  if (!menu || typeof menu !== 'object') return null
  const schema = extractViewSchema(menu)
  const view = selectViewDefinition(menu, options)
  if (!view) return null
  const manifest = {
    SchemaVersion: schema.SchemaVersion,
    ConfigVersion: schema.ConfigVersion,
    Module: {
      Id: cleanString(menu.Id, 100),
      Name: cleanString(menu.Name, 200),
      ModuleEngineKey: cleanString(menu.ModuleEngineKey, 100),
      DiyTableId: cleanString(menu.DiyTableId, 100),
      TableName: cleanString(menu.DiyTableName || options.tableName, 100),
      UpdateTime: cleanString(menu.UpdateTime, 50)
    },
    Context: {
      Scene: view.Scene,
      Device: canonical(options.device, DEVICES, 'All')
    },
    View: view,
    Actions: view.Layout.Actions,
    Legacy: {
      MobileListFields: legacyValue(menu, 'MobileListFields'),
      CardTitleTagFields: legacyValue(menu, 'CardTitleTagFields'),
      CardBottomTagFields: legacyValue(menu, 'CardBottomTagFields'),
      StatisticsFields: legacyValue(menu, 'StatisticsFields'),
      SearchFieldIds: legacyValue(menu, 'SearchFieldIds'),
      SortFieldIds: legacyValue(menu, 'SortFieldIds'),
      DefaultOrderBy: legacyValue(menu, 'DefaultOrderBy')
    }
  }
  manifest.ManifestVersion = `${schema.ConfigVersion}-${hashText(JSON.stringify(stableObject(manifest)))}`
  return manifest
}

function compactObject(value) {
  const result = {}
  Object.entries(value).forEach(([key, item]) => {
    if (item !== undefined && item !== null && item !== '') result[key] = item
  })
  return result
}

export function compileDetailPreset(manifest) {
  const layout = manifest && manifest.View && manifest.View.Layout
  if (!layout) return null
  const hero = layout.Hero || {}
  const sections = (layout.Blocks || []).filter((block) => {
    return ['ResponsiveSection', 'Section', 'FieldSection'].includes(block.Type) && block.Fields.length
  }).map((block) => ({
    key: block.Key,
    title: block.Title || '详细信息',
    defaultExpanded: block.DefaultExpanded,
    columns: block.Columns,
    fields: block.Fields.map((field) => compactObject({
      label: field.Label,
      name: field.Name,
      format: field.Format,
      width: field.Width,
      mobileWidth: field.MobileWidth
    }))
  }))
  return compactObject({
    title: hero.Title || manifest.Module.Name,
    icon: hero.Icon,
    background: hero.Background,
    imageField: hero.ImageField,
    titleField: hero.TitleField,
    fallbackTitleField: hero.FallbackTitleField,
    statusField: hero.StatusField,
    metaField: hero.MetaField,
    phoneFields: hero.PhoneFields || [],
    metrics: (hero.Metrics || []).map((metric) => compactObject({
      key: metric.Key,
      label: metric.Label,
      source: metric.Source,
      field: metric.Field,
      apiEngineKey: metric.ApiEngineKey,
      valueField: metric.ValueField,
      paramMap: metric.ParamMap,
      suffix: metric.Suffix,
      format: metric.Format,
      icon: metric.Icon,
      color: metric.Color
    })),
    sections,
    summaries: (layout.Summaries || []).map((field) => compactObject({
      label: field.Label,
      field: field.Name,
      format: field.Format
    })),
    actions: manifest.Actions || []
  })
}

export function compileFormConfig(manifest) {
  const layout = manifest && manifest.View && manifest.View.Layout
  if (!layout) return null
  const sections = (layout.Blocks || []).filter((block) => {
    return ['ResponsiveSection', 'Section', 'FieldSection'].includes(block.Type) && block.Fields.length
  }).map((block) => ({
    key: block.Key,
    title: block.Title || '基本信息',
    defaultExpanded: block.DefaultExpanded,
    columns: block.Columns,
    fields: block.Fields.map((field) => compactObject({
      label: field.Label,
      name: field.Name,
      format: field.Format,
      width: field.Width,
      mobileWidth: field.MobileWidth,
      hidden: field.Hidden
    }))
  }))
  return {
    sections,
    actions: manifest.Actions || []
  }
}

export function compileListConfig(manifest) {
  const layout = manifest && manifest.View && manifest.View.Layout
  if (!layout) return null
  const card = layout.Card || {}
  return compactObject({
    titleField: card.TitleField,
    statusField: card.StatusField,
    tagFields: card.TagFields || [],
    lines: (card.Fields || []).map((field) => compactObject({
      label: field.Label,
      field: field.Name,
      format: field.Format
    })),
    summaryField: card.SummaryField,
    imageField: card.ImageField,
    periodField: layout.Search.PeriodField || card.PeriodField,
    statusOptions: layout.Search.StatusOptions || [],
    statisticsField: layout.Statistics.Field,
    statisticsLabel: layout.Statistics.Label,
    statisticsFormat: layout.Statistics.Format,
    actionSchema: manifest.Actions || []
  })
}
