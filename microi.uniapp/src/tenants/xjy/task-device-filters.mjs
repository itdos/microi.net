export const TASK_DEVICE_FALLBACK_FILTER_FIELDS = Object.freeze([
  { key: 'AnzhuangWZ', field: 'AnzhuangWZ', label: '安装位置', type: 'text', placeholder: '请输入安装位置' },
  { key: 'ShebeiXH', field: 'ShebeiXH', label: '设备型号', type: 'text', placeholder: '请输入设备型号' },
  { key: 'ShebeiBH', field: 'ShebeiBH', label: '设备编号', type: 'text', placeholder: '请输入设备编号' },
  { key: 'ShebeiMC', field: 'ShebeiMC', label: '设备名称', type: 'text', placeholder: '请输入设备名称' }
])

export const TASK_DEVICE_FALLBACK_SEARCH_FIELDS = Object.freeze(
  TASK_DEVICE_FALLBACK_FILTER_FIELDS.map((field) => ({
    Name: field.field,
    Label: field.label,
    DisplayType: 'Out'
  }))
)

const TASK_DEVICE_KEYWORD_FIELDS = Object.freeze(
  TASK_DEVICE_FALLBACK_FILTER_FIELDS.map((field) => field.field)
)

export function buildTaskDeviceKeywordWhere(keyword = '') {
  const value = String(keyword || '').trim()
  if (!value) return []

  // 关键词只能查询售后设备子表真实字段；卡片显示用的历史商品字段不能进入 _Where，
  // 否则任意关键词都会因字段元数据不存在而让整次列表查询失败。
  return TASK_DEVICE_KEYWORD_FIELDS.map((Name, index) => ({
    ...(index === 0 ? { GroupStart: true } : { AndOr: 'OR' }),
    Name,
    Type: 'Like',
    Value: value,
    ...(index === TASK_DEVICE_KEYWORD_FIELDS.length - 1 ? { GroupEnd: true } : {})
  }))
}

export function buildTaskDeviceServiceStatusWhere(serviceStatus = 'all') {
  if (serviceStatus === 'completed') {
    return [{ Name: 'FuwuZTZ', Type: '=', Value: '1' }]
  }
  if (serviceStatus === 'unfinished') {
    // 历史未处理记录的完成标记可能是 0、空串或 NULL，必须作为同一个 OR 分组查询。
    return [
      { GroupStart: true, Name: 'FuwuZTZ', Type: '<>', Value: '1' },
      { AndOr: 'OR', Name: 'FuwuZTZ', Type: '=', Value: null, GroupEnd: true }
    ]
  }
  return []
}
