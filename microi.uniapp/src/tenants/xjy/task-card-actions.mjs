import { canEditMenuRecord, hasExactMenuPermission } from '../../platform/menu-permission.js'
import { appendStandardDeleteAction } from '../../platform/module-delete.js'

// 后台按钮 Id 才是授权键；名称只用于展示，不执行后台任意前端 V8。
const NATIVE_BUTTONS = Object.freeze({
  '6c979682-0dec-4f38-b107-3994b8f66cc5': 'assign',
  '5c36690a-73d8-4c88-bfad-04c12dd7c549': 'assign',
  '718cc780-fe95-4af4-a7a8-96c829f15f45': 'claim',
  '865ec95c-03cd-4f12-8752-124ce8255e9a': 'claim',
  '3e66f489-6817-4a70-bf40-26a922fd3d51': 'finish',
  '5820da9c-d1fd-41ee-9303-b647d0ab1d12': 'finish',
  '19dc5540-1fda-4d64-9a56-632c664399ac': 'evaluate',
  'd3443dab-7c4d-41ba-9a79-f5dcf79d8a2a': 'return',
  '4412300d-066b-458e-98d9-c3458816a688': 'return',
  '21f0baea-8134-406e-8585-e8057458193b': 'accept',
  'bdd83ec6-ee16-44d1-9dca-d8d80a916e22': 'reject',
  'a5e16b3d-c542-4f0c-9685-71b1c8aed403': 'merchantPass',
  '5ad7790d-41cd-416f-aeeb-e861d4b497d5': 'merchantReject',
  '56b9d9f5-667d-45d4-a4d4-17d9bf541172': 'merchantPass',
  '7e9589d9-e7b3-4870-a4d9-a614a48bfee9': 'merchantReject',
  '2860d95a-37d1-4069-8eea-4e27b44ac313': 'customerPass',
  '37eae95b-7dc1-46d1-a765-3b8ee6c8bc0b': 'customerReject',
  '0c2cae82-29e9-4dbf-97c1-9ef6e9de0239': 'evaluate',
  'cfc00d1c-3b37-4e11-98c7-e739d2cd81f2': 'followUp'
})

// 验收与评价已有独立服务端权限，旧同名按钮不能代替这些授权键。
const FLOW_PERMISSION_IDS = Object.freeze({
  merchantPass: '56b9d9f5-667d-45d4-a4d4-17d9bf541172', merchantReject: '7e9589d9-e7b3-4870-a4d9-a614a48bfee9',
  customerPass: '2860d95a-37d1-4069-8eea-4e27b44ac313', customerReject: '37eae95b-7dc1-46d1-a765-3b8ee6c8bc0b',
  evaluate: '0c2cae82-29e9-4dbf-97c1-9ef6e9de0239', followUp: 'cfc00d1c-3b37-4e11-98c7-e739d2cd81f2'
})

function buttons(value) {
  if (Array.isArray(value)) return value
  try { const result = JSON.parse(value || '[]'); return Array.isArray(result) ? result : [] } catch { return [] }
}

export function taskNativeAction(buttonId, row = {}) {
  const action = NATIVE_BUTTONS[String(buttonId || '').toLowerCase()]
  const state = String(row.Zhuangtai || row.state || '')
  if (action === 'assign' || action === 'claim') return /^(待指派|待接单)$/.test(state) ? action : ''
  if (action === 'finish') return /^(待服务|待完成)$/.test(state) ? action : ''
  if (action === 'accept') return state === '待客服验收' ? 'merchantPass' : state === '待客户验收' ? 'customerPass' : ''
  if (action === 'reject' || action === 'return') {
    if (state === '待客服验收') return 'merchantReject'
    if (state === '待客户验收') return 'customerReject'
    return action === 'return' && /^(待服务|待完成)$/.test(state) ? 'cancel' : ''
  }
  if (action === 'merchantPass' || action === 'merchantReject') return state === '待客服验收' ? action : ''
  if (action === 'customerPass' || action === 'customerReject') return ['待客户验收', '待评价', '已结束'].includes(state) ? action : ''
  if (action === 'evaluate') return ['待验收', '待客户验收', '待评价'].includes(state) ? action : ''
  if (action === 'followUp') return state === '已结束' ? action : ''
  return ''
}

export function getTaskCardActions(row = {}, menu = {}, user = {}, context = {}) {
  const id = String(row.Id || row.id || '')
  if (!id || !menu.Id) return []
  const menuId = String(menu.Id)
  const actions = []
  const seen = new Set()
  const configured = [...buttons(menu.MoreBtns), ...buttons(menu.FormBtns)].sort((a, b) => Number(a.Sort || 0) - Number(b.Sort || 0))
  for (const button of configured) {
    const buttonId = String(button && button.Id || '')
    const nativeAction = taskNativeAction(buttonId, row)
    if (!nativeAction || seen.has(nativeAction) || !hasExactMenuPermission(menuId, buttonId, user)) continue
    if (FLOW_PERMISSION_IDS[nativeAction] && !hasExactMenuPermission(menuId, FLOW_PERMISSION_IDS[nativeAction], user)) continue
    seen.add(nativeAction)
    actions.push({
      Key: `task:${buttonId}`, Label: button.Name || button._RawName || '任务操作', ButtonId: buttonId,
      ActionType: 'Navigate', Target: `/pages/task/detail?id=${encodeURIComponent(id)}&rowAction=${encodeURIComponent(buttonId)}`
    })
  }
  if (canEditMenuRecord(menuId, user)) {
    const query = [`table=Diy_ShouhouDD`, `id=${encodeURIComponent(id)}`, 'mode=Edit', `menuId=${encodeURIComponent(menuId)}`]
    if (context.tableChildAuth) query.push(`tableChildAuth=${encodeURIComponent(JSON.stringify(context.tableChildAuth))}`)
    actions.push({ Key: 'task:edit', Label: '编辑', ActionType: 'Navigate', Target: `/pages/native-form/index?${query.join('&')}` })
  }
  return appendStandardDeleteAction(actions, {
    row: { ...row, Id: id }, user, menuId, tableName: 'Diy_ShouhouDD',
    moduleEngineKey: menu.ModuleEngineKey || 'Diy_ShouhouDD', title: row.KehuMC || row.customer || '售后任务'
  }).map((action) => ({ key: action.Key, label: action.Label, __viewAction: action }))
}
