const EMPTY_ARRAY_TEXT = '[]'

function isEmptyValue(value) {
  return value === undefined || value === null || value === '' ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'string' && value.trim() === EMPTY_ARRAY_TEXT)
}

// 跟进审批字段可能被元数据设为只读或隐藏，因此由租户表单钩子统一生成新增默认值。
export function followupApprovalDefaultValues({
  form = {},
  mode = '',
  rowId = '',
  statusField = 'ShenpiZT',
  statusValueField = 'ShenpiZTZ'
} = {}) {
  if (mode !== 'Add' || rowId) return {}
  return {
    [statusField]: isEmptyValue(form[statusField]) ? '待审批' : form[statusField],
    [statusValueField]: isEmptyValue(form[statusValueField]) ? 2 : form[statusValueField]
  }
}

