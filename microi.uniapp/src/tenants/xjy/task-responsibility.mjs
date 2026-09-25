export const TASK_SCOPE_OPTIONS = [
  { value: 'todo', label: '我的待办' },
  { value: 'participated', label: '我参与的' },
  { value: 'all', label: '全部有权' }
]

export function normalizeTaskScope(scope, mineOnly) {
  if (scope === 'todo' || scope === 'participated' || scope === 'all') return scope
  return mineOnly === true ? 'todo' : 'all'
}

export function buildTaskScopeWhere(scope, userId) {
  if (scope === 'all') return []
  if (!userId) return [{ Name: 'Id', Type: '=', Value: '__no_logged_in_user__' }]
  if (scope === 'participated') {
    return [
      { GroupStart: true, Name: 'ShouhouRYID', Type: '=', Value: userId },
      { AndOr: 'OR', Name: 'HouxuFZRID', Type: '=', Value: userId, GroupEnd: true }
    ]
  }
  // SQL 的 AND 优先于 OR；一层括号即可完整包住两个阶段分支。
  return [
    { GroupStart: true, Name: 'ZhuangtaiZ', Type: 'In', Value: [1, 2, 10] },
    { Name: 'ShouhouRYID', Type: '=', Value: userId },
    { AndOr: 'OR', Name: 'ZhuangtaiZ', Type: '=', Value: 11 },
    { Name: 'HouxuFZRID', Type: '=', Value: userId, GroupEnd: true }
  ]
}
