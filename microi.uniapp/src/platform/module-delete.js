import { canDeleteMenuRecord } from './menu-permission.js'

function isDeleteAction(action = {}) {
  const viewAction = action.__viewAction || action
  return viewAction.ActionType === 'Delete' || String(action.label || action.Label || '').trim() === '删除'
}

export function appendStandardDeleteAction(actions = [], options = {}) {
  const canDelete = canDeleteMenuRecord(options.menuId, options.user)
  const result = (Array.isArray(actions) ? actions : []).filter((action) => canDelete || !isDeleteAction(action))
  if (!options.row?.Id || !canDelete || result.some(isDeleteAction)) {
    return result
  }
  result.push({
    Key: '__module_delete__',
    Label: '删除',
    ActionType: 'Delete',
    Tone: 'danger',
    Confirm: `确认删除“${String(options.title || '当前记录')}”吗？删除后可由平台管理员在回收站恢复。`,
    TableName: options.tableName || '',
    ModuleEngineKey: options.moduleEngineKey || '',
    SuccessMessage: '删除成功',
    SuccessActions: [{
      Key: '__refresh_data_after_delete__',
      Label: '刷新数据',
      ActionType: 'Refresh',
      Target: 'Data'
    }]
  })
  return result
}
