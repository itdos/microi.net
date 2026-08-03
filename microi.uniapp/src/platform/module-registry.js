import { getUser, V8 } from '@/utils/request.js'
import { cachedRequest } from '@/platform/cache.js'
import { loadMenuTree } from '@/platform/business-runtime.js'
import { loadNativeFormDefinition, parseJson } from '@/platform/native-form.js'
import { normalizeStringList } from '@/platform/view-schema-core.mjs'

const DEFAULT_ICON = '/static/microi-blue-256.png'
const HEAVY_COMPONENTS = new Set([
  'RichText',
  'ImgUpload',
  'FileUpload',
  'Map',
  'MapArea',
  'TableChild',
  'JoinForm',
  'OpenTable',
  'JoinTable'
])

function menuVisible(menu) {
  if (!menu || !menu.DiyTableId) return false
  if (Number(menu.Display ?? 1) === 0) return false
  if (Number(menu.AppDisplay ?? 1) === 0) return false
  return true
}

function collectMenus(items, parent = null, output = []) {
  ;(Array.isArray(items) ? items : []).forEach((menu) => {
    if (!menu) return
    if (menuVisible(menu)) output.push({ menu, parent })
    collectMenus(menu._Child || menu.children, menu, output)
  })
  return output
}

function configuredFieldNames(value, fields) {
  const rows = parseJson(value, value)
  const list = Array.isArray(rows) ? rows : normalizeStringList(rows)
  const byId = new Map(fields.map((field) => [String(field.Id || '').toLowerCase(), field]))
  const byName = new Map(fields.map((field) => [String(field.Name || '').toLowerCase(), field]))
  return list.map((item) => {
    if (item && typeof item === 'object') {
      const candidate = item.Id || item.id || item.Name || item.name || item.Field || item.field
      const field = byId.get(String(candidate || '').toLowerCase()) ||
        byName.get(String(candidate || '').toLowerCase())
      return field && field.Name
    }
    const field = byId.get(String(item || '').toLowerCase()) ||
      byName.get(String(item || '').toLowerCase())
    return field && field.Name
  }).filter(Boolean)
}

function preferredField(fields, patterns, excluded = new Set(), fallback = true) {
  const visible = fields.filter((field) =>
    field.visible && !excluded.has(field.Name) && !HEAVY_COMPONENTS.has(field.component)
  )
  for (const pattern of patterns) {
    const matched = visible.find((field) =>
      pattern.test(`${field.Name || ''} ${field.Label || ''}`)
    )
    if (matched) return matched
  }
  return fallback ? (visible[0] || null) : null
}

function moduleKey(menu) {
  return String(menu.ModuleEngineKey || menu.Id || menu.DiyTableId || '')
}

function moduleIcon(menu) {
  const value = String(menu.AppIcon || menu.IconUrl || '').trim()
  if (/^(https?:|data:|\/)/i.test(value)) return value
  if (/^static\//i.test(value)) return `/${value}`
  return DEFAULT_ICON
}

async function loadTableMap(entries) {
  const result = new Map()
  const pending = new Map()
  entries.forEach(({ menu }) => {
    const tableId = String(menu.DiyTableId || '')
    if (!tableId) return
    const tableName = menu.DiyTableName || menu.TableName ||
      menu.DiyTable?.Name || menu._DiyTable?.Name || ''
    if (tableName) {
      result.set(tableId, {
        Id: tableId,
        Name: tableName,
        Description: menu.DiyTableDescription || menu.Name || tableName
      })
      return
    }
    if (!pending.has(tableId)) pending.set(tableId, menu)
  })

  const tasks = [...pending.entries()]
  let cursor = 0
  const worker = async () => {
    while (cursor < tasks.length) {
      const [tableId, menu] = tasks[cursor++]
      try {
        const response = await V8.FormEngine.GetDiyTableModel({
          Name: tableId,
          _SysMenuId: menu.Id
        })
        if (response && Number(response.Code) === 1 && response.Data) {
          result.set(tableId, response.Data)
        }
      } catch (error) {}
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, Math.max(1, tasks.length)) }, worker))
  return result
}

function baseModule(menu, parent, table) {
  const tableName = menu.DiyTableName || menu.TableName ||
    menu.DiyTable && menu.DiyTable.Name ||
    menu._DiyTable && menu._DiyTable.Name ||
    table && table.Name || ''
  return {
    key: moduleKey(menu),
    menuId: menu.Id || '',
    menu,
    title: menu.Name || table && table.Description || tableName || '业务数据',
    description: menu.Description || table && table.Description || '',
    icon: moduleIcon(menu),
    accent: menu.Color || '#087da8',
    table: tableName,
    tableId: menu.DiyTableId || table && table.Id || '',
    menuAliases: [menu.Name].filter(Boolean),
    parentId: parent && parent.Id || '',
    parentName: parent && parent.Name || '业务应用',
    defaultOrderBy: menu.DefaultOrderBy || 'CreateTime',
    defaultOrderType: menu.DefaultOrderByType || 'DESC',
    pageSize: Number(menu.PageSize || 15) || 15
  }
}

export async function loadAccessibleModules(refresh = false) {
  const user = getUser() || {}
  const identity = String(user.Id || user.Account || 'guest')
  const result = await cachedRequest(`module-registry:v2:${identity}`, async () => {
    const entries = collectMenus(await loadMenuTree(refresh))
    const tableMap = await loadTableMap(entries)
    return entries.map(({ menu, parent }) => {
      const table = tableMap.get(String(menu.DiyTableId || ''))
      return baseModule(menu, parent, table)
    }).filter((module) => module.key && module.table)
  }, { refresh, maxAge: 2 * 60 * 1000, allowStale: true })
  return result.data || []
}

export async function loadAccessibleModuleGroups(refresh = false) {
  const modules = await loadAccessibleModules(refresh)
  const groups = new Map()
  modules.forEach((module) => {
    const key = module.parentId || `group:${module.parentName}`
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        title: module.parentName || '业务应用',
        subtitle: '由模块引擎与当前角色权限动态生成',
        accent: module.accent || '#087da8',
        items: []
      })
    }
    groups.get(key).items.push(module)
  })
  return [...groups.values()]
}

export async function loadModuleDefinition(menuId, refresh = false) {
  const modules = await loadAccessibleModules(refresh)
  const module = modules.find((item) =>
    String(item.menuId) === String(menuId) || String(item.key) === String(menuId)
  )
  if (!module) throw new Error('模块不存在或当前账号无权访问')
  const definition = await loadNativeFormDefinition(module.table, refresh, {
    menuId: module.menuId,
    moduleEngineKey: module.key
  })
  const fields = definition.fields || []
  const configuredMobile = configuredFieldNames(module.menu.MobileListFields, fields)
  const configuredList = configuredFieldNames(module.menu.SelectFields, fields)
  const configuredTags = configuredFieldNames(module.menu.CardTitleTagFields, fields)
  const configuredBottom = configuredFieldNames(module.menu.CardBottomTagFields, fields)
  const configuredStatistics = configuredFieldNames(module.menu.StatisticsFields, fields)
  // 后台已配置“移动端/卡片显示列”时必须严格使用该顺序；
  // SelectFields 只在未配置移动端列时作为兼容回退，不能混入卡片造成展示漂移。
  const preferredNames = configuredMobile.length ? configuredMobile : configuredList
  const preferred = preferredNames.map((name) => fields.find((field) => field.Name === name)).filter(Boolean)
  const titleField = preferredField(
    preferred.length ? preferred : fields,
    [/名称|标题|编号|姓名|name|title|code|no/i]
  )
  const excluded = new Set([titleField && titleField.Name].filter(Boolean))
  const statusField = preferredField(fields, [/状态|status|stage/i], excluded, false)
  if (statusField) excluded.add(statusField.Name)
  let lines = preferred.filter((field) =>
    !excluded.has(field.Name) && !HEAVY_COMPONENTS.has(field.component)
  ).slice(0, 4)
  if (!configuredMobile.length && lines.length < 3) {
    fields.forEach((field) => {
      if (lines.length >= 4 || excluded.has(field.Name) || HEAVY_COMPONENTS.has(field.component)) return
      if (!field.visible || lines.some((item) => item.Name === field.Name)) return
      lines.push(field)
    })
  }
  const statisticField = configuredStatistics
    .map((name) => fields.find((field) => field.Name === name))
    .find(Boolean)
  const periodField = preferredField(fields, [/时间|日期|date|time/i], new Set(), false) ||
    fields.find((field) => field.Name === 'CreateTime')
  return {
    ...module,
    definition,
    titleField: titleField && titleField.Name || 'Id',
    statusField: statusField && statusField.Name || '',
    statusOptions: statusField ? (statusField.options || []).map((item) => item.value) : [],
    tagFields: configuredTags.slice(0, 3),
    bottomFields: configuredBottom.slice(0, 3),
    lines: lines.map((field) => ({
      field: field.Name,
      label: field.Label || field.Name,
      component: field.component
    })),
    statisticsField: statisticField && statisticField.Name || '',
    statisticsLabel: statisticField && (statisticField.Label || statisticField.Name) || '',
    periodField: periodField && periodField.Name || 'CreateTime'
  }
}

export default {
  loadAccessibleModules,
  loadAccessibleModuleGroups,
  loadModuleDefinition
}
