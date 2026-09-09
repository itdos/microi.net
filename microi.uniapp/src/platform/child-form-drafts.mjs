// Page-owned, in-memory child drafts. Nothing is written until the parent is saved.
const sessions = new Map()
const clone = value => JSON.parse(JSON.stringify(value))

export function createChildDraftSession(parentId) {
  sessions.set(String(parentId), new Map())
}

export function disposeChildDraftSession(parentId) {
  sessions.delete(String(parentId))
}

export function childDraftGroup(parentId, fieldId, options = {}) {
  const session = sessions.get(String(parentId))
  if (!session || !fieldId) return null
  const key = JSON.stringify([String(parentId), String(fieldId)])
  if (!session.has(key)) session.set(key, { key, rows: [], attempted: new Set(), saved: new Set(), deleted: new Set() })
  const group = session.get(key)
  Object.assign(group, options)
  return group
}

export function findChildDraftGroup(key) {
  for (const session of sessions.values()) {
    if (session.has(key)) return session.get(key)
  }
  return null
}

export function childDraftRows(parentId, tableName) {
  const groups = sessions.get(String(parentId))
  if (!groups) return null
  return [...groups.values()].filter(group =>
    String(group.tableName).toLowerCase() === String(tableName).toLowerCase()
  ).flatMap(group => group.rows)
}

export function readChildDraft(key, tableName, rowId) {
  const group = findChildDraftGroup(key)
  const row = group?.rows.find(item => String(item.Id) === String(rowId))
  if (!row || String(group.tableName).toLowerCase() !== String(tableName).toLowerCase()) {
    throw new Error('未保存的子表记录已失效，请返回主表重新打开')
  }
  return clone(row)
}

export function writeChildDraft(key, tableName, rowId, values) {
  const oldRow = readChildDraft(key, tableName, rowId)
  const group = findChildDraftGroup(key)
  const row = { ...oldRow, ...clone(values), Id: oldRow.Id }
  group.rows = group.rows.map(item => String(item.Id) === String(rowId) ? row : item)
  return clone(row)
}

export async function flushChildDrafts(parentId, savedParentId, formEngine, parentForm, buildDefaults) {
  const session = sessions.get(String(parentId))
  if (!session) return
  for (const group of session.values()) {
    const relationValue = group.primaryField ? parentForm[group.primaryField] : savedParentId
    const defaults = buildDefaults({ fieldConfig: group.fieldConfig, parentForm,
      childFkField: group.fkField, relationValue })
    const auth = group.auth ? { ...group.auth, ParentRowId: String(savedParentId),
      ParentValue: String(relationValue), ParentFormMode: 'Edit' } : null
    const scope = { ...(group.menuId ? { _SysMenuId: group.menuId } : {}),
      ...(auth ? { _TableChildAuth: auth } : {}) }
    for (const id of group.deleted) {
      if (group.attempted.has(id) || group.saved.has(id)) {
        const existing = await formEngine.GetFormData(group.tableName, { ...scope, Id: id })
        if (Number(existing?.Code) === 1 && existing.Data?.Id) {
          const result = await formEngine.DelFormData({ FormEngineKey: group.tableName, ...scope, Id: id, _InvokeType: 'Client' })
          if (Number(result?.Code) !== 1) throw new Error(result?.Msg || '子表删除失败')
        } else if (Number(existing?.Code) !== 2) throw new Error(existing?.Msg || '子表保存状态确认失败，请重试')
      }
      group.deleted.delete(id)
    }
    for (const row of group.rows) {
      const id = String(row.Id)
      // After a transport failure, read back the stable id before retrying Add.
      if (group.attempted.has(id) && !group.saved.has(id)) {
        const existing = await formEngine.GetFormData(group.tableName, { ...scope, Id: id })
        if (Number(existing?.Code) === 1 && existing.Data?.Id) group.saved.add(id)
        else if (Number(existing?.Code) !== 2) throw new Error(existing?.Msg || '子表保存状态确认失败，请重试')
      }
      group.attempted.add(id)
      const result = await formEngine[group.saved.has(id) ? 'UptFormData' : 'AddFormData'](
        group.tableName, { ...row, ...defaults, ...scope, Id: id, _InvokeType: 'Client' }
      )
      if (!result || Number(result.Code) !== 1) {
        group.attempted.delete(id)
        throw new Error(result?.Msg || '子表保存失败')
      }
      group.saved.add(id)
    }
  }
  sessions.delete(String(parentId))
}
