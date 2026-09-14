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
